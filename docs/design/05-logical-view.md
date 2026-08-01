# 5. Logical View

Issue: [#49](https://github.com/FreshLens-AI/FreshLens-AI/issues/49). Parent: [#6](https://github.com/FreshLens-AI/FreshLens-AI/issues/6). Template: CS3203 SAD §5.

This section describes the architecturally significant parts of the FreshLens design model: how the system is decomposed into packages that map to monorepo paths, and the significant classes inside each package. It is the *logical* organization of functionality (what abstractions exist and how they relate), not the process (runtime threads — §6), deployment (nodes — §7), or source-tree packaging rules (§8).

**Diagram tool:** [Draw.io](http://Draw.io) for diagrams. Assets live under `docs/design/diagrams/`.

Sources: SRS (`docs/srs/`), OpenAPI (`docs/api/v1/openapi.yaml`), SAD introduction (`docs/design/01-introduction.md`), architecture rules (Postgres RLS, async scan → Celery).

---



## 5.1 Overview

FreshLens Version 1 is organized into four logical layers. Each layer owns a coherent set of responsibilities and maps to one or more monorepo paths.


| Layer                        | Responsibility                                                                                               | Monorepo / external              |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------- |
| Presentation                 | Vendor and admin UIs; auth session; camera / forms; call API with Bearer JWT                                 | `apps/mobile`, `apps/web`        |
| Application                  | HTTP API; JWT validation; set `app.tenant_id`; accept scans with 202; enqueue work; query tenant-scoped data | `apps/api`                       |
| Inference                    | Background classification (stub or FL-2TC); write scan results; evaluate alert rules; push notify            | `packages/ml`                    |
| Persistence / infrastructure | Tenant-isolated business data (RLS); scan images; Celery broker / tenant-namespaced Redis keys               | `infra/db`, Cloudflare R2, Redis |


Clients never talk to the classifier or database directly. The API never runs CNN inference in a request handler: it stores the image, inserts a `pending` scan, enqueues a Celery job, and returns HTTP 202 (SRS FR-S-001, FR-S-008).

**Figure 5.1** shows this package hierarchy and the main dependency edges between packages.

![Figure 5.1. Logical package hierarchy (layers mapped to monorepo paths)](diagrams/fig-5-1-logical-packages.png)

*Figure 5.1. Logical package hierarchy. Vendor mobile and admin web call the FastAPI application over HTTPS with a Supabase JWT. The API writes to PostgreSQL (with* `app.tenant_id` *for RLS), stores images in R2, and enqueues classification via Redis. The Celery worker in* `packages/ml` *reads the image, classifies, and writes results and alerts back to PostgreSQL.*



---



## 5.2 Architecturally Significant Design Packages



### 5.2.1 Domain entities (shared across API, worker, and Data View)

These classes are the core business abstractions. They are persisted in PostgreSQL (`infra/db` migrations) and appear in the OpenAPI schemas. Every tenant-scoped entity carries `tenant_id`; RLS policies restrict rows to `current_setting('app.tenant_id')` (SRS DR-001–DR-007).


| Class     | Responsibility                                                                                               |
| --------- | ------------------------------------------------------------------------------------------------------------ |
| `Tenant`  | Isolation root for a vendor organization                                                                     |
| `User`    | Authenticated actor; `role` is `vendor` or `platform_admin`                                                  |
| `Product` | Catalogue item; holds `shelf_life_days` used by V1 static aging alerts                                       |
| `Batch`   | Intake grouping: `intake_date`, `quantity_received`, `quantity_remaining`                                    |
| `Scan`    | One photo + vendor-confirmed quantity; async status lifecycle; classification fields nullable until complete |
| `Alert`   | Low-stock, aging, spoilage, or other notice; optional links to product/batch                                 |


**Figure 5.2** is the domain class diagram.

![Figure 5.2. Domain entity class diagram](diagrams/fig-5-2-domain-classes.png)

*Figure 5.2. Domain class diagram.* `Tenant` *owns users, products, batches, scans, and alerts.* `Product` *owns batches. Scans and alerts may optionally reference a product and/or batch (dashed associations). Attributes align with SRS §3.10 and OpenAPI* `Scan`*,* `Alert`*, and* `Tenant` *schemas.*



Significant enumerations (not drawn as separate classes):

- `ScanStatus`: `pending` → `processing` → `completed` | `failed`
- `Classification`: `fresh` | `medium` | `spoiled` (FL-2TC Tier 2)
- `AlertType`: `spoilage` | `low_stock` | `aging` | `other`
- `AlertSeverity`: `info` | `warning` | `critical`

---



### 5.2.2 `apps/api` — FreshLens API

The application layer exposes the HTTP contract in `docs/api/v1/openapi.yaml`. Architecturally significant classes fall into middleware, routers, and application services.


| Class                            | Responsibility                                                                 |
| -------------------------------- | ------------------------------------------------------------------------------ |
| `AuthMiddleware`                 | Validate Supabase JWT; extract `role` (`vendor` / `platform_admin`)            |
| `TenantContextMiddleware`        | Set Postgres session `app.tenant_id` from JWT claims (never from request body) |
| `HealthRouter`                   | Public liveness `GET /health`                                                  |
| `ScanRouter`                     | `POST /api/v1/scans` → **202**; list/get scans for vendor                      |
| `AlertRouter`                    | `GET /api/v1/alerts` for vendor                                                |
| `AdminRouter`                    | `GET /api/v1/admin/tenants` for platform admin                                 |
| `ScanService`                    | Create pending scan row; read/list scans under RLS                             |
| `ObjectStorageClient`            | Put scan image to R2; return `image_path`                                      |
| `ClassificationJobPublisher`     | Enqueue Celery job with tenant-namespaced Redis keys                           |
| `AlertService` / `TenantService` | List alerts; list tenants for admin                                            |


**Figure 5.3** shows these classes and their dependencies.

![Figure 5.3. API package class diagram](diagrams/fig-5-3-api-classes.png)

*Figure 5.3.* `apps/api` *class diagram. Authenticated requests pass Auth then Tenant middleware before routers.* `ScanRouter` *coordinates image storage, pending scan creation, and job enqueue without calling the CNN.* `HealthRouter` *remains public and unauthenticated.*



---



### 5.2.3 `packages/ml` — Celery worker and FL-2TC

Inference runs only in this package. Mid-evaluation may use `StubClassifier` (`model_version = stub-v0`); the graded ML demo uses `FL2TC` (Tier 1 identify, Tier 2 freshness).


| Class                      | Responsibility                                                           |
| -------------------------- | ------------------------------------------------------------------------ |
| `ClassifyScanTask`         | Celery entry: set status `processing`, classify, persist, handle failure |
| `FreshnessClassifier`      | Interface: `classify(image) → ClassificationResult`                      |
| `StubClassifier` / `FL2TC` | Implementations of the interface                                         |
| `ClassificationResult`     | Label, score, model version (and optional product hint)                  |
| `ScanResultWriter`         | Persist classification fields on the scan row                            |
| `AlertEvaluator`           | Low-stock, static aging, and spoilage alert rules (FR-S-009–012)         |
| `PushNotifier`             | Expo / FCM / APNs wake-up for terminal scans and new alerts              |


**Figure 5.4** shows the worker and classifier packages.

![Figure 5.4. ML worker and classifier class diagram](diagrams/fig-5-4-ml-classes.png)

*Figure 5.4.* `packages/ml` *class diagram.* `ClassifyScanTask` *depends on the* `FreshnessClassifier` *interface so stub and FL-2TC can be swapped without changing the API. Results and alerts are written through dedicated writers/evaluators; push notifies the vendor without replacing the HTTP list APIs as source of truth.*



---



### 5.2.4 `apps/mobile` and `apps/web` — client packages

Presentation-layer classes mirror the SRS vendor (FR-V-) and admin (FR-A-) flows. They hold no CNN logic in V1.


| Package       | Significant classes                                                                                                                            | Responsibility                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `apps/mobile` | `AuthSession`, `ApiClient`, `CameraCapture`, `QuantityConfirm`, `ScanSubmitController`, `ScanListScreen`, `AlertListScreen`, `VendorDashboard` | Sign-in, push token, capture one product photo, confirm quantity ≥ 1, submit for 202, list scans/alerts |
| `apps/web`    | `AdminAuthSession`, `AdminApiClient`, `TenantAdminScreen`, `ProductCatalogueScreen`, `AnalyticsScreen`                                         | Admin sign-in; tenants; catalogue / shelf-life days; aggregated analytics                               |


**Figure 5.5** shows both client packages.

![Figure 5.5. Client package class diagrams (mobile and web)](diagrams/fig-5-5-client-classes.png)

*Figure 5.5. Client class diagrams. Mobile scan flow is Camera → Quantity → Submit (202) via* `ApiClient`*. Web admin screens depend on* `AdminApiClient` *after admin auth. Both clients attach the Supabase JWT as* `Authorization: Bearer`*.*



---



## 5.3 Traceability (requirements → logical packages)


| Concern                       | SRS / OpenAPI      | Logical home                                                        |
| ----------------------------- | ------------------ | ------------------------------------------------------------------- |
| Async scan 202, no inline CNN | FR-S-001, FR-S-008 | `ScanRouter` + `ClassificationJobPublisher` + `ClassifyScanTask`    |
| One product / vendor quantity | FR-S-002, FR-S-003 | `Scan`, `CameraCapture`, `QuantityConfirm`                          |
| Classification labels         | FR-S-007           | `FreshnessClassifier`, `Scan.classification`                        |
| Tenant isolation              | DR-002, DR-003     | `Tenant`, `TenantContextMiddleware`, RLS in `infra/db`              |
| Alerts + push                 | FR-S-009–013       | `Alert`, `AlertEvaluator`, `PushNotifier`, mobile `AlertListScreen` |
| Admin catalogue / shelf-life  | FR-A-005, FR-A-006 | `Product.shelf_life_days`, `ProductCatalogueScreen`                 |


---



---



## Acceptance checklist (issue #49)

- [x] Class diagrams included and described (Figures 5.2–5.5)
- [x] Packages map to monorepo paths (`apps/api`, `apps/web`, `apps/mobile`, `packages/ml`, `infra/db`)
- [x] Stored under `docs/design/` (this file + `docs/design/diagrams/`)