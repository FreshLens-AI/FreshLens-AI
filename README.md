# FreshLens

AI-powered, multi-tenant SaaS for small-scale grocery retailers. Vendors scan produce with a phone camera; a CNN classifies freshness (Fresh / Medium / Spoiled); dashboards show stock and spoilage alerts.

**Course:** CS3203 Software Engineering · **Group:** 21 · **PID:** 5

## Monorepo layout

```
apps/
  api/      FastAPI backend
  web/      Next.js admin dashboard
  mobile/   React Native (Expo) vendor app
packages/
  ml/       CNN training + Celery inference worker
infra/
  docker/   Docker Compose and Dockerfiles
  db/       SQL migrations and RLS policies
docs/       SRS, design, feasibility (course deliverables)
```

## Local services

```bash
cp .env.example .env
docker compose -f infra/docker/docker-compose.yml up --build
```

Fill in `SUPABASE_URL` before testing protected API routes. On a new local
PostgreSQL volume, Compose applies the identity migration and creates the
development-only `freshlens_api_local` login used by the API container. The
database owner is used only for initialization, never for application queries.

`DATABASE_URL` is for an API process running on the host (`localhost`). Compose
uses its own safe `postgres` hostname. Set `COMPOSE_DATABASE_URL` only when the
containerized API should connect to a hosted Supabase database through its
restricted session-pooler URI, and set `COMPOSE_DATABASE_SSL_MODE=require` to
enforce TLS. Full Supabase and account setup is documented
in [`docs/authentication.md`](docs/authentication.md).

### Authenticated admin UI

The platform-admin workflow uses Supabase Auth and browser-persisted demo data.
It does not require a running API yet, but it does require a provisioned
`platform_admin` account:

```bash
cd apps/web
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The routable workspace covers
tenant profiles, catalogue and shelf-life management, alert administration,
aggregate scan activity, and analytics. See [`apps/web/README.md`](apps/web/README.md)
for the route map and [`docs/authentication.md`](docs/authentication.md) for
Supabase setup and account provisioning.

## Team workflow

- **Branching:** GitHub Flow — `feat/*`, `fix/*`, `chore/*` off `main`
- **Tasks:** GitHub Issues linked to the org Project board
- **Reviews:** See [CONTRIBUTING.md](CONTRIBUTING.md)
- **Cursor AI rules:** `.cursor/rules/` (always-on) and `.cursor/skills/freshlens-workflow/` (project skill)

## Architecture rules (non-negotiable)

1. **Multi-tenancy via Postgres RLS** — vendor operational tables have a non-null `tenant_id` + RLS policy; identity roots use the documented admin exception
2. **Async inference only** — `POST /scan` returns `202`; CNN runs in Celery worker, never inline in API handlers

## Owners

| Area | Primary |
|------|---------|
| API, DB/RLS, infra | @buwaneka-halpage |
| Web admin | @SMS123456789 |
| Mobile app | @sathurshna |
| ML pipeline | shared |
