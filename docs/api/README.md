# FreshLens API

**V1** HTTP contract for mobile (Expo), web (Next.js), and backend (FastAPI).

| File | Role |
|------|------|
| [`v1/openapi.yaml`](v1/openapi.yaml) | Machine-readable OpenAPI 3.1, the **source of truth** for paths and schemas |

Implementation issues: [#7](https://github.com/FreshLens-AI/FreshLens-AI/issues/7) FastAPI scaffold · [#9](https://github.com/FreshLens-AI/FreshLens-AI/issues/9) auth · [#12](https://github.com/FreshLens-AI/FreshLens-AI/issues/12) async scan · SRS [#38](https://github.com/FreshLens-AI/FreshLens-AI/issues/38).

Architecture rules: [`.cursor/rules/freshlens-architecture.mdc`](../../.cursor/rules/freshlens-architecture.mdc).

## Conventions

| Topic | Rule |
|-------|------|
| Base path | Versioned resources under `/api/v1` |
| Auth | `Authorization: Bearer <Supabase JWT>` on all routes except `GET /health` |
| Tenant | Middleware sets Postgres `app.tenant_id` from the JWT (UUID). **Never** trust `tenant_id` in the request body |
| Roles | `vendor` \| `platform_admin` |
| Errors | FastAPI-shaped `{ "detail": string \| object }`: 401 / 403 / 404 / 409 / 422 |
| IDs | UUID strings |
| Classification | `fresh` \| `medium` \| `spoiled` |
| Scan status | `pending` \| `processing` \| `completed` \| `failed` |
| Inference | **Async only**: no CNN inside request handlers. Redis keys (when used): `tenant:{tenant_id}:...` |
| Sales | `POST /api/v1/sales` is the only stock-deduction endpoint. Every request requires an `Idempotency-Key` |

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

## Sale entry flows

```text
Manual: list products and batches -> fill form -> confirm -> POST /sales -> atomic deduction -> low-stock evaluation
Voice: microphone -> device speech-to-text -> POST /sales/voice-draft -> vendor resolves products and batches -> confirm -> POST /sales
```

Manual entry remains available. Every sale item requires a resolved product, a vendor-selected batch, and explicit confirmation. The required `source` value records `manual` or `voice` provenance only and never affects tenant authorization. `POST /api/v1/sales` commits all items atomically and prevents negative batch quantities. For the same tenant, retrying the same idempotency key with the same payload returns the original successful result without another deduction; reusing the key with a different payload returns 409.

Voice parsing uses one provider-neutral LLM parser for final V1 sale drafting. Its output is untrusted and must be validated. The LLM has no persistence access, and `POST /api/v1/sales/voice-draft` cannot change inventory. Raw audio and transcripts are not retained by default.

After a sale commits, clients use `GET /api/v1/products`, `GET /api/v1/batches`, and `GET /api/v1/alerts` to retrieve authoritative stock and alert data.

## Endpoints (V1)

| Method | Path | Role | Response |
|--------|------|------|----------|
| `GET` | `/health` | public | `200` `{ "status": "ok" }` |
| `POST` | `/api/v1/scans` | vendor | **`202`** `ScanAccepted` |
| `GET` | `/api/v1/scans/{scan_id}` | vendor | `200` `Scan` |
| `GET` | `/api/v1/scans` | vendor | `200` `ScanList` |
| `GET` | `/api/v1/alerts` | vendor | `200` `AlertList` (empty OK until #19) |
| `GET` | `/api/v1/products` | vendor | `200` `ProductList` |
| `GET` | `/api/v1/batches` | vendor | `200` `BatchList` |
| `POST` | `/api/v1/sales` | vendor | `201` `Sale` |
| `POST` | `/api/v1/sales/voice-draft` | vendor | `200` `VoiceSaleDraft` |
| `GET` | `/api/v1/admin/tenants` | platform_admin | `200` `TenantList` (web scaffold) |

## Out of scope (later)

Presigned R2 upload · webhooks · real FL-2TC model payloads · alert CRUD · product/batch full CRUD · analytics dashboards.

## Viewing the OpenAPI

- VS Code / Cursor: OpenAPI / Swagger preview extensions
- [Swagger Editor](https://editor.swagger.io/): paste `v1/openapi.yaml`
- After FastAPI lands, prefer generating or mirroring this file from Pydantic models so the contract stays honest
