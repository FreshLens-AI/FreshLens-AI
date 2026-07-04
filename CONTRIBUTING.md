# Contributing to FreshLens

Guidelines for Group 21 (CS3203, PID 5). Keep process light; follow the rules that protect tenant isolation and async ML.

## Branching (GitHub Flow)

| Branch | Pattern | Example |
|--------|---------|---------|
| Production | `main` | always deployable / `docker compose up` works |
| Feature | `feat/<area>-<short-desc>` | `feat/api-scan-endpoint` |
| Fix | `fix/<area>-<short-desc>` | `fix/web-tenant-filter` |
| Docs | `docs/<topic>` | `docs/srs-architecture` |
| Infra / CI | `chore/<topic>` | `chore/ci-lint` |

**Rules**

1. Never commit directly to `main` — open a PR.
2. One issue per branch; reference the issue in the PR (`Closes #N`).
3. Keep PRs small (aim &lt; 400 lines). Split large work.
4. Rebase or merge `main` into your branch daily if the branch lives more than a day.
5. Delete the branch after merge.

### Commit messages

```
feat(api): add POST /scan with 202 async response
fix(web): correct tenant filter on dashboard
chore(ci): add RLS isolation test job
docs: add SRS architecture diagram
```

## Pull requests

1. Open PR against `main`.
2. Fill in the PR template (what, issue link, how to test).
3. Request review from the **area owner** (see CODEOWNERS).
4. **Squash merge** after CI passes and at least one approval.

### Review SLA

Review teammate PRs within **24 hours** on weekdays. Comment or approve; do not leave PRs idle.

### Special review rules

| Change | Required approver |
|--------|-------------------|
| `infra/db/` migrations or RLS | @buwaneka-halpage |
| Org settings / branch protection | @buwaneka-halpage |
| Everything else | 1 teammate (prefer area owner) |

## Code review checklist

Reviewers should verify:

- [ ] No secrets in diff (`.env`, keys, tokens)
- [ ] New DB tables have `tenant_id` + RLS policy in the **same migration**
- [ ] No synchronous CNN inference in API request handlers
- [ ] Redis keys use tenant namespace: `tenant:{tenant_id}:...`
- [ ] CI is green

## Area ownership

| Path | Primary | Secondary |
|------|---------|-----------|
| `apps/api/` | @buwaneka-halpage | @SMS123456789 |
| `infra/db/` | @buwaneka-halpage | — |
| `infra/docker/` | @buwaneka-halpage | @SMS123456789 |
| `apps/web/` | @SMS123456789 | @sathurshna |
| `apps/mobile/` | @sathurshna | @buwaneka-halpage |
| `packages/ml/` | @buwaneka-halpage | @SMS123456789 |

Primary owner reviews PRs in that area. Secondary can implement; primary should approve.

## Issues and project board

- Every task is a **GitHub Issue** on this repo.
- Add issues to the org **GitHub Project** (FreshLens board).
- Set **milestone**, **labels** (`area:*`, `type:*`), and **assignee** before moving to *In Progress*.

### Definition of Ready

- Acceptance criteria written (checkboxes in issue body)
- Assignee set
- Dependencies linked (if blocked by another issue)
- Fits in one PR when possible

### Definition of Done

- PR merged to `main`
- CI green
- Locally testable (`docker compose` or documented steps)
- README or docs updated if behaviour changed

## Labels

| Label | Use |
|-------|-----|
| `type: feature` | New functionality |
| `type: bug` | Broken behaviour |
| `type: chore` | Tooling, CI, refactor |
| `type: docs` | SRS, design, proposal |
| `type: spike` | Time-boxed research |
| `area: api` | FastAPI backend |
| `area: web` | Next.js admin |
| `area: mobile` | React Native / Expo |
| `area: ml` | Training + inference worker |
| `area: infra` | Docker, CI |
| `area: db` | Schema, RLS |
| `priority: P0` | Blocker |
| `priority: P1` | Important |
| `priority: P2` | Nice to have |
| `status: blocked` | Waiting on dependency |

## Local setup

```bash
git clone git@github.com:FreshLens-AI/FreshLens-AI.git
cd FreshLens-AI
cp .env.example .env
docker compose -f infra/docker/docker-compose.yml up -d
```

## Team rituals

| Ritual | When | Duration |
|--------|------|----------|
| Planning | Start of each 2-week block | ~45 min |
| Sync | Tue + Fri | ~15 min |
| Milestone demo | End of each milestone | ~30 min |

Use GitHub Issues/Discussions for decisions — link the issue in chat so context is not lost.

## Architecture rules (do not break)

1. **Multi-tenancy via RLS** — `tenant_id` on every business table; policy uses `current_setting('app.tenant_id')`.
2. **Async inference** — `POST /scan` uploads image, enqueues Celery job, returns `202`. CNN runs in worker only.

## Secrets

- Never commit `.env`
- Use `.env.example` for documented placeholders
- Repo/org secrets for CI are managed by @buwaneka-halpage in GitHub Settings
