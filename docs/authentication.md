# Supabase authentication and tenant authorization

FreshLens uses Supabase Auth for identity, FastAPI for API authorization, and
PostgreSQL RLS as the authoritative tenant boundary.

Supabase Auth is the identity provider only. Roles, tenants and all business
data live in the application database, which is the Compose `postgres`
container on the VPS. The Supabase project's own database is not used for
FreshLens account mappings or business queries.

## Identity contract

Supabase access tokens retain the standard `role: authenticated` claim. On
every sign-in and refresh, Supabase calls the API's HTTP access-token hook
(`POST /api/v1/auth/hooks/access-token`). The API verifies the Standard
Webhooks signature, resolves the account in the application database through
`public.resolve_access_token_claims` (migration 0006), and returns these
server-controlled FreshLens claims:

| Claim | Vendor | Tenant admin | Platform admin |
|---|---|---|---|
| `app_role` | `vendor` | `tenant_admin` | `platform_admin` |
| `tenant_id` | Required tenant UUID | Required tenant UUID | Absent |

Authorization never reads `user_metadata`, request bodies, query parameters, or
client storage for these values. Every runtime also requires Supabase's standard
`role: authenticated`, `is_anonymous: false`, UUID `sub`, and UUID `session_id`
claims before accepting the application role.

## Project setup

1. Create a Supabase project with asymmetric JWT signing keys (the default for
   new projects).
2. In **Authentication → Providers**, keep Email/Password enabled, disable public
   Auth user signup, and leave anonymous sign-ins disabled. The public FreshLens
   application form does not create an Auth account before approval.
3. Apply the numbered migrations in `infra/db/migrations` to the application
   database. Compose initializes these on a new database volume; existing
   volumes require applying new migrations explicitly.
4. In **Authentication → Hooks → Custom Access Token**, choose **HTTPS** and
   set the URL to the public API over TLS, for example
   `https://freshlens-admin.vercel.app/api/v1/auth/hooks/access-token` (the
   Vercel proxy forwards `/api/v1/*` to the VPS). Generate the hook secret there
   and put it in the VPS root `.env` as `SUPABASE_AUTH_HOOK_SECRET`
   (`v1,whsec_...`), then restart the `api` container. The API returns 503 to
   the hook until the secret is set, and Supabase then fails the sign-in.
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

An applicant submits organization and owner details through the public web
form. This creates only a protected `tenant_applications` row. A platform admin
reviews the queue; approval atomically creates the tenant mapping, assigns the
owner the `tenant_admin` role, and sends a one-time mobile password-setup link.
Rejected applications never create tenants or Auth users. A tenant admin can
then invite and revoke ordinary `vendor` users only within the tenant from the
tenant workspace. Platform admins retain the same cross-tenant controls.

Set `SUPABASE_SERVICE_ROLE_KEY` only on the FastAPI server. Set
`TENANT_ADMIN_INVITE_REDIRECT_URL=freshlens://set-password` and allow that URL
under **Authentication → URL Configuration → Redirect URLs** for tenant-owner
and vendor invitations. Configure SMTP for real addresses. The installed EAS
build includes the `freshlens` URL scheme; Expo Go is not a stable target for
these email links. Invitation and
recovery links expire according to Supabase's email OTP expiration setting.
Local Compose uses `LOCAL_AUTH_SHADOW=true` to insert the invited Auth user's
ID and email into the local `auth.users` mirror required by the application
profile's foreign key. It does not copy tenants or profiles to Supabase.
The HTTPS access-token hook resolves roles and tenant IDs exclusively from the
application database. Deployments using hosted Supabase as the application
database leave the flag false because Auth already creates the referenced row.
When upgrading an existing Compose database for tenant-admin onboarding, also
refresh `public.create_local_auth_shadow` from
`infra/db/local/0020_runtime_login.sql`; the older definition permits only
platform admins to provision the local mirror.

Manual mapping still works: run the SQL below **in the application database**
(the VPS `postgres` container) after inserting `(id, email)` into the local
`auth.users` mirror, or use `scripts/provision-local-vendor.sh <uuid> <email>`.

Platform admin:

```sql
insert into public.users (id, role, display_name, email)
select id, 'platform_admin', 'Platform Admin', email
from auth.users
where email = 'admin@example.com';
```

Manual vendor provisioning, if needed:

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

Platform admins can revoke or restore an entire tenant, or one vendor user in a
tenant. Marking either record inactive immediately hides all tenant data from
that vendor, including queries made with an already-issued token containing the
old claims. Tenant revocation affects every user mapped to the tenant; user
revocation affects only that identity. The custom access-token hook also stops
issuing `app_role` and `tenant_id` while either status is inactive. Revoke active
Supabase sessions as an optional defense-in-depth and UX cleanup step; the RLS
boundary and API database dependency do not wait for token expiry. Platform
admins are not tenant-scoped and remain available. Future operational table
policies must apply the same active-tenant-and-user gate.

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
   the query. It verifies that both the user and tenant remain active, then RLS
   prevents cross-tenant or revoked-user reads and writes.

Tenant admins use the web workspace for their own RLS-scoped aggregates and
vendor accounts; they may also use normal tenant operations. Platform admins
may use explicitly designed admin and aggregate endpoints only.
Future business-table RLS policies must not add a platform-admin override for raw
scans, images, batches, quantities, or inventory.

`tenants` and `users` are identity-boundary exceptions to the general
tenant-column rule. `tenants` is the isolation root and has no `tenant_id`;
`users.tenant_id` is required for `vendor` and `tenant_admin`, and must be null for
`platform_admin`. All vendor operational tables still require a non-null
`tenant_id` and RLS in the same migration.

Vendor device push-token registration remains required by FR-V-001. It belongs
to the scan/alert notification endpoint work because the current auth feature
has no notification-token API to call yet; authentication must not accept a
client-selected tenant while that endpoint is added.
