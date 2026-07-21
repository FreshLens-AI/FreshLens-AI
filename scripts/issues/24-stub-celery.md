## Context

Mid-evaluation (through 30 Aug) allows **stubbed** classification. Real FL-2TC training stays on #16 / #17 (M4).

Gantt: *Implement stub Celery classifier for mid-evaluation* (2026-08-01 → 2026-08-14).

## Acceptance criteria

- [ ] Celery worker runs in Docker Compose alongside API + Redis
- [ ] Job accepts scan id / image path and writes a deterministic stub result (Fresh / Medium / Spoiled)
- [ ] Redis keys are tenant-namespaced: `tenant:{tenant_id}:...`
- [ ] No CNN loaded in the API process; inference only in the worker
- [ ] Compatible with `POST /scan` → 202 flow (#12)

## Out of scope

Real Tier-1 / Tier-2 models — replace stub in M4 (#17).
