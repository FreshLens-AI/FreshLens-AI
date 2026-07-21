---
name: freshlens-workflow
description: >-
  Enforces FreshLens (CS3203 PID 5) team workflow, monorepo layout, GitHub Flow
  branching, architecture rules (Postgres RLS, async Celery ML), and area ownership.
  Use for any FreshLens development, scaffolding, PRs, issues, migrations, API,
  mobile, web, or ML work in this repository.
---

# FreshLens Workflow

Read this skill when implementing features, reviewing code, or planning work in FreshLens-AI.

## Quick reference

| Topic | Source |
|-------|--------|
| Full team guide | [CONTRIBUTING.md](../../CONTRIBUTING.md) |
| Always-on rules | [.cursor/rules/](../../rules/) |
| PR template | [.github/pull_request_template.md](../../.github/pull_request_template.md) |
| Code owners | [.github/CODEOWNERS](../../.github/CODEOWNERS) |

## Implementation checklist

Before writing code:

1. Confirm which `apps/` or `packages/` path owns the change
2. Check open [GitHub Issues](https://github.com/FreshLens-AI/FreshLens-AI/issues) — work from an issue
3. Branch: `feat/<area>-<short-desc>` from `main`
4. Verify change does not violate architecture rules below

After writing code:

1. Open PR with issue link (`Closes #N`)
2. Fill PR template checklist (secrets, RLS, async inference, Redis namespace)
3. Request review from CODEOWNERS area owner
4. Ensure CI passes before merge

## Architecture (non-negotiable)

1. **RLS multi-tenancy** — `tenant_id` + policy on every business table, same migration
2. **Async inference** — `POST /scan` → 202; CNN only in Celery worker
3. **Stack locked** — FastAPI, Postgres, Supabase Auth, Next.js, Expo, Celery+Redis, R2

## Forbidden

- NestJS/Node backend
- Sync inference in API handlers
- Second queue system
- Un-namespaced Redis keys
- DB tables without RLS
- Committing `.env` or secrets

## Area ownership

| Path | Primary reviewer |
|------|------------------|
| `apps/api/`, `infra/db/`, `infra/docker/` | @buwaneka-halpage |
| `apps/web/` | @SMS123456789 |
| `apps/mobile/` | @sathurshna |
| `packages/ml/` | @buwaneka-halpage, @SMS123456789 |

## Milestones

- **M1** (Jul 12) — Proposal, feasibility, schedule
- **M2** (Aug 9) — SRS + design
- **M3** (Aug 30) — Iteration 1, mid-eval (stub ML acceptable)
- **M4** (Oct 2) — CNN + Celery + alerts (through Progress Review 2)
- **M5** (Oct 3) — Testing, demo video, final report

## Mid-eval note

Mid-evaluation (Aug 30) targets auth + DB + UI + async scan flow with **stubbed** classification. Real ML starts in M4.

## Creating new GitHub tasks

When seeding issues, use labels: `type:*`, `area:*`, `priority:*`, assign milestone M1–M5, set acceptance criteria as checkboxes.

Scripts: `scripts/create-issues.cmd`, `scripts/seed-github.ps1`
