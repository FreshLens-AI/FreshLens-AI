# FreshLens database

Supabase-hosted PostgreSQL is the production/prototype database. Apply migrations
in filename order through the Supabase SQL editor or CLI.

## Authentication migration

`0001_auth_tenancy.sql` establishes the identity boundary:

- `auth.users` remains owned by Supabase Auth.
- `public.users` maps an authenticated identity to exactly one FreshLens role.
- Vendors must belong to one tenant; platform admins cannot carry a vendor tenant.
- `tenants` is the isolation root, so it has no `tenant_id`; this and the nullable
  admin `users.tenant_id` are the documented identity-table exceptions.
- RLS reads the transaction-local `app.*` values set by FastAPI. The trusted
  Supabase request claims are a fallback for explicitly permitted Data API calls.
- Vendor identity policies re-check tenant status on every query. Deactivating a
  tenant blocks its existing vendor context immediately; session revocation is
  still recommended to force a clean client logout.
- The custom access-token hook runs as its caller, and `supabase_auth_admin` gets
  SELECT-only column grants plus dedicated read policies. It adds signed
  `app_role` and `tenant_id` claims only for admins and active-tenant vendors.
- `freshlens_api` is a `NOLOGIN`, `NOBYPASSRLS` group for API grants and policies.

`0002_business_tables.sql` adds the mid-eval operational schema:

- Tenant-scoped `products`, `batches`, `scans`, `sales`, `sale_items`, `alerts`,
  and `device_tokens`, each with `tenant_id` + RLS in the same migration.
- Composite FKs `(id, tenant_id)` prevent cross-tenant product/batch links.
- `sales (tenant_id, idempotency_key)` is unique so sale retries cannot double-deduct.
- Vendor policies match `app.tenant_id` and require an active tenant; platform
  admins can read/write all business rows for catalogue/admin workflows.

`0003_scan_identity.sql` separates Tier-1 produce identity metadata from the
Tier-2 freshness fields on `scans`. This prevents identity confidence from being
reported as freshness confidence and allows unknown inputs to remain unlinked.

After applying `0001`, enable `public.custom_access_token_hook` under
**Authentication → Hooks → Custom Access Token**. Existing sessions must sign in
again before the new claims appear. Apply `0002` and then `0003` after `0001` on
hosted Supabase.

Do not connect FastAPI with `postgres`, a table owner, or `service_role` for
business queries: those identities bypass RLS. Create a secret production LOGIN,
grant it `freshlens_api`, and use the transaction helper in
`apps/api/app/core/database.py`. Hosted connections must use TLS; session-pooler
mode is the prototype default. See `docs/authentication.md` for the exact setup.

## Local PostgreSQL

Docker Compose initializes a new disposable development volume in this order:

1. `local/0000_supabase_compat.sql` creates only the Supabase-owned role/schema
   stubs needed by vanilla PostgreSQL.
2. `migrations/0001_auth_tenancy.sql` creates the identity schema/policies.
3. `migrations/0002_business_tables.sql` creates tenant-scoped operational tables
   with RLS in the same migration.
4. `migrations/0003_scan_identity.sql` adds Tier-1 identity result fields.
5. `local/0020_runtime_login.sql` creates the development-only
   `freshlens_api_local` login and grants it `freshlens_api`.

The API container connects as `freshlens_api_local`, never as the database owner.
Initialization scripts run only for a new Postgres volume. To recreate a
disposable local database after a migration change, stop Compose and explicitly
remove that development volume before starting it again. Never do that to a
volume containing data you need to retain.

Run the same two-tenant isolation test used by CI against a fresh local database:

```bash
export PGPASSWORD=freshlens
psql -h localhost -U freshlens -d freshlens \
  -v ON_ERROR_STOP=1 -f infra/db/tests/rls_isolation.sql
```

`local/0000_supabase_compat.sql` is for vanilla local PostgreSQL and CI only. Do
not apply it to hosted Supabase.
