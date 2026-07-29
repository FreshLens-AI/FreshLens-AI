# 3.6 to 3.8 Design constraints, help documentation, purchased components

Issue: [#41](https://github.com/FreshLens-AI/FreshLens-AI/issues/41). Priority: Must.

## 3.6 Design constraints

### NFR-DC-001 Approved technology stack (Must)

Implementation shall use the approved stack only: FastAPI (Python async), PostgreSQL with RLS, Supabase Auth, Next.js (App Router), Expo (React Native), Celery + Redis, Cloudflare R2, Docker Compose, GitHub Actions.

### NFR-DC-002 Forbidden alternatives (Must)

The system shall not introduce: a Node/NestJS backend; a second queue system alongside Celery + Redis; synchronous CNN inference in API handlers; business tables without `tenant_id` + RLS in the same migration; secrets committed to git.

### NFR-DC-003 Monorepo path ownership (Must)

Code shall be placed under the correct monorepo paths (`apps/api`, `apps/web`, `apps/mobile`, `packages/ml`, `infra/db`, `infra/docker`, `docs/`).

### NFR-DC-004 API versioning (Must)

Versioned HTTP resources for V1 shall live under `/api/v1` as specified in the OpenAPI contract.

### NFR-DC-005 Course deliverable coupling (Must)

Requirements apportioned as Version 2 shall not be treated as Must for M3 to M5 grading unless the team pulls them forward with mentor agreement.

## 3.7 Online user documentation / help

### NFR-HELP-001 In-repo developer docs (Must)

The repository shall maintain README / CONTRIBUTING guidance sufficient for teammates to run the prototype locally.

### NFR-HELP-002 API contract documentation (Must)

Machine-readable and human API docs shall be available under `docs/api/` for client implementers.

### NFR-HELP-003 End-user help (Should)

V1 may rely on concise in-app labels rather than a full help center. A short "How to scan" hint on the mobile capture screen is Should.

## 3.8 Purchased / external components

### NFR-PC-001 External services (Must)

V1 may depend on the following external or third-party components (prototype accounts):

| Component | Use |
|-----------|-----|
| Supabase Auth | Identity / JWT |
| Cloudflare R2 | Image object storage |
| Public ML datasets (e.g. Fruits-360 and freshness-labelled sets) | Training FL-2TC |
| GitHub / GitHub Actions | Source control and CI |

### NFR-PC-002 No paid ERP dependency (Must)

FreshLens shall not require purchase of a commercial ERP or inventory suite to operate the V1 prototype.

### NFR-PC-003 License compliance (Must)

Third-party libraries and datasets shall be used in accordance with their licenses. Attributions shall appear in the final report or NOTICE as required.
