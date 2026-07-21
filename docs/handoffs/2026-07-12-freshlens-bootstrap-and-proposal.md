# Agent Handoff: FreshLens Bootstrap & Proposal

**Chat name:** FreshLens Bootstrap & Proposal  
**Date:** 2026-07-12  
**Repo:** [FreshLens-AI/FreshLens-AI](https://github.com/FreshLens-AI/FreshLens-AI)  
**Branch:** `main` (clean, up to date with origin)  
**HEAD:** `6208c20` — docs: add project proposal and update architecture data model (#27)

---

## What this chat accomplished

1. Digested project brief, schedule, and incomplete proposal; identified gaps (ML quantity story, CS3202 typo, missing stack items, mid-eval vs ML timeline).
2. Designed team GitHub workflow (GitHub Flow, Project board, ownership, milestones).
3. Bootstrapped empty repo:
   - Monorepo scaffold (`apps/`, `packages/`, `infra/`, `docs/`)
   - `CONTRIBUTING.md`, `CODEOWNERS`, issue/PR templates, CI stub
   - Labels, milestones M1–M5, 23 seeded issues (#2–#24)
   - Branch protection on `main` (PR + 1 review + CI check)
4. Added always-on Cursor rules + project skill so every session enforces patterns.
5. Reviewed enhanced proposal; copied to `docs/proposal/proposal.tex`; updated architecture rule for `batches` + FL-2TC; closed issue #2 via PR #27.

---

## Non-negotiables (already in `.cursor/rules/`)

| Rule | File |
|------|------|
| Stack, monorepo paths, ownership | `.cursor/rules/freshlens-core.mdc` |
| RLS + async scan + `batches` | `.cursor/rules/freshlens-architecture.mdc` |
| GitHub Flow / milestones / agent git behaviour | `.cursor/rules/freshlens-git-workflow.mdc` |
| DB migrations (when editing `infra/db/**`) | `.cursor/rules/freshlens-database.mdc` |
| API/ML conventions (when editing api/ml) | `.cursor/rules/freshlens-api-ml.mdc` |
| Full workflow skill | `.cursor/skills/freshlens-workflow/SKILL.md` |

**Architecture:** Postgres RLS (`tenant_id`); `POST /scan` → 202 → Celery; never sync CNN in handlers; Redis `tenant:{id}:...`; V1 = one product/photo + vendor-confirmed quantity; FL-2TC (Tier 1 identify, Tier 2 Fresh/Medium/Spoiled).

**Core tables:** `tenants` → `users`, `products`, `scans`, `batches`, `alerts`.

---

## Team

| GitHub | Role / area |
|--------|-------------|
| @buwaneka-halpage (owner) | API, DB/RLS, infra |
| @SMS123456789 | Web admin |
| @sathurshna | Mobile |

Org: `FreshLens-AI`. Mentor on org: `kavindasr` (not a coding assignee).

---

## Still open for the user / next agent

### Manual (user must do)
- [ ] Link open issues to the org **GitHub Project** board (`gh` token lacked `project` scope — run `gh auth refresh -s read:project,project` then link).
- [ ] Confirm proposal PDF was **submitted** to department (issue #2 closed in repo; submission is external).
- [ ] Optional: enable “Require review from Code Owners” in branch protection UI.

### Near-term work (M1 due Jul 12 — today)
- Issue **#3** — Feasibility study (`docs/feasibility/`) — assignee @sathurshna
- Issue **#4** — Schedule / Gantt in `docs/` — assignee @buwaneka-halpage

### Next build track (after M1 / into M2–M3)
Suggested first coding issues (parallel):
- **#7** Scaffold FastAPI — @buwaneka-halpage
- **#8** DB schema + RLS — @buwaneka-halpage (serialize; P0)
- **#9** Next.js scaffold — @SMS123456789
- **#10** Expo mobile + camera — @sathurshna
- **#5–#6** SRS + architecture design docs (M2, due Aug 9)

Mid-eval (Aug 30): stub ML OK; real FL-2TC is M4.

---

## Key paths

```
docs/proposal/proposal.tex     # CS3203 proposal source
CONTRIBUTING.md                # human workflow
.cursor/rules/*.mdc            # always-on AI enforcement
infra/docker/docker-compose.yml  # postgres + redis stubs only
apps/{api,web,mobile}/         # empty (.gitkeep)
packages/ml/                   # empty (.gitkeep)
```

Companion docs referenced by proposal but **not yet in repo:** Feasibility Analysis, Enterprise Architecture Plan.

---

## How to continue

1. Read this handoff + `.cursor/rules/` (auto-loaded).
2. Prefer feature branch + PR; never push straight to `main`.
3. Link work to GitHub issues (`Closes #N`).
4. If starting code: pick #7/#8 (API+DB) or ask user which track.

**Do not:** introduce NestJS, sync inference, second queue, tables without RLS, commit secrets.
