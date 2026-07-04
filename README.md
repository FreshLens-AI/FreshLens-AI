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

## Quick start (after scaffold is complete)

```bash
cp .env.example .env
docker compose -f infra/docker/docker-compose.yml up --build
```

## Team workflow

- **Branching:** GitHub Flow — `feat/*`, `fix/*`, `chore/*` off `main`
- **Tasks:** GitHub Issues linked to the org Project board
- **Reviews:** See [CONTRIBUTING.md](CONTRIBUTING.md)

## Architecture rules (non-negotiable)

1. **Multi-tenancy via Postgres RLS** — every business table has `tenant_id` + RLS policy
2. **Async inference only** — `POST /scan` returns `202`; CNN runs in Celery worker, never inline in API handlers

## Owners

| Area | Primary |
|------|---------|
| API, DB/RLS, infra | @buwaneka-halpage |
| Web admin | @SMS123456789 |
| Mobile app | @sathurshna |
| ML pipeline | shared |
