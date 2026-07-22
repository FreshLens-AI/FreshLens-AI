# FreshLens API

Mid-eval **V1** HTTP contract for mobile (Expo), web (Next.js), and backend (FastAPI).

| File | Role |
|------|------|
| [`v1/openapi.yaml`](v1/openapi.yaml) | Machine-readable OpenAPI 3.1 — **source of truth** for paths and schemas |

Implementation issues: [#7](https://github.com/FreshLens-AI/FreshLens-AI/issues/7) FastAPI scaffold · [#9](https://github.com/FreshLens-AI/FreshLens-AI/issues/9) auth · [#12](https://github.com/FreshLens-AI/FreshLens-AI/issues/12) async scan · SRS [#38](https://github.com/FreshLens-AI/FreshLens-AI/issues/38).

Architecture rules: [`.cursor/rules/freshlens-architecture.mdc`](../../.cursor/rules/freshlens-architecture.mdc).

## Conventions

| Topic | Rule |
|-------|------|
| Base path | Versioned resources under `/api/v1` |
| Auth | `Authorization: Bearer <Supabase JWT>` on all routes except `GET /health` |
| Tenant | Middleware sets Postgres `app.tenant_id` from the JWT (UUID). **Never** trust `tenant_id` in the request body |
| Roles | `vendor` \| `platform_admin` |
| Errors | FastAPI-shaped `{ "detail": string \| object }` — 401 / 403 / 404 / 422 |
| IDs | UUID strings |
| Classification | `fresh` \| `medium` \| `spoiled` |
| Scan status | `pending` \| `processing` \| `completed` \| `failed` |
| Inference | **Async only** — no CNN inside request handlers. Redis keys (when used): `tenant:{tenant_id}:...` |

## Async scan flow

```text
Mobile                API                 R2 / DB / Celery
  |                    |                        |
  |-- POST /api/v1/scans (multipart) ---------->|
  |                    |-- store image -------->|
  |                    |-- insert scan pending ->|
  |                    |-- enqueue job -------->|
  |<-- 202 { id, status, created_at } ----------|
  |                    |                        |
  |-- GET /api/v1/scans/{id} (poll) ----------->|
  |<-- 200 Scan (null classification while pending)
  |                    |    worker writes stub  |
  |-- GET /api/v1/scans/{id} ------------------>|
  |<-- 200 Scan (classification + score) -------|
```

V1: **one product per photo**; `quantity` is vendor-confirmed at submit time.

## Endpoints (V1 mid-eval)

| Method | Path | Role | Response |
|--------|------|------|----------|
| `GET` | `/health` | public | `200` `{ "status": "ok" }` |
| `POST` | `/api/v1/scans` | vendor | **`202`** `ScanAccepted` |
| `GET` | `/api/v1/scans/{scan_id}` | vendor | `200` `Scan` |
| `GET` | `/api/v1/scans` | vendor | `200` `ScanList` |
| `GET` | `/api/v1/alerts` | vendor | `200` `AlertList` (empty OK until #19) |
| `GET` | `/api/v1/admin/tenants` | platform_admin | `200` `TenantList` (web scaffold) |

## Out of scope (later)

Presigned R2 upload · webhooks · real FL-2TC model payloads · alert CRUD · product/batch full CRUD · analytics dashboards.

## Viewing the OpenAPI

- VS Code / Cursor: OpenAPI / Swagger preview extensions
- [Swagger Editor](https://editor.swagger.io/) — paste `v1/openapi.yaml`
- After FastAPI lands, prefer generating or mirroring this file from Pydantic models so the contract stays honest
