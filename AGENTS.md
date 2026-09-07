# FreshLens-AI — Agent Guide

Guidance for AI coding agents working in this repository. Package-specific notes live in `apps/web/AGENTS.md` and `apps/mobile/AGENTS.md`; this file covers the whole monorepo.

## What this project is

FreshLens is a multi-tenant SaaS for small grocery retailers (CS3203 Group 21, PID 5). A vendor scans produce with a phone; a two-tier CNN pipeline classifies identity (Model 1: YOLO26n-cls — banana/cucumber/eggplant/tomato/unknown @ 0.75 confidence) then freshness (Model 2: fresh/medium/spoiled @ 0.50); results feed dashboards and alerts. Repo: `FreshLens-AI/FreshLens-AI` (public, default branch `main`).

## Monorepo layout

| Path | Stack | Purpose |
|---|---|---|
| `apps/api` | FastAPI 0.116, Python 3.12, asyncpg, PyJWT, Celery | REST API (`/api/v1`), auth, tenant context, scan/sales orchestration |
| `apps/web` | Next.js 16.2, React 19, @supabase/ssr | Vendor dashboard + admin UI (deliberately read-only, aggregate-only) |
| `apps/mobile` | Expo ~57, React Native 0.86 | Vendor scanning app |
| `packages/ml` | ultralytics, Celery worker | CNN inference worker + training scripts |
| `infra/db/migrations` | SQL | Schema migrations (0001 auth_tenancy, 0002 business_tables, 0003 scan_identity) |
| `infra/docker` | docker-compose (postgres:16 + redis:7 + api + worker) | Local stack |
| `docs` | — | SRS, SAD, `api/v1/openapi.yaml` (API contract source of truth), `schedule/gantt-tasks.yaml` (project timeline) |
| `scripts` | PowerShell/bash | GitHub seeding, branch protection, vendor provisioning |

## Commands

```bash
# Full local stack
docker compose --env-file .env -f infra/docker/docker-compose.yml up --build

# API — NOTE: requires a Python 3.12 venv (source apps/api/.venv312/bin/activate);
# the old 3.9 venv breaks on typing.Self
cd apps/api && pytest

# ML worker / training
cd packages/ml && pytest

# Web (Node 22)
cd apps/web && npm test && npm run lint && npm run typecheck

# Mobile
cd apps/mobile && npm test && npm run typecheck
```

## Non-negotiable architecture rules

These are invariants — do not weaken them, and flag any change that would:

1. **Tenant isolation via Postgres RLS.** Every business table gets, in the SAME migration: `tenant_id UUID NOT NULL REFERENCES tenants(id)`, `ENABLE ROW LEVEL SECURITY`, a policy `USING (tenant_id = current_setting('app.tenant_id')::uuid)`, and an index on `tenant_id`. Identity-root exception: `tenants` itself; `users.tenant_id` is nullable only for `platform_admin` (DB-constrained).
2. **Restricted DB role.** The API connects as `freshlens_api_runtime` (hosted) / `freshlens_api_local` (dev), in the NOBYPASSRLS group `freshlens_api`. Startup guard `assert_safe_database_role` rejects superuser/BYPASSRLS connections. Per-request transactions set `app.tenant_id` / `app.user_id` / `app.user_role` via `set_config`.
3. **Async inference only.** `POST /api/v1/scans` returns 202; the Celery worker in `packages/ml` runs the CNN. Never run inference inline in a request handler.
4. **Sales invariants.** `POST /api/v1/sales` is the ONLY stock-deduction path — atomic, idempotent via `Idempotency-Key` (unique `(tenant_id, idempotency_key)`; same key + same payload → replay, same key + different payload → 409), never lets batches go negative, tenant derived from JWT, never from the request body.
5. **Auth trust boundary.** Supabase Auth is the IdP only. JWTs are verified via JWKS in `SupabaseAuthMiddleware`; only the signed claims `app_role` (`vendor` | `platform_admin`) and `tenant_id` are trusted.
6. **Redis keys** are namespaced `tenant:{tenant_id}:...`.
7. **Voice/LLM drafting** returns an untrusted draft only — no audio retention, never mutates inventory directly.
8. **Never introduce:** a Node/Nest backend, a second queue system, secrets committed to git.

## Migrations and the database

- Numbered SQL files in `infra/db/migrations`; serialize them (coordinate before adding one).
- RLS setup must land in the same migration as the table — never a follow-up.
- PRs touching `infra/db` require @buwaneka-halpage review (CODEOWNERS).
- RLS isolation is enforced in CI against postgres:16 with `infra/db/tests/rls_isolation.sql` and `runtime_role.sql`.

## Git workflow

- GitHub Flow. Branches: `feat/<area>-<desc>`, `fix/...`, `docs/...`, `chore/...`. Never commit directly to `main`.
- Conventional commits with scopes: `api|web|mobile|ml|infra|db` (e.g. `feat(api): add scan status endpoint`).
- PRs: < 400 lines, body includes `Closes #N`, squash merge after CI green + 1 approval.
- Labels: `type:*`, `area:*`, `priority: P0|P1|P2`.
- CODEOWNERS: api/db/infra/docker/ml → @buwaneka-halpage (web secondary), web → @SMS123456789, mobile → @sathurshna.

## CI

`.github/workflows/ci.yml` runs 6 jobs: `repository-structure` (the branch-protection gate), `api-test` (Python 3.12), `ml-test`, `web-test` (Node 22), `mobile-test`, `rls-isolation` (postgres:16). Keep all six green.

## Authority documents

When docs and code disagree, check these first:

- `docs/api/v1/openapi.yaml` — API contract source of truth.
- `docs/design/FreshLens-SAD.md` — system architecture.
- `docs/authentication.md` — auth flow.
- `docs/schedule/gantt-tasks.yaml` — course timeline (see below).

## Timeline (as of Sept 2026 — mid Iteration 2)

Two numbering schemes exist; don't confuse them. GitHub milestones M1–M5 track deliverables (M4 "Iteration 2: ML + integration" due 2026-10-02, M5 testing/final due 2026-10-03). The gantt file uses course milestones M1–M7 (M5 testing doc due 09-27, M6 final report + zip 10-03, M7 final eval 10-11). Near-term gantt deadlines: datasets 09-05, Tier-1 training 09-12, Tier-2 09-15, FL-2TC worker integration 09-22, alerts + analytics + RLS isolation tests + e2e validation ~09-25.

Known open work (see GitHub issues): R2 object storage (#18 — currently local-disk `ObjectStorageClient`), `POST /sales/voice-draft` documented in openapi.yaml but unimplemented (#81, mobile #84), CUDA retraining of CPU-baseline checkpoints, device-captured release dataset, plus #14 #16 #17 #21 #22 #23 #24.
