# Supabase authentication and tenant authorization

FreshLens uses Supabase Auth for identity, FastAPI for API authorization, and
PostgreSQL RLS as the authoritative tenant boundary.

## Identity contract

Supabase access tokens retain the standard `role: authenticated` claim. The
database custom access-token hook adds these server-controlled FreshLens claims:

| Claim | Vendor | Platform admin |
|---|---|---|
| `app_role` | `vendor` | `platform_admin` |
| `tenant_id` | Required tenant UUID | Absent |

Authorization never reads `user_metadata`, request bodies, query parameters, or
client storage for these values. Every runtime also requires Supabase's standard
`role: authenticated`, `is_anonymous: false`, UUID `sub`, and UUID `session_id`
claims before accepting the application role.

## Project setup

1. Create a Supabase project with asymmetric JWT signing keys (the default for
   new projects).
2. In **Authentication → Providers**, keep Email/Password enabled, disable public
   user signup, and leave anonymous sign-ins disabled. V1 accounts are created
   manually by a project owner.
3. Apply `infra/db/migrations/0001_auth_tenancy.sql` through the Supabase SQL
   editor or CLI.
4. In **Authentication → Hooks → Custom Access Token**, enable
   `public.custom_access_token_hook`.
5. Copy the appropriate `.env.example` file to an ignored local env file for the
   API, web app, and mobile app. Use the project URL and publishable key; never
   place the service-role key in either client.
6. Create a production runtime login with a generated password. The migration's
   `freshlens_api` role is deliberately `NOLOGIN`, `NOSUPERUSER`, and
   `NOBYPASSRLS`; the runtime login inherits only that group's grants:

   ```sql
   create role freshlens_api_runtime
     login password '<generated-secret>'
     nosuperuser nocreatedb nocreaterole inherit nobypassrls;
   grant freshlens_api to freshlens_api_runtime;
   ```

7. Put that restricted login—not `postgres`, a database owner, or
   `service_role`—in the API's `DATABASE_URL`. Set `DATABASE_SSL_MODE=require`
   (`COMPOSE_DATABASE_SSL_MODE=require` for Docker). For hosted Supabase, use the
   **session pooler** connection details from the project's **Connect** panel. A
   typical URI shape is:

   ```text
   postgresql://freshlens_api_runtime.<project-ref>:<password>@<pooler-host>:5432/postgres
   ```

   Copy the exact host and username format from the project because they are
   project-specific. Session mode is the prototype default. If transaction mode
   is adopted later, every `set_config(..., true)` call and its business query
   must remain inside one explicit transaction, as the current API helper does.

The service-role key is not needed for login, JWT verification, or business
queries. Keep it server-only if a later administrative workflow requires it.

## Provision accounts

Accounts are owner-provisioned for V1. In **Authentication → Users**, use
**Create user** with an email and temporary password, then map its UUID in SQL.
Do not use an email invitation yet: neither client implements an invite callback
or password-setup route. Do not enable public signup to work around that gap.

Platform admin:

```sql
insert into public.users (id, role, display_name, email)
select id, 'platform_admin', 'Platform Admin', email
from auth.users
where email = 'admin@example.com';
```

Vendor:

```sql
insert into public.tenants (id, name)
values ('11111111-1111-4111-8111-111111111111', 'Example Grocer');

insert into public.users (id, tenant_id, role, display_name, email)
select
  id,
  '11111111-1111-4111-8111-111111111111',
  'vendor',
  'Example Vendor',
  email
from auth.users
where email = 'vendor@example.com';
```

Confirm that each `insert ... select` affected one row. The user must sign in
again after provisioning or any role/tenant change so Supabase issues a token
containing the updated claims.

Marking a tenant inactive immediately hides its `tenants` and `users` rows from
vendor queries, including queries made with an already-issued token containing
the old claims. The custom access-token hook also stops issuing `app_role` and
`tenant_id` for that tenant. Revoke its users' active Supabase sessions as a
defense-in-depth and UX cleanup step so clients are forced back to login; the
identity-table RLS boundary does not wait for token expiry or revocation.
Platform admins are not tenant-scoped and remain available. Future operational
table policies must apply the same active-tenant gate.

## Runtime flow

1. Web or mobile submits email/password directly to Supabase Auth over HTTPS.
2. Supabase returns a short-lived access-token JWT plus a refresh token.
3. Next.js stores the admin session in SSR cookies; Expo stores the vendor
   session in encrypted device storage.
4. Clients attach the access token as a Bearer token to FastAPI calls.
5. FastAPI auth middleware verifies signature, issuer, audience, expiry,
   application role, and tenant shape, then attaches the trusted principal to
   request state. Missing/invalid tokens return 401; wrong roles return 403.
6. The tenant database dependency opens a transaction and sets `app.tenant_id`,
   `app.user_id`, and
   `app.user_role` transaction-locally on the same database connection used by
   the query. RLS then prevents cross-tenant reads and writes.

Platform admins may use explicitly designed admin and aggregate endpoints only.
Future business-table RLS policies must not add a platform-admin override for raw
scans, images, batches, quantities, or inventory.

`tenants` and `users` are identity-boundary exceptions to the general
tenant-column rule. `tenants` is the isolation root and has no `tenant_id`;
`users.tenant_id` is required for `vendor` and must be null for
`platform_admin`. All vendor operational tables still require a non-null
`tenant_id` and RLS in the same migration.

Vendor device push-token registration remains required by FR-V-001. It belongs
to the scan/alert notification endpoint work because the current auth feature
has no notification-token API to call yet; authentication must not accept a
client-selected tenant while that endpoint is added.
