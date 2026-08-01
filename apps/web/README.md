# FreshLens Admin UI

Platform administration workspace for FreshLens. Supabase Auth protects every
admin route with the `platform_admin` role. The documented tenant, catalogue,
shelf-life, alert, scan-activity, and analytics workflows still use typed demo
data until their API endpoints land.

## Run locally

```bash
cd apps/web
npm install
cp .env.example .env.local
npm run dev
```

Add the Supabase project URL and publishable key to `.env.local`, then open
[http://localhost:3000](http://localhost:3000). Changes made through the forms
are persisted in browser `localStorage`; use **Reset demo data** at the bottom of
the navigation to restore the original fixtures.

There is no admin signup. Create accounts out-of-band and provision them as
described in [`../../docs/authentication.md`](../../docs/authentication.md).

## Routes

| Route | Purpose |
|---|---|
| `/dashboard` | Platform overview and attention items |
| `/tenants` | Tenant list, aggregate profile view, and profile editing |
| `/catalogue` | Produce catalogue list, creation, details, and editing |
| `/shelf-life` | Category shelf-life rules used by static aging alerts |
| `/scans` | Aggregate queue and classification activity only |
| `/alerts` | Alert list, creation, details, editing, acknowledgement, and dismissal |
| `/analytics` | Platform and tenant-level aggregate trends |

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
    tenants/            Tenant list, detail, and edit workflow
    catalogue/          Catalogue forms, detail, and shelf-life workflow
    alerts/             Alert administration workflow
    analytics/          Aggregate charts and dashboards
    dashboard/          Overview composition
  data/                 Stable, typed demo fixtures
  lib/                  Formatting, navigation, and presentation helpers
    api/                Server-only authenticated FastAPI client
    auth/               Signed claim parsing and secure route checks
    supabase/           Browser, server, and Proxy Supabase clients
  store/                Browser-persisted demo data provider
  types/                Shared domain models and exact V1 enums
```

Route files stay small and compose feature components. The data provider is the
replaceable boundary for future API integration.

## Checks

```bash
npm test
npm run lint
npm run typecheck
npm run build
```
