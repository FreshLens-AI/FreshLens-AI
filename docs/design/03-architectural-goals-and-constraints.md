# 3. Architectural goals and constraints

This section records the goals that drive FreshLens V1 architecture and the constraints that force specific mechanisms. Each constraint ends with its architectural consequence.

## 3.1 Architectural goals

| Goal | Meaning for V1 |
|---|---|
| Tenant isolation | One vendor organization cannot read or write another vendor's rows |
| Responsive scan acceptance | Capture and submit return quickly; classification happens later |
| Correct stock after sale | Confirmed sales deduct stock once, never below zero, then feed low-stock alerts |
| Safe voice assistance | Speech helps drafting only; inventory changes require vendor confirmation |
| Course-deliverable stack | Stay on the approved FastAPI, Postgres, Celery, Expo, Next.js path |
| Honest baseline | Distinguish what `main@a460540` already runs from what V1 still targets |

## 3.2 Technical constraints

### 3.2.1 Multi-tenancy via PostgreSQL RLS

Constraint: Every business table carries `tenant_id`, and RLS policies use `current_setting('app.tenant_id')` in the same migration that creates the table (DR-001 through DR-012).

Consequence: API middleware must set `app.tenant_id` from the validated JWT before business queries. Application-level tenant filters are defense in depth only.

### 3.2.2 Asynchronous inference

Constraint: CNN or stub classification must not run inside a FastAPI request handler (FR-S-001, FR-S-008).

Consequence: `POST /api/v1/scans` stores the image, inserts a pending scan, enqueues a Celery job on Redis with tenant-namespaced keys, and returns HTTP 202. The worker owns classification and result persistence.

### 3.2.3 Shared sales service

Constraint: Only `POST /api/v1/sales` through the shared sales service may deduct `batches.quantity_remaining` (FR-S-014, DR-010, DR-011).

Consequence: Manual mid-evaluation forms and final voice confirmation both call the same sales path. Scan flows and LLM parsing cannot mutate stock.

### 3.2.4 Sale atomicity and idempotency

Constraint: Sale submission is atomic and idempotent under `Idempotency-Key`. Selected batches are locked and validated so quantities cannot become negative (NFR-R-005).

Consequence: The sales service runs deduction and related alert evaluation inside one database transaction. Retries with the same key return the original result without a second deduction.

### 3.2.5 LLM draft boundary

Constraint: Final V1 may use device speech-to-text and one provider-neutral LLM transcript parser. The parser returns an untrusted draft only and has no inventory persistence access (FR-S-015, NFR-SEC-007, DR-012 related privacy).

Consequence: `POST /api/v1/sales/voice-draft` never writes stock. Mobile resolves products, selects batches, and requires explicit confirmation before calling the shared sales API. Raw audio and transcripts are not retained by default.

### 3.2.6 Locked technology stack

Constraint: Approved stack only: FastAPI, PostgreSQL + RLS, Supabase Auth (prototype), Next.js, Expo, Celery + Redis, Cloudflare R2, Docker Compose, GitHub Actions.

Consequence: Do not introduce a Node backend, a second queue system, or sync inference. New external capability is limited to the constrained LLM parser above.

### 3.2.7 Privacy and secrets

Constraint: No secrets in git. Prefer minimum retention of sale speech artifacts.

Consequence: Configuration uses environment variables documented in `.env.example`. Voice flows discard audio and transcripts after draft creation unless a later requirement explicitly changes that policy.

## 3.3 Schedule and ownership constraints

Milestone M2 (due 9 August) requires SRS and architecture design. M3 adds auth, DB+RLS, UI skeleton, and stub ML. M4 adds real CNN, Celery, and alerts. Ownership follows CODEOWNERS: API/DB/infra for @buwaneka-halpage, web for @SMS123456789, mobile for @sathurshna, ML shared.

Consequence: The SAD must be reviewable for M2 without claiming unimplemented packages as finished. Implementation issues #80 through #84 and #19 track the sales and alert work after design approval.

## 3.4 Out of scope that shapes V1

IoT scales, automated procurement, accounting modules, multi-item image detection, and learned rot-date prediction are out of scope for V1. Architecture therefore models one product per photo, static aging from admin-configured shelf life, and sale-driven stock changes rather than hardware-driven inventory sensors.
