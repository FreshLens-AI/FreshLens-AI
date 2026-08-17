# FreshLens Admin UI

Platform administration workspace for FreshLens. Supabase Auth protects every
admin route with the `platform_admin` role. Tenant profiles, product metadata,
alert signals, scan-pipeline totals, and analytics are loaded from authenticated
FastAPI admin endpoints. The current admin integration is read-only.

## Run locally

```bash
cd apps/web
npm install
cp .env.example .env.local
npm run dev
```

Add the Supabase project URL, publishable key, and `NEXT_PUBLIC_API_URL` to
`.env.local`; start the API, then open [http://localhost:3000](http://localhost:3000).
The admin layout fails explicitly when live API data cannot be loaded instead of
falling back to browser fixtures.

There is no admin signup. Create accounts out-of-band and provision them as
described in [`../../docs/authentication.md`](../../docs/authentication.md).

## Routes

| Route | Purpose |
|---|---|
| `/dashboard` | Platform overview and attention items |
| `/tenants` | Live tenant profiles and monthly aggregates |
| `/catalogue` | Live tenant product metadata and details |
| `/shelf-life` | Read-only tenant product shelf-life values |
| `/scans` | Aggregate queue and classification activity only |
| `/alerts` | Live tenant alert signals without batch identifiers |
| `/analytics` | Live platform and tenant-level aggregate trends |

Platform admins never receive raw vendor images, scan quantities, batches, or
inventory records in this UI. Tenant views deliberately expose aggregates only.

## Structure

```text
src/
  app/                  App Router pages and route-level states
    (auth)/             Login, access-denied, and server auth actions
    (admin)/            Shared admin shell route group
  components/
    layout/             Persistent navigation and top bar
    ui/                 Reusable primitives
    tenants/            Tenant list and aggregate detail workflow
    catalogue/          Product detail and shelf-life views
    alerts/             Read-only alert operations view
    analytics/          Aggregate charts and dashboards
    dashboard/          Overview composition
  lib/                  Formatting, navigation, and presentation helpers
    api/                Authenticated FastAPI clients and response mappers
    auth/               Signed claim parsing and secure route checks
    supabase/           Browser, server, and Proxy Supabase clients
  store/                Server-hydrated admin data provider
  types/                Shared domain models and exact V1 enums
```

Route files stay small and compose feature components. The admin layout loads a
typed snapshot from `/api/v1/admin/*` and passes it through the client provider.

## Checks

```bash
npm test
npm run lint
npm run typecheck
npm run build
```
