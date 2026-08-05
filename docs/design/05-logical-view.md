# 5. Logical View

Issue: [#49](https://github.com/FreshLens-AI/FreshLens-AI/issues/49). Parent: [#6](https://github.com/FreshLens-AI/FreshLens-AI/issues/6). Template: CS3203 SAD Section 5.

This section describes the architecturally significant design model: packages mapped to monorepo paths, significant classes, and provided or required interfaces. It is not the process view (runtime concurrency), deployment view (nodes), or implementation view (source and build rules).

Unless a class is marked as implemented on the current scaffold, named classes describe the approved target V1 design. Baseline: `main` commit `a460540` (health API and Expo shell only).

Diagram assets for this section live under `docs/design/diagrams/`. Figures 5.1 through 5.6 were drawn in the diagrams.net (Draw.io) online visual editor and exported as PNG.

Sources: SRS (`docs/srs/`), OpenAPI (`docs/api/v1/openapi.yaml`), architecture rules (Postgres RLS, async scan, shared sales service).

## 5.1 Overview

FreshLens Version 1 is organized into four logical layers.


| Layer | Responsibility | Monorepo / external |
|---|---|---|
| Presentation | Vendor and admin UIs; auth session; camera, mic, sale forms; call API with Bearer JWT | `apps/mobile`, `apps/web` |
| Application | HTTP API; JWT validation; set `app.tenant_id`; accept scans with 202; sales and voice-draft; query tenant-scoped data | `apps/api` |
| Inference | Background classification (stub or FL-2TC); write scan results; evaluate alert rules; push notify | `packages/ml` |
| Persistence / infrastructure | Tenant-isolated business data (RLS); scan images; Celery broker / tenant-namespaced Redis keys | `infra/db`, Cloudflare R2, Redis |


Clients never talk to the classifier or database directly. The API never runs CNN inference in a request handler: it stores the image, inserts a pending scan, enqueues a Celery job, and returns HTTP 202 (FR-S-001, FR-S-008). Stock deduction is isolated in the shared sales service behind `POST /api/v1/sales` (FR-S-014).

**Figure 5.1** shows this package hierarchy and the main dependency edges between packages.

![Figure 5.1. Logical package hierarchy (layers mapped to monorepo paths)](diagrams/fig-5-1-logical-packages.png)

*Figure 5.1. Logical package hierarchy. Vendor mobile and admin web call the FastAPI application over HTTPS with a Supabase JWT. The API writes to PostgreSQL (with `app.tenant_id` for RLS), stores images in R2, and enqueues classification via Redis. The Celery worker in `packages/ml` reads the image, classifies, and writes results and alerts back to PostgreSQL. Sales traffic stays inside the API process until after commit, when push may notify.*

## 5.2 Architecturally significant design packages

### 5.2.1 Domain entities (shared across API, worker, and Data View)

These classes are the core business abstractions. They are persisted in PostgreSQL (`infra/db` migrations). OpenAPI already exposes scan, alert, tenant, product, batch, and sale contracts for V1; any field not yet in the scaffold is still part of the target schema.


| Class | Responsibility |
|---|---|
| `Tenant` | Isolation root for a vendor organization |
| `User` | Authenticated actor; `role` is `vendor` or `platform_admin` |
| `Product` | Catalogue item; holds `shelf_life_days` and `low_stock_threshold` for V1 alerts |
| `Batch` | Intake grouping: `intake_date`, `quantity_received`, `quantity_remaining` |
| `Scan` | One photo + vendor-confirmed quantity; async status lifecycle; classification fields nullable until complete |
| `Alert` | Low-stock, aging, spoilage, or other notice; optional links to product/batch |
| `DeviceToken` | Tenant-scoped push registration for Expo / FCM / APNs |
| `Sale` | Confirmed stock deduction header: `source`, `idempotency_key`, `created_at`, `tenant_id` |
| `SaleItem` | Line on a sale: resolved `product_id`, vendor-selected `batch_id`, `quantity_sold`, `tenant_id` |


**Figure 5.2** is the domain class diagram.

![Figure 5.2. Domain entity class diagram](diagrams/fig-5-2-domain-classes.png)

*Figure 5.2. Domain class diagram. `Tenant` owns users, products, batches, scans, alerts, device tokens, and sales. `Sale` owns `SaleItem` rows. Scans and alerts may optionally reference a product and/or batch. Attributes align with SRS Section 3.10 and OpenAPI schemas.*

Significant enumerations (not drawn as separate classes):

- `ScanStatus`: `pending` -> `processing` -> `completed` | `failed`
- `Classification`: `fresh` | `medium` | `spoiled` (FL-2TC Tier 2)
- `AlertType`: `spoilage` | `low_stock` | `aging` | `other`
- `AlertSeverity`: `info` | `warning` | `critical`
- `SaleSource`: `manual` | `voice_confirmed`

### 5.2.2 `apps/api`  -  FreshLens API

The application layer exposes the HTTP contract in `docs/api/v1/openapi.yaml`. Implemented today: health routes only. Target V1 classes:


| Class | Responsibility |
|---|---|
| `AuthMiddleware` | Validate Supabase JWT; extract `role` (`vendor` / `platform_admin`) |
| `TenantContextMiddleware` | Set Postgres session `app.tenant_id` from JWT claims (never from request body) |
| `HealthRouter` | Public liveness `GET /health` (implemented on scaffold) |
| `ScanRouter` | `POST /api/v1/scans` -> 202; list/get scans for vendor |
| `AlertRouter` | `GET /api/v1/alerts` for vendor |
| `SalesRouter` | `POST /api/v1/sales`; list/get sales under RLS |
| `VoiceDraftRouter` | `POST /api/v1/sales/voice-draft`; returns untrusted draft only |
| `AdminRouter` | `GET /api/v1/admin/tenants` for platform admin |
| `ScanService` | Create pending scan row; read/list scans under RLS |
| `SalesService` | Only component allowed to deduct stock; atomic, idempotent, non-negative batches |
| `VoiceSaleParser` | Adapter to external LLM; schema-validate draft; no DB writes |
| `ObjectStorageClient` | Put scan image to R2; return `image_path` |
| `ClassificationJobPublisher` | Enqueue Celery job with tenant-namespaced Redis keys |
| `AlertService` / `TenantService` | List alerts; list tenants for admin |


**Figure 5.3** shows these classes and their dependencies.

![Figure 5.3. API package class diagram](diagrams/fig-5-3-api-classes.png)

*Figure 5.3. `apps/api` class diagram. Authenticated requests pass Auth then Tenant middleware before routers. `ScanRouter` coordinates image storage, pending scan creation, and job enqueue without calling the CNN. `SalesRouter` delegates deduction to `SalesService`. `VoiceDraftRouter` calls `VoiceSaleParser` only. `HealthRouter` remains public and unauthenticated.*

### 5.2.3 `packages/ml`  -  Celery worker and FL-2TC

Inference runs only in this package. Mid-evaluation may use `StubClassifier` (`model_version = stub-v0`); the graded ML demo uses `FL2TC` (Tier 1 identify, Tier 2 freshness).


| Class | Responsibility |
|---|---|
| `ClassifyScanTask` | Celery entry: set status `processing`, classify, persist, handle failure |
| `FreshnessClassifier` | Interface: `classify(image) -> ClassificationResult` |
| `StubClassifier` / `FL2TC` | Implementations of the interface |
| `ClassificationResult` | Label, score, model version (and optional product hint) |
| `ScanResultWriter` | Persist classification fields on the scan row |
| `AlertEvaluator` | Low-stock, static aging, and spoilage alert rules (FR-S-009 through FR-S-012); also used after sales commits |
| `PushNotifier` | Expo / FCM / APNs wake-up for terminal scans and new alerts |


**Figure 5.4** shows the worker and classifier packages.

![Figure 5.4. ML worker and classifier class diagram](diagrams/fig-5-4-ml-classes.png)

*Figure 5.4. `packages/ml` class diagram. `ClassifyScanTask` depends on the `FreshnessClassifier` interface so stub and FL-2TC can be swapped without changing the API. Results and alerts are written through dedicated writers and evaluators; push notifies the vendor without replacing the HTTP list APIs as source of truth.*

**Figure 5.6** shows the internal FL-2TC pipeline.

![Figure 5.6. FL-2TC internal pipeline](diagrams/fig-5-6-fl2tc-pipeline.png)

*Figure 5.6. FL-2TC Tier 1 identifies the product class; Tier 2 assigns freshness. Both tiers run only inside the worker process.*

### 5.2.4 `apps/mobile` and `apps/web`  -  client packages

Presentation-layer classes mirror the SRS vendor (FR-V-) and admin (FR-A-) flows. They hold no CNN logic in V1.


| Package | Significant classes | Responsibility |
|---|---|---|
| `apps/mobile` | `AuthSession`, `ApiClient`, `CameraCapture`, `QuantityConfirm`, `ScanSubmitController`, `ManualSaleForm`, `VoiceSaleController`, `DraftReviewScreen`, `ScanListScreen`, `AlertListScreen`, `VendorDashboard` | Sign-in, push token, capture one product photo, confirm quantity >= 1, submit for 202, manual sale, voice draft review and confirmation, list scans/alerts |
| `apps/web` | `AdminAuthSession`, `AdminApiClient`, `TenantAdminScreen`, `ProductCatalogueScreen`, `AnalyticsScreen` | Admin sign-in; tenants; catalogue / shelf-life days; aggregated analytics |


**Figure 5.5** shows both client packages.

![Figure 5.5. Client package class diagrams (mobile and web)](diagrams/fig-5-5-client-classes.png)

*Figure 5.5. Client class diagrams. Mobile scan flow is Camera -> Quantity -> Submit (202) via `ApiClient`. Manual and voice sale UIs both end at the shared sales API after confirmation. Web admin screens depend on `AdminApiClient` after admin auth. Both clients attach the Supabase JWT as `Authorization: Bearer`.*

## 5.3 Component interfaces

| Component | Provides | Requires |
|---|---|---|
| Vendor mobile | Camera capture, sale UI, alert list | Supabase Auth, FastAPI HTTPS, device STT, Expo Push |
| Admin web | Tenant, catalogue, analytics screens | Supabase Auth, FastAPI HTTPS |
| FastAPI application | REST OpenAPI contract; 202 scans; sales; voice-draft | JWT validation, Postgres, Redis broker, R2, LLM adapter |
| Celery worker | Classify task; alert evaluation hooks; push send | Redis, R2 read, Postgres, Expo Push gateway |
| PostgreSQL | RLS-scoped persistence | `app.tenant_id` set by API or worker session |
| Redis | Celery broker and tenant-namespaced keys | Network from API and worker only |
| LLM sale parser | Draft JSON candidates | Transcript text from API; no DB credentials |

## 5.4 Architectural patterns

| Pattern | Where applied |
|---|---|
| Layered architecture | Presentation -> Application -> Inference / Persistence |
| MVC (or MVVM-style screens) | Mobile and web presentation packages |
| Producer-consumer | API enqueues scan jobs; Celery consumes from Redis |
| Adapter | `VoiceSaleParser` and `ObjectStorageClient` isolate external providers |
| Shared service | `SalesService` is the single stock-deduction authority |

## 5.5 Traceability (requirements to logical packages)


| Concern | SRS / OpenAPI | Logical home |
|---|---|---|
| Async scan 202, no inline CNN | FR-S-001, FR-S-008 | `ScanRouter` + `ClassificationJobPublisher` + `ClassifyScanTask` |
| One product / vendor quantity | FR-S-002, FR-S-003 | `Scan`, `CameraCapture`, `QuantityConfirm` |
| Classification labels | FR-S-007 | `FreshnessClassifier`, `Scan.classification` |
| Tenant isolation | DR-002, DR-003 | `Tenant`, `TenantContextMiddleware`, RLS in `infra/db` |
| Shared sale deduction | FR-S-014, FR-S-016, NFR-R-005 | `SalesRouter`, `SalesService`, `Sale`, `SaleItem` |
| Voice draft only | FR-S-015, NFR-SEC-007 | `VoiceDraftRouter`, `VoiceSaleParser`, `DraftReviewScreen` |
| Alerts + push | FR-S-009 through FR-S-013 | `Alert`, `AlertEvaluator`, `PushNotifier`, mobile `AlertListScreen` |
| Admin catalogue / shelf-life | FR-A-005, FR-A-006 | `Product.shelf_life_days`, `ProductCatalogueScreen` |


## Acceptance checklist (issue #49)

- [x] Class diagrams included and described (Figures 5.1 through 5.6)
- [x] Packages map to monorepo paths (`apps/api`, `apps/web`, `apps/mobile`, `packages/ml`, `infra/db`)
- [x] Sales and voice-draft classes documented for target V1
- [x] Stored under `docs/design/` (this file + `docs/design/diagrams/`)
