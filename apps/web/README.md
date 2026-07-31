# FreshLens Admin UI

Frontend-only platform administration workspace for FreshLens. It implements the
documented tenant, catalogue, shelf-life, alert, scan-activity, and analytics
workflows with typed demo data. Authentication and API integration are intentionally
out of scope for this feature.

## Run locally

```bash
cd apps/web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Changes made through the forms
are persisted in browser `localStorage`; use **Reset demo data** at the bottom of
the navigation to restore the original fixtures.

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
  store/                Browser-persisted demo data provider
  types/                Shared domain models and exact V1 enums
```

Route files stay small and compose feature components. The data provider is the
replaceable boundary for future API integration.

## Checks

```bash
npm run lint
npm run typecheck
npm run build
```
