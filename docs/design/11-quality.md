# 11. Quality

For each quality attribute class in the SRS, this section names the architectural mechanism that carries it.

## 11.1 Reliability

| Requirement theme | Mechanism |
|---|---|
| Scan acceptance despite slow ML | HTTP 202 + Celery; failed jobs mark scan `failed` without blocking the API process |
| Sale atomicity and idempotency (NFR-R-005) | Single DB transaction; unique tenant idempotency key; batch row locks; reject oversell |
| Push flakiness | Persist alerts first; push is best-effort wake-up |

## 11.2 Security

| Requirement theme | Mechanism |
|---|---|
| Authenticated API access | Supabase JWT validation on protected routes |
| Tenant isolation (NFR-SEC-003) | `app.tenant_id` + Postgres RLS on every business table |
| No tenant id from body | Middleware reads claims only |
| Redis key safety (NFR-SEC-006) | `tenant:{tenant_id}:...` namespaces |
| LLM cannot mutate inventory (NFR-SEC-007) | Voice-draft endpoint is read-only toward stock; no DB credentials for the model |

## 11.3 Privacy

Voice flows send transcript text to the parser and discard raw audio and transcripts by default. Sale records store confirmed product, batch, and quantity only. Scan images live in R2 under tenant-scoped paths and are not required for sale deduction.

## 11.4 Maintainability and portability

Layered packages and OpenAPI keep client and server contracts explicit (Section 5.4 styles and patterns). Stub versus FL-2TC share `FreshnessClassifier` (strategy pattern), so mid-evaluation demos can swap implementations without rewriting routers. Compose packages API, worker, Redis, and Postgres for local portability. Provider-neutral LLM adapter limits lock-in to one interface.

## 11.5 Extensibility

V2 features such as multi-item detection or learned rot dates can extend the worker and schema without changing the 202 scan acceptance pattern or the shared sales service rule. A second queue system is deliberately disallowed to avoid split operational semantics.

## 11.6 Usability

| Requirement theme | Mechanism |
|---|---|
| Explicit sale confirmation (NFR-U-009) | Manual form and voice draft review both require confirm before `POST /api/v1/sales` |
| Microphone / STT problems | Fallback to manual Record Sale (FR-V-011) |
| Async scan feedback | Pending and processing states in UI; push on completion |

## 11.7 Shared business logic

Stock deduction, low-stock evaluation inputs, and RLS context are centralized so mid-evaluation UI and final voice UI cannot diverge on inventory rules. That shared path is the quality backbone for FR-S-014 through FR-S-016.
