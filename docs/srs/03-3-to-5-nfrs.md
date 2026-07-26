# 3.3 to 3.5 Reliability, performance and security, supportability

Issue: [#40](https://github.com/FreshLens-AI/FreshLens-AI/issues/40). Priority: Must (P0).

## 3.3 Reliability

### NFR-R-001 Availability of accept path (Must)

Under normal prototype load (single Docker Compose deployment), the scan accept path (`POST /api/v1/scans` returning 202) shall remain available independently of inference duration. A slow or busy worker shall not block acceptance beyond the performance limits in NFR-P-001.

### NFR-R-002 Failed classification (Must)

If background classification fails, the system shall mark the scan `failed` rather than leaving it indefinitely in `processing` without a terminal state. Vendors shall be able to observe `failed` via GET scan.

### NFR-R-003 Classification accuracy caveats (Must)

For mid-evaluation, stub classification accuracy is not scored. For the final FL-2TC demonstration, the team shall report Precision/Recall (or equivalent) in the final report. This SRS does not mandate a minimum accuracy threshold beyond "trained model integrated and producing valid labels."

### NFR-R-004 Tenant data durability (Must)

Scan metadata and classification results shall persist in PostgreSQL across API process restarts. Image bytes shall persist in object storage under the stored `image_path`.

## 3.4 Performance and security

### NFR-P-001 Scan acceptance latency (Must)

For a valid authenticated scan request with image size <= 5 MB, the API shall return HTTP 202 within 2 seconds on the local/prototype environment (excluding client upload bandwidth extremes), measured from request fully received to response sent, excluding CNN runtime.

### NFR-P-002 Inference decoupling (Must)

End-to-end time from 202 acceptance to `completed` may vary with worker load. The system shall not require the client to hold an open HTTP request for inference. Clients shall poll `GET /api/v1/scans/{id}` (or an equivalent documented mechanism).

### NFR-P-003 Prototype concurrency (Should)

The prototype shall correctly handle at least 5 concurrent scan acceptances from different sessions without corrupting scan records or cross-tenant data.

### NFR-SEC-001 Authentication (Must)

All API routes except health checks shall require a valid Supabase JWT Bearer token. Missing or invalid tokens shall yield HTTP 401.

### NFR-SEC-002 Role authorization (Must)

Vendor-only endpoints shall reject `platform_admin` (and vice versa) with HTTP 403 when roles are enforced. Roles are `vendor` and `platform_admin`.

### NFR-SEC-003 Tenant isolation via RLS (Must)

Every business table shall include `tenant_id` and a PostgreSQL RLS policy such that a session can only read/write rows for `current_setting('app.tenant_id')`. Application-layer filters are defense in depth only and shall not be the sole safeguard.

### NFR-SEC-004 No client-trusted tenant_id (Must)

The system shall not trust a client-supplied `tenant_id` in request bodies for authorization. Tenant context shall be derived from the authenticated JWT and set into the database session.

### NFR-SEC-005 Secrets handling (Must)

Secrets (database URLs, JWT secrets, R2 keys, and similar) shall not be committed to git. Configuration shall use environment variables / `.env` (gitignored) with `.env.example` documenting names only.

### NFR-SEC-006 Redis key namespace (Must)

Any Redis keys used for queues, cache, or results shall be namespaced as `tenant:{tenant_id}:...` (plus global infra keys that are not tenant data, for example Celery broker internals as required by the library).

## 3.5 Supportability

### NFR-SUP-001 Local run via Docker Compose (Must)

Developers shall be able to run core dependencies (at least PostgreSQL and Redis) via the project Docker Compose setup documented in the repo.

### NFR-SUP-002 Coding standards (Must)

API code shall follow the FastAPI / Python conventions of the repo; web and mobile shall follow existing TypeScript / Expo conventions. PRs shall pass CI lint/check stubs as configured.

### NFR-SUP-003 Logging (Should)

API and worker shall emit structured or clearly prefixed logs for scan accept, enqueue, classification success, and classification failure, enough to diagnose demo failures.

### NFR-SUP-004 Maintainability / monorepo layout (Must)

Code shall live in the approved monorepo paths (`apps/api`, `apps/web`, `apps/mobile`, `packages/ml`, `infra/db`, `infra/docker`) to keep ownership and reviews clear.
