# 10. Size and Performance

This section ties SRS size and performance targets to architectural mechanisms.

## 10.1 Image size and scan acceptance

| Requirement | Mechanism |
|---|---|
| Image upload limit about 5 MB | API validates content length and rejects oversized bodies before enqueue |
| Scan acceptance within about 2 seconds after upload receipt | Handler stores image, inserts pending row, enqueues job, returns HTTP 202; no CNN in-process |
| At least 5 concurrent scan acceptances | Stateless API workers behind Compose/Uvicorn; Redis absorbs burst; DB inserts are short transactions |

Inference latency is intentionally excluded from the acceptance budget. Queue depth and model cost make classification time variable; clients poll or receive push when status becomes terminal.

## 10.2 Storage growth

Rough growth for scan images:

`stored_bytes ~= scans_per_day * average_image_bytes * retention_days`

PostgreSQL grows with scan metadata, alerts, sales, and batches, which are small relative to R2 image objects. Object lifecycle policies can shorten R2 retention without changing the relational model.

## 10.3 Sale latency

| Path | Budget characteristic |
|---|---|
| Manual / confirmed `POST /api/v1/sales` | Dominated by DB row locks, validation, and commit; no LLM call |
| `POST /api/v1/sales/voice-draft` | Dominated by external LLM latency; must not hold batch locks |
| Multi-item confirmed sale | One transaction locks all selected batches; V1 keeps item count bounded by what a vendor confirms in one submission |

Separating draft latency from deduction latency keeps inventory locks short and avoids holding stock locks while waiting on a model provider.

## 10.4 Throughput notes

Celery concurrency is scaled by worker replicas and broker capacity, not by lengthening the API request. Tenant-namespaced keys avoid accidental cross-tenant cache collisions but do not replace RLS.
