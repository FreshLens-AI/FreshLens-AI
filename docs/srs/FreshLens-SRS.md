# S

# 1. Introduction

Issue: [#34](https://github.com/FreshLens-AI/FreshLens-AI/issues/34). Priority: Must.

## 1.1 Purpose

This Software Requirements Specification (SRS) states the functional and non-functional requirements for FreshLens, an AI-powered inventory and freshness monitoring platform for small-scale grocery retailers (CS3203 Group 21, PID 5).

Readers include:

- Course mentors and examiners evaluating Milestone M2
- FreshLens developers building Version 1 (mobile, web, API, ML worker)
- Testers who derive acceptance and isolation tests from numbered requirements

This document covers what the system shall do. Architecture and design live in the Software Architecture Document (SAD).

## 1.2 Scope

Product name: FreshLens: AI-Powered Automated Inventory and Freshness Monitoring System for Small-Scale Retailers.

FreshLens is a multi-tenant SaaS product with two roles:

| Role | Client | Primary capabilities |
|------|--------|----------------------|
| Vendor (shop owner) | Mobile (Expo / React Native) | Capture produce photos, confirm quantity, record sales, view scan results, inventory summary, and alerts |
| Platform Administrator | Web (Next.js) | Manage tenants / vendor profiles, product catalogues, and platform analytics |

Version 1 includes:

- An asynchronous scan pipeline: the vendor submits a photo and a confirmed quantity; the API accepts with HTTP 202; classification runs in the background
- FreshLens Two-Tier Classifier (FL-2TC): Tier 1 identifies produce type; Tier 2 labels it `fresh`, `medium`, or `spoiled` (a stub classifier is acceptable at mid-evaluation)
- Manual sale entry for the mid-evaluation, where the vendor selects one product and one active batch, enters a quantity, reviews the item, and explicitly confirms the sale
- Voice-assisted sale entry for final V1, where device speech-to-text and a provider-neutral LLM parser may draft multiple products for vendor correction, batch selection, and explicit confirmation
- Multi-tenant isolation through PostgreSQL Row-Level Security (`tenant_id` on every business table)
- Low-stock alerts and static aging alerts based on administrator-configured shelf-life days
- Core entities: tenants, users, products, scans, batches, sales, sale items, alerts

Version 2 (future) includes image-based age estimation, predicted rot dates, learned aging alerts, offline capture, and multi-item image detection.

Out of scope for all versions: IoT / smart scales, automated procurement or supply-chain integration, and accounting / tax modules.

## 1.3 Definitions, acronyms, and abbreviations

| Term | Definition |
|------|------------|
| Alert | Notification raised for low stock, static aging, spoilage classification, or related conditions |
| Batch | Stock intake grouping for a product: intake date, quantity received, quantity remaining, shelf-life context |
| Classification | Freshness label assigned by Tier 2: `fresh`, `medium`, or `spoiled` |
| FL-2TC | FreshLens Two-Tier Classifier. Tier 1 product identity, Tier 2 freshness |
| JWT | JSON Web Token issued by Supabase Auth |
| Platform Admin | User role that manages the platform via the web application (`platform_admin`) |
| RLS | PostgreSQL Row-Level Security: database policies that restrict rows by `tenant_id` |
| Scan | One produce photo submission plus confirmed quantity and resulting classification record |
| Stub classifier | Non-CNN placeholder that writes a valid classification for mid-evaluation demos |
| Tenant | Logical vendor organization boundary; all business data is scoped by `tenant_id` |
| Vendor | Shop-owner user role using the mobile application (`vendor`) |
| V1 / V2 | Version 1 / Version 2 (documented future work) |
| Celery | Asynchronous task queue worker used for inference |
| R2 | Cloudflare R2 object storage for scan images |
| SAD | Software Architecture Document (companion to this SRS) |
| SRS | Software Requirements Specification (this document) |

## 1.4 References

1. FreshLens Project Proposal (CS3203 Group 21), July 2026
2. FreshLens Feasibility Study
3. FreshLens Project Schedule / Gantt
4. FreshLens API V1 OpenAPI contract
5. IEEE Std 830-1998, *IEEE Recommended Practice for Software Requirements Specifications* (superseded; the structural practice is still widely used)
6. ISO/IEC/IEEE 29148:2018, *Systems and software engineering: Life cycle processes: Requirements engineering*
7. Mukhiddinov et al., "Improved classification approach for fruits and vegetables freshness based on deep learning," *Sensors*, 2022
8. Fahad et al., "Fruits and vegetables freshness categorization using deep learning," *CMC*, 2022
9. GitHub repository FreshLens-AI/FreshLens-AI, issues #5, #34 to #44 (SRS), #6 (SAD)

## 1.5 Overview of the SRS document

- Section 2 summarizes product perspective, functions, users, constraints, and assumptions without detailed shall-statements.
- Section 3 states specific functional, usability, reliability, performance, security, supportability, interface, and database requirements.
- Section 4 provides supporting information, including requirement traceability.

Requirements use unique IDs (`FR-*`, `NFR-*`, `DR-*`, `IR-*`) and priority Must / Should / Could.

# 2. Overall description

Issue: [#35](https://github.com/FreshLens-AI/FreshLens-AI/issues/35). Priority: Must.

This section gives context for the specific requirements in Section 3. It does not replace numbered shall-statements.

## 2.1 Product perspective

FreshLens is a standalone multi-tenant SaaS system. It depends on these external systems:

```text
[Vendor Mobile] ----\                    +--> [Cloudflare R2]  (images)
                     \                   |
[Admin Web] ----------+--> [FreshLens API (FastAPI)]
                     /         |         |
[Supabase Auth] ----/          |         +--> [PostgreSQL + RLS]
                               |
                               +--> [Redis] --> [Celery ML Worker] --> [FL-2TC / stub]
```

- Clients authenticate with Supabase-issued JWTs.
- The API never runs CNN inference inline; it enqueues work and returns immediately.
- Isolation between vendors is enforced in PostgreSQL via RLS using `app.tenant_id` set from the JWT.

Physical deployment, container topology, and detailed sequence diagrams belong in the SAD.

## 2.2 Product functions (summary)

1. Authenticate vendors and platform admins.
2. Capture and submit a single-product scan with confirmed quantity.
3. Store the image, create a pending scan, enqueue classification, and return acceptance.
4. Classify produce (identify and freshness) asynchronously and persist results.
5. List scans and show classification and freshness score to the vendor.
6. Maintain batches and inventory quantities linked to scans where applicable.
7. List tenant-scoped products and active batches for sale entry.
8. Record confirmed sales through one stock-deduction path and evaluate low-stock alerts from the committed post-sale quantities.
9. Raise and list low-stock and static aging alerts.
10. Let platform admins manage tenants, vendor profiles, and product catalogues, and view aggregated analytics (V1 graded scope as implemented for demos).

## 2.3 User characteristics

| User class     | Characteristics                                                       | Implications |
| -------------- | --------------------------------------------------------------------- |-------------|
| Vendor         | Small-shop owner; smartphone user; limited time; may not be technical | Mobile UX must be simple; camera, quantity confirm, and clear status; no on-device CNN required for V1 |
| Platform Admin | Platform operator; uses desktop browser                               | Web console for catalogues, tenants, and analytics |

## 2.4 Constraints

| Constraint               | Implication |
| ------------------------ |-------------|
| Approved stack           | FastAPI, PostgreSQL + RLS, Supabase Auth, Next.js, Expo, Celery + Redis, Cloudflare R2, Docker Compose |
| Async inference only     | No CNN inside API request handlers |
| Tenant isolation         | Every business table has `tenant_id` + RLS in the same migration |
| Redis namespacing        | Keys use `tenant:{tenant_id}:...` |
| V1 scan model            | One product type per photo; quantity is vendor-confirmed |
| Course calendar          | Mid-eval may use stub ML; real FL-2TC by Progress Review 2 / final |
| No NestJS / second queue | Stack is locked for V1 |

## 2.5 Assumptions and dependencies

1. Vendors have a smartphone with a working camera and network access.
2. Supabase Auth remains available for JWT issuance and validation during the prototype period.
3. Public and curated datasets are sufficient to train or stub FL-2TC for the graded demo.
4. Docker Compose local/dev environment provides Postgres and Redis for the prototype.
5. Cloudflare R2 (or equivalent object storage compatible with the V1 contract) is available for image bytes.
6. Vendors enter quantities honestly; V1 does not independently verify counts from the image.
7. Platform admin accounts are provisioned out-of-band for the prototype (not self-serve signup).
8. Final V1 relies on device speech-to-text to produce transcript text for voice-assisted sale entry.
9. A provider-neutral external LLM parser is available in final V1 to convert transcript text into an untrusted structured sale draft. The draft cannot change inventory.

## 2.6 Apportioning of requirements (V1 vs V2)

| Scope               | Examples |
| ------------------- |----------|
| Must (mid-evaluation V1) | Auth, async scan 202, stub classification, RLS, manual one-item sale entry with one selected product and active batch, low-stock and static aging alerts, vendor mobile core flows, admin catalogue/tenant basics |
| Must (final V1)     | FL-2TC classification and voice-assisted sale entry that may draft multiple products but requires product resolution, vendor-selected batches, correction, and explicit confirmation |
| Should (V1 if time) | Richer admin analytics, alert CRUD beyond list, product/batch full CRUD APIs |
| Could (V2)          | Multi-item image detection, age estimation, predicted rot dates, learned aging alerts, offline capture |
| Out of scope        | IoT sensors, procurement integrations, accounting/tax |

Specific requirements in Section 3 are Must unless marked otherwise.

# 3. Specific requirements

This section states detailed, testable requirements for FreshLens Version 1. Functional requirements are organized by feature area (vendor mobile, platform admin web, scan/ML/alerts). Non-functional, interface, and database requirements follow.

# 3.1 Functionality: Vendor (mobile)

Issue: [#36](https://github.com/FreshLens-AI/FreshLens-AI/issues/36). Priority: Must.

Client: Expo / React Native (SDK 57). Role: `vendor`.

The mobile app is the vendor's only interface into the platform: capture shelf images, confirm stock quantities, submit scans, and monitor inventory and freshness status. All vendor-facing data is scoped to the authenticated tenant. V1 does not require on-device CNN inference; classification runs asynchronously on the backend (Proposal Section 2, Section 5.2).

---

### FR-V-001 Vendor authentication (Must)

The mobile application shall allow a vendor to sign in using Supabase Auth and retain a session token for API calls.

| | |
|--|--|
| Inputs | Vendor email/username and password (or other Supabase-supported credential method); device/session metadata for persistence |
| Processing | Submit credentials to Supabase Auth over HTTPS; on success store JWT securely on-device and attach as Bearer token on all API calls; register or refresh a push device token with the backend for scan-completion (FR-V-006) and alert notifications (FR-V-008); on invalid credentials show inline error without establishing a session; on session expiry prompt re-authentication before further scanning or dashboard access |
| Outputs | Authenticated session scoped to one vendor tenant; navigation to home/dashboard on success; non-technical error on failure (e.g. "Incorrect email or password") without revealing which field failed |

Tenant isolation is enforced at the database layer (RLS), not only by hiding UI elements.

---

### FR-V-002 Sign out (Must)

The mobile application shall allow the vendor to sign out, clearing the local session so later API calls are unauthorized until sign-in again.

| | |
|--|--|
| Inputs | User sign-out action |
| Processing | Clear stored tokens / session |
| Outputs | Unauthenticated UI (login) |

---

### FR-V-003 Capture produce photo (Must)

The mobile application shall provide a camera interface (or gallery-picker fallback for demos) to capture one product type per photo for a scan. V1 supports exactly one product per photograph; multi-item shelf detection is out of scope.

| | |
|--|--|
| Inputs | Live camera feed via Expo camera module (or gallery image); vendor shutter action; optional retake |
| Processing | Request camera permission on first use; on capture store image locally and show preview (accept/retake); perform only lightweight client-side checks (non-empty image file); no on-device classification or quality scoring |
| Outputs | Single locally held product image ready for quantity confirmation; preview UI allowing retake before proceeding |

---

### FR-V-004 Confirm quantity at scan time (Must)

Before submit, the mobile application shall require the vendor to enter or confirm a quantity (integer >= 1) associated with the scan. V1 relies on vendor-entered quantities; automatic count verification from the image is not in scope.

| | |
|--|--|
| Inputs | Vendor-entered numeric quantity (integer >= 1); captured image from FR-V-003 shown for context |
| Processing | Present numeric input next to image; validate positive integer before proceed; attach quantity to pending scan payload with image and tenant context |
| Outputs | Validated (image, quantity) pair ready for submission; inline validation error if quantity missing, zero, or non-numeric |

---

### FR-V-005 Submit scan (Must)

The mobile application shall submit the image and quantity to `POST /api/v1/scans` and treat HTTP 202 as successful acceptance.

| | |
|--|--|
| Inputs | Validated (image, quantity) from FR-V-003 and FR-V-004; vendor session from FR-V-001; optional product/batch ids if UI supports linking |
| Processing | Upload image (e.g. to R2 via API); create scan record with confirmed quantity and tenant context; backend enqueues Celery job and returns immediately without waiting for classification; handle 401/403/422 with user-visible messages |
| Outputs | Accepted scan `id` and initial `status` (typically `pending`); optional waiting UI; vendor may leave the app without waiting for classification |

---

### FR-V-006 View scan result status via push (Must)

After acceptance, the system shall notify the vendor when the scan reaches a terminal status (`completed` or `failed`) using a mobile push notification (Expo Push / FCM / APNs as configured for the app). The vendor shall not be required to keep the app open or poll continuously while the worker is queued.

| | |
|--|--|
| Inputs | Scan id; vendor device push token registered after sign-in (FR-V-001); push permission state |
| Processing | On classification complete or fail, backend sends a push to the vendor's registered device(s) for that tenant; on notification receive or tap, the app fetches authoritative state via `GET /api/v1/scans/{id}` and shows the result; while the result screen is open, the app may use short limited polling as a fallback; if push permission is denied, the app shall still show status when the vendor reopens the app or opens the scan list (FR-V-007) |
| Outputs | Push notification for terminal scan status; status UI with thumbnail, quantity, timestamp; on completed: produce type (when available), classification (`fresh` / `medium` / `spoiled`), and `freshness_score`; on failure: vendor-facing reason and path to retake/resubmit |

Push delivers the wake-up signal. The HTTP scan resource remains the source of truth for classification fields.

---

### FR-V-007 List recent scans (Must)

The mobile application shall display a list of the vendor's recent scans for their tenant (via `GET /api/v1/scans`).

| | |
|--|--|
| Inputs | Authenticated session; optional pagination |
| Processing | Fetch list; render summary (status, time, classification if present) |
| Outputs | Scrollable scan history |

---

### FR-V-008 View alerts via push and batch context (Must)

The mobile application shall notify the vendor when a new or updated tenant alert is raised (low-stock, aging, spoilage) using a mobile push notification (Expo Push / FCM / APNs as configured for the app). The vendor shall also be able to view all tenant alerts in an in-app list with batch context.

| | |
|--|--|
| Inputs | Authenticated session; vendor device push token (FR-V-001); push permission state; backend alert data (low-stock thresholds, shelf-life aging rules) |
| Processing | On alert push receive or tap, fetch tenant-scoped alerts via `GET /api/v1/alerts` and navigate to or refresh the alerts view; render type, severity, message; link each alert to batch context (intake date, quantity received, quantity remaining, category shelf-life) where applicable; alerts are read-only on mobile in V1; if push permission is denied, alerts remain visible when the vendor opens the alerts screen or dashboard (FR-V-009) |
| Outputs | Push notification for new or updated alerts; alerts list scoped to vendor tenant; batch context per alert sufficient to act (reorder, discount, remove aging stock); empty state when none exist |

Push delivers the wake-up signal. The HTTP alert list remains the source of truth for alert fields.

---

### FR-V-009 Inventory / freshness dashboard summary (Must)

The mobile application shall provide a simple dashboard summarizing the vendor's recent freshness and inventory information derived from scans (and batches when available), enough for the mid-evaluation demo.

| | |
|--|--|
| Inputs | Scan/alert/batch data from API |
| Processing | Aggregate or list key metrics in UI; show in-progress and completed scans |
| Outputs | Dashboard view |

---

### FR-V-010 Offline capture queue (Could / V2)

Queuing scans while offline is not required for V1. If implemented later, uploads shall resume when connectivity returns without breaking tenant isolation.

---

### FR-V-011 Record a sale manually (Must, mid-evaluation)

The mobile application shall allow the vendor to record a sale manually by selecting one tenant-scoped product and one active batch, entering a positive `quantity_sold`, reviewing the item, and explicitly confirming it.

| | |
|--|--|
| Inputs | Authenticated vendor session; one selected product; one selected active batch for that product; positive `quantity_sold` |
| Processing | Load tenant-scoped products and active batches; validate the quantity; show the product, batch, and quantity for review; require explicit confirmation; submit exactly one confirmed item to `POST /api/v1/sales`; make retries safe by reusing the idempotency key for the same attempted sale |
| Outputs | Confirmed sale result and updated quantity on success; clear validation or insufficient-stock error without a partial deduction; retry-safe outcome when the same request is submitted again |

---

### FR-V-012 Record a sale by voice (Must, final V1)

The mobile application shall allow the vendor to use voice input to prepare a multi-item sale draft. The draft shall not change inventory until every line has been resolved, reviewed, and explicitly confirmed.

| | |
|--|--|
| Inputs | Authenticated vendor session; microphone input; transcript produced by device speech-to-text |
| Processing | Request a structured multi-item draft from the voice sale parser; treat the draft as untrusted; resolve each product candidate; require the vendor to select an active batch for every line; allow correction of products and positive quantities; show the complete sale for review; require explicit confirmation before submitting to `POST /api/v1/sales`; fall back to manual entry when microphone permission, speech recognition, parsing, or product resolution fails or remains ambiguous |
| Outputs | Editable multi-item draft with ambiguity indicated; confirmed sale result only after API submission; manual-entry path on permission, speech, parser, or ambiguity failure |

# 3.1 Functionality: Platform Admin (web)

Issue: [#37](https://github.com/FreshLens-AI/FreshLens-AI/issues/37). Priority: Must.

Client: Next.js web application. Role: `platform_admin`.

Mid-evaluation may expose a subset of admin APIs (for example, tenant list). Graded V1 shall cover the functions below at least at demo depth.

---

### FR-A-001 Admin authentication (Must)

The web application shall allow a platform administrator to sign in via Supabase Auth and call admin APIs with a Bearer JWT.


|            |                                    |
| ---------- | ---------------------------------- |
| Inputs     | Admin credentials                  |
| Processing | Obtain JWT; attach to API requests |
| Outputs    | Authenticated admin session        |


---



### FR-A-002 Reject vendor-only data **access (Must)**

**Platform admin sessions shall not read another vendor's private scan or inventory data except through explicitly designed aggregated analytics views. Tenant-scoped vendor APIs shall return 403 for** `platform_admin` **where role-gated.**


|            |                                                    |
| ---------- | -------------------------------------------------- |
| **Inputs** | Admin JWT against vendor endpoints (negative case) |
| Processing | Role checks                                        |
| Outputs    | HTTP 403 on forbidden routes                       |


---



### FR-A-003 List tenants (Must)

The system shall allow a platform admin to list tenants (vendor organizations), for example `GET /api/v1/admin/tenants`.


|            |                                    |
| ---------- | ---------------------------------- |
| Inputs     | Admin JWT; pagination              |
| Processing | Return tenant id, name, created_at |
| Outputs    | `TenantList` in UI                 |


---



### FR-A-004 Manage vendor profiles (Must)

The web application shall support viewing and updating basic vendor/tenant profile information required for platform operation (name and status fields as implemented for V1).


|            |                                     |
| ---------- | ----------------------------------- |
| Inputs     | Admin actions on tenant profile     |
| Processing | Persist allowed profile fields      |
| Outputs    | Updated profile visible in admin UI |


---



### FR-A-005 Manage product catalogues (Must)

The web application shall allow platform admins to manage the product catalogue used for identification and inventory (create, list, and update produce types and related metadata such as default shelf-life days where applicable).


|            |                                                                   |
| ---------- | ----------------------------------------------------------------- |
| Inputs     | Product attributes (name, category, shelf-life days, and similar) |
| Processing | Persist catalogue entries                                         |
| Outputs    | Catalogue list/detail in admin UI                                 |


---



### FR-A-006 Configure shelf-life for aging alerts (Must)

Platform admins shall be able to set or update the typical shelf-life (in days) used by V1 static aging alerts for product categories (or products).


|            |                                                      |
| ---------- | ---------------------------------------------------- |
| Inputs     | Shelf-life days value                                |
| Processing | Persist configuration used by aging rules (FR-S-010) |
| Outputs    | Configuration reflected in later aging evaluations   |


---



### FR-A-007 Platform analytics view (Must)

The web application shall provide at least a basic analytics view of waste/spoilage or scan classification aggregates across the platform for demo purposes.


|            |                                                      |
| ---------- | ---------------------------------------------------- |
| Inputs     | Aggregated metrics from backend (as available in V1) |
| Processing | Render charts or summary tables                      |
| Outputs    | Analytics page                                       |


---



### FR-A-008 Admin sign out (Must)

The web application shall allow the admin to sign out and clear the session.

---



### FR-A-009 Full alert CRUD for admins (Should)

Create, update, and dismiss alert administration beyond the vendor list is Should for V1; the vendor list API is Must (FR-S-011).

# 3.1 Functionality: Scan pipeline, ML classification, and alerts

Issue: [#38](https://github.com/FreshLens-AI/FreshLens-AI/issues/38). Priority: Must (P0).

Aligns with: `docs/api/v1/openapi.yaml`. Architecture: async scan only.

Each requirement lists Inputs, Processing, and Outputs.

---

### FR-S-001 Accept scan asynchronously (Must)

The system shall accept a vendor scan submission and return HTTP 202 with a scan identifier without waiting for CNN inference to complete.

| | |
|--|--|
| Inputs | Authenticated vendor JWT; multipart body with `image` (binary) and `quantity` (integer >= 1); optional `product_id`, `batch_id` |
| Processing | Validate auth/role; store image in object storage; insert scan with status `pending`; enqueue background classification job; do not run CNN in the request handler |
| Outputs | HTTP 202 body with `id`, `status` (typically `pending`), `created_at` |

Acceptance: a successful `POST /api/v1/scans` returns 202 in the API response path before classification fields are populated.

---

### FR-S-002 One product per photo (Must)

The system shall treat each V1 scan as one product type per photograph. Multi-item detection is out of scope for V1 (Could / V2).

| | |
|--|--|
| Inputs | Single image intended to show one produce type |
| Processing | Classification assumes a single-product frame |
| Outputs | At most one identity and one freshness classification per scan |

---

### FR-S-003 Vendor-confirmed quantity (Must)

The system shall persist the vendor-confirmed quantity supplied at scan time. V1 shall not infer quantity from the image.

| | |
|--|--|
| Inputs | `quantity` >= 1 |
| Processing | Validate and store on the scan record |
| Outputs | Scan resource includes `quantity` |

---

### FR-S-004 Scan status lifecycle (Must)

The system shall advance each scan through statuses `pending`, then `processing`, then `completed` or `failed`.

| | |
|--|--|
| Inputs | Scan id; worker progress or failure |
| Processing | Worker updates status; on success sets classification fields; on failure sets `failed` |
| Outputs | `GET /api/v1/scans/{scan_id}` reflects current status; while `pending` or `processing`, `classification` and `freshness_score` may be null |

---

### FR-S-005 Retrieve and list scans (Must)

The system shall allow an authenticated vendor to retrieve a scan by id and list recent scans for their tenant only.

| | |
|--|--|
| Inputs | JWT; optional `limit` / `offset`; path `scan_id` for get |
| Processing | Enforce tenant RLS / context; paginate list |
| Outputs | `Scan` or `ScanList` JSON per OpenAPI |

---

### FR-S-006 Persist scan result fields (Must)

When classification completes, the system shall store at least: `image_path`, `classification`, `freshness_score`, `model_version`, `tenant_id`, and optional `batch_id` / `product_id`.

| | |
|--|--|
| Inputs | Worker inference result |
| Processing | Write fields to the scan row for the same tenant |
| Outputs | Completed scan readable via GET |

---

### FR-S-007 FL-2TC freshness labels (Must)

The system shall represent Tier-2 freshness as exactly one of: `fresh`, `medium`, `spoiled`.

| | |
|--|--|
| Inputs | Image bytes (via stored path) |
| Processing | Tier 1 identifies produce type; Tier 2 assigns freshness label. Mid-evaluation may use a stub that writes a valid label and `model_version` such as `stub-v0`. Final ML demo shall use the trained FL-2TC (or documented successor) with a non-stub `model_version`. |
| Outputs | `classification` enum; `freshness_score` in [0, 1] when completed |

---

### FR-S-008 No synchronous CNN in API handlers (Must)

The system shall not execute CNN / FL-2TC inference inside FastAPI request handlers. Inference shall run only in the background worker.

| | |
|--|--|
| Inputs | N/A (constraint on processing location) |
| Processing | Enqueue only from API path |
| Outputs | Verifiable by code review / architecture tests |

---

### FR-S-009 Low-stock alerts (Must)

The system shall raise a `low_stock` alert when a product's recorded remaining quantity falls below a vendor-configurable threshold.

| | |
|--|--|
| Inputs | Committed post-sale product/batch quantity remaining; configured threshold |
| Processing | After a sale deduction commits, compare the resulting remaining quantity to the threshold; create or update an alert with type `low_stock` and appropriate severity |
| Outputs | Alert record created; push and list delivery per FR-S-013 |

---

### FR-S-010 Static aging alerts (Must)

The system shall raise an `aging` alert when a batch's time since intake exceeds the administrator-configured typical shelf-life (days) and a large proportion of the received quantity remains unsold. V1 aging shall be a lookup/rule based on shelf-life days, not a learned rot-date model.

| | |
|--|--|
| Inputs | Batch `intake_date`, `quantity_received`, `quantity_remaining`; category/admin `shelf_life_days` |
| Processing | Evaluate static rule; create alert with type `aging` |
| Outputs | Alert linked to `batch_id` / `product_id`; push and list delivery per FR-S-013 |

---

### FR-S-011 List alerts (Must)

The system shall allow an authenticated vendor to list alerts for their tenant. An empty list is acceptable until alert rules are implemented, but the endpoint shall exist for V1 clients.

| | |
|--|--|
| Inputs | JWT; optional pagination |
| Processing | Tenant-scoped query |
| Outputs | `AlertList` with `type` in `spoilage` \| `low_stock` \| `aging` \| `other` and `severity` in `info` \| `warning` \| `critical` |

---

### FR-S-012 Spoilage-related alert from classification (Should)

When a completed scan classification is `spoiled`, the system should create or update a tenant-visible alert of type `spoilage` (or equivalent messaging) so vendors can act without relying only on scan history.

| | |
|--|--|
| Inputs | Completed scan with `classification = spoiled` |
| Processing | Create alert record |
| Outputs | Alert record created; push and list delivery per FR-S-013 |

---

### FR-S-013 Deliver alerts via push (Must)

When the system creates or updates a tenant alert (FR-S-009, FR-S-010, FR-S-012), it shall send a mobile push notification to the vendor's registered device(s) for that tenant. The vendor shall not be required to poll continuously for new alerts.

| | |
|--|--|
| Inputs | New or updated alert record; vendor device push token(s) registered at sign-in (FR-V-001) |
| Processing | On alert creation or material update, send push via Expo Push / FCM / APNs (IR-COM-003); include enough context to open the alerts UI (e.g. alert id or type); do not treat the push payload as the sole source of truth for alert fields |
| Outputs | Push notification delivered to vendor device(s); alert retrievable via `GET /api/v1/alerts` (FR-S-011) |

Push delivers the wake-up signal. The HTTP alert list remains the source of truth for alert fields.

---

### FR-S-014 Record a sale and deduct stock (Must)

The system shall use `POST /api/v1/sales` as the only stock-deduction path for confirmed manual and voice-assisted sales.

| | |
|--|--|
| Inputs | Authenticated vendor JWT; idempotency key; one or more confirmed sale items containing `product_id`, `batch_id`, and positive `quantity_sold` |
| Processing | Derive tenant context from the JWT; validate that every product and batch belongs to that tenant and that each batch belongs to the selected product; lock all affected batch rows; verify sufficient stock; deduct every item in one atomic transaction; reject the complete sale without partial changes if any item is invalid or has insufficient stock; evaluate low-stock conditions from committed post-sale quantities |
| Outputs | Created sale and item results with committed remaining quantities; original result for a repeated idempotency key without another deduction; validation or insufficient-stock error with no stock change |

---

### FR-S-015 Parse a voice sale draft (Must, final V1)

The system shall parse transcript text into a structured, schema-validated multi-item sale draft without mutating inventory.

| | |
|--|--|
| Inputs | Authenticated vendor JWT; transcript text produced by device speech-to-text |
| Processing | Send transcript text, not raw audio, to a provider-neutral LLM parser; validate the response against the sale-draft schema; return product and positive quantity candidates; mark unresolved or ambiguous candidates for vendor correction; do not access persistence through the LLM or call the stock-deduction path |
| Outputs | Untrusted structured draft containing product and quantity candidates plus ambiguity details; parser or validation error suitable for manual-entry fallback |

---

### FR-S-016 List saleable products and batches (Must)

The system shall list only the authenticated tenant's saleable products and active batches needed to prepare and confirm a sale.

| | |
|--|--|
| Inputs | Authenticated vendor JWT; optional product filter for the batch list |
| Processing | Derive tenant context from the JWT; query products and active batches under RLS; when a product filter is provided, return only batches belonging to that product |
| Outputs | Product and batch identifiers, display fields, product association, and `quantity_remaining` needed for vendor selection and confirmation |

# 3.2 Usability requirements

Issue: [#39](https://github.com/FreshLens-AI/FreshLens-AI/issues/39). Priority: Must.

### NFR-U-001 Scan in few steps (Must)

A signed-in vendor shall be able to complete capture, confirm quantity, and submit in no more than four primary screens or steps (excluding OS permission dialogs).

### NFR-U-002 Clear scan status language (Must)

While a scan is `pending` or `processing`, the UI shall say that classification is in progress and must not imply a final freshness result. On `failed`, the UI shall show a non-technical error and allow retry of a new scan.

### NFR-U-003 Classification readability (Must)

Completed classifications shall be shown with clear labels corresponding to `fresh`, `medium`, and `spoiled` (user-facing wording may capitalize or phrase equivalently, for example "Fresh").

### NFR-U-004 Empty states (Must)

Scan list and alert list shall show an explicit empty state when there are no items, rather than a blank or broken screen.

### NFR-U-005 Auth error feedback (Must)

Invalid credentials or expired sessions shall produce a visible message and a path back to sign-in. The app shall not silently ignore 401 responses on protected actions.

### NFR-U-006 Camera permission handling (Must)

If camera permission is denied, the mobile app shall explain that scanning requires camera access and provide a path to settings or a gallery fallback if gallery is supported for demos.

### NFR-U-007 Admin navigation (Should)

The web admin UI shall expose primary destinations (tenants, catalogue, analytics) in a persistent navigation pattern suitable for a desktop viewport.

### NFR-U-008 Accessibility baseline (Should)

Interactive controls shall have visible labels. Status must not be conveyed by color alone; pair color with text for freshness states.

### NFR-U-009 Sale confirmation and voice fallback (Must)

Before submitting a sale, the vendor UI shall show every product, batch, and quantity for explicit review and confirmation. When microphone permission is denied, speech recognition fails, parsing returns ambiguity, or product resolution fails, the app shall offer manual sale entry without blocking the vendor from recording the sale.

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

### NFR-R-005 Atomic and idempotent sale deduction (Must)

The system shall commit all items in a confirmed sale or commit none of them. Repeating a request with the same tenant and idempotency key shall return the original result without another deduction. A sale shall never make any batch `quantity_remaining` negative.

## 3.4 Performance and security

### NFR-P-001 Scan acceptance latency (Must)

For a valid authenticated scan request with image size <= 5 MB, the API shall return HTTP 202 within 2 seconds on the local/prototype environment (excluding client upload bandwidth extremes), measured from request fully received to response sent, excluding CNN runtime.

### NFR-P-002 Inference decoupling (Must)

End-to-end time from 202 acceptance to `completed` may vary with worker load. The system shall not require the client to hold an open HTTP request for inference, and shall not require the vendor to keep the app open for the duration of the queue. Primary delivery of terminal scan status shall be a mobile push notification; the client then fetches `GET /api/v1/scans/{id}` for authoritative fields. Continuous background polling is not the V1 delivery mechanism.

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

### NFR-SEC-007 Voice draft confirmation and data minimization (Must)

The system shall treat transcript text and LLM output as untrusted input, schema-validate LLM output, and require explicit vendor confirmation before a voice-assisted sale can call `POST /api/v1/sales`. Raw audio and transcripts shall not be retained by default. Clients shall not send `tenant_id`, and the system shall derive tenant context from the authenticated JWT rather than trust any client-supplied value.

## 3.5 Supportability

### NFR-SUP-001 Local run via Docker Compose (Must)

Developers shall be able to run core dependencies (at least PostgreSQL and Redis) via the project Docker Compose setup documented in the repo.

### NFR-SUP-002 Coding standards (Must)

API code shall follow the FastAPI / Python conventions of the repo; web and mobile shall follow existing TypeScript / Expo conventions. PRs shall pass CI lint/check stubs as configured.

### NFR-SUP-003 Logging (Should)

API and worker shall emit structured or clearly prefixed logs for scan accept, enqueue, classification success, and classification failure, enough to diagnose demo failures.

### NFR-SUP-004 Maintainability / monorepo layout (Must)

Code shall live in the approved monorepo paths (`apps/api`, `apps/web`, `apps/mobile`, `packages/ml`, `infra/db`, `infra/docker`) to keep ownership and reviews clear.

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

### NFR-DC-006 Voice sale interpretation boundary (Must, final V1)

Final V1 may use device speech-to-text and one provider-neutral external LLM parser only to interpret transcript text as a sale draft. The LLM shall not access persistence, mutate inventory, or bypass explicit vendor confirmation. Manual sale entry shall remain available when voice input cannot produce a valid and unambiguous draft.

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
| Device speech-to-text | Convert final V1 microphone input to transcript text without sending raw audio to FreshLens |
| Provider-neutral external LLM parser | Interpret final V1 transcript text as an untrusted structured sale draft; no persistence or inventory mutation access |
| Public ML datasets (e.g. Fruits-360 and freshness-labelled sets) | Training FL-2TC |
| GitHub / GitHub Actions | Source control and CI |

### NFR-PC-002 No paid ERP dependency (Must)

FreshLens shall not require purchase of a commercial ERP or inventory suite to operate the V1 prototype.

### NFR-PC-003 License compliance (Must)

Third-party libraries and datasets shall be used in accordance with their licenses. Attributions shall appear in the final report or NOTICE as required.

# 3.9 Interfaces (user, hardware, software, communications)

Issue: [#42](https://github.com/FreshLens-AI/FreshLens-AI/issues/42). Priority: Must.

Interface requirements state what must be exchanged. Wire formats for HTTP are described in `docs/api/v1/openapi.yaml`.

## User interfaces

### IR-UI-001 Vendor mobile UI (Must)

The vendor shall interact via a mobile GUI supporting: sign-in, camera/capture, quantity confirmation, scan submit/result, scan list, manual and voice-assisted sale entry, alerts, and a simple dashboard (see FR-V-\*).

### IR-UI-002 Platform admin web UI (Must)

The platform admin shall interact via a web GUI supporting: sign-in, tenant list/profiles, product catalogue, shelf-life configuration, and analytics (see FR-A-\*).

### IR-UI-003 Freshness presentation (Must)

UIs presenting classification shall map to the three labels `fresh` | `medium` | `spoiled` without inventing additional Tier-2 classes in V1.

## Hardware interfaces

### IR-HW-001 Smartphone camera (Must)

The vendor client shall use the device camera (or demo gallery fallback) as the sole produce sensor for V1. No barcode scanner, smart scale, or IoT sensor interface is required.

### IR-HW-002 Admin workstation (Must)

The admin client shall run in a modern desktop browser (Chrome/Edge/Firefox or Safari current ESR/stable). No special admin hardware is required.

### IR-HW-003 Smartphone microphone (Must, final V1)

The vendor client shall use the smartphone microphone for final V1 voice-assisted sale entry. The app shall request microphone permission and shall keep manual sale entry available when permission is denied or microphone input fails.

## Software interfaces

### IR-SW-001 FreshLens HTTP API (Must)

Clients shall integrate with the FreshLens API as specified in OpenAPI 3.1 (`docs/api/v1/openapi.yaml`), including at least:

| Method | Path | Role |
|--------|------|------|
| GET | `/health` | public |
| POST | `/api/v1/scans` | vendor, returns 202 |
| GET | `/api/v1/scans/{scan_id}` | vendor |
| GET | `/api/v1/scans` | vendor |
| GET | `/api/v1/alerts` | vendor |
| GET | `/api/v1/admin/tenants` | platform_admin |

Error bodies shall follow FastAPI-shaped `{ "detail": ... }` with 401 / 403 / 404 / 422 as applicable.

### IR-SW-002 Supabase Auth (Must)

The system shall validate Supabase-issued JWTs for protected routes.

### IR-SW-003 Object storage (Must)

The system shall store scan images in object storage (Cloudflare R2 or compatible) and reference them via `image_path` on scan records.

### IR-SW-004 PostgreSQL (Must)

The system shall persist business data in PostgreSQL with RLS as required in Section 3.10.

### IR-SW-005 Redis + Celery (Must)

The system shall use Redis-backed Celery (or the project's configured Celery broker) to queue classification jobs. Tenant-related Redis keys shall follow `tenant:{tenant_id}:...`.

### IR-SW-006 Sales API (Must)

The vendor client shall use these tenant-scoped sales interfaces:

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/products` | List saleable products for the authenticated tenant |
| GET | `/api/v1/batches` | List active batches, optionally filtered by product |
| POST | `/api/v1/sales` | Record one or more explicitly confirmed sale items and perform the only stock deduction |

`POST /api/v1/sales` shall accept an idempotency key and shall return validation and insufficient-stock outcomes without partial stock changes.

### IR-SW-007 Speech-to-text and LLM sale parser (Must, final V1)

The vendor client shall use device speech-to-text to convert microphone input into transcript text. It shall send transcript text, not raw audio, to `POST /api/v1/sales/voice-draft` for provider-neutral LLM parsing. The endpoint shall return an untrusted structured draft and shall not mutate inventory. Every line requires product resolution, a vendor-selected batch, and explicit confirmation through the Sales API before deduction.

## Communications interfaces

### IR-COM-001 HTTPS / HTTP JSON (Must)

Clients and API shall communicate over HTTP(S) with JSON response bodies (multipart for scan upload). Prototype local development may use HTTP on localhost.

Transcript text and sales API communication outside localhost shall use HTTPS.

### IR-COM-002 Bearer token header (Must)

Protected requests shall send `Authorization: Bearer <JWT>`.

### IR-COM-003 Push for scan and alert delivery; no client webhooks (Must)

V1 clients are not required to expose inbound webhooks. Scan completion and new or updated tenant alerts (FR-S-009, FR-S-010, FR-S-012) shall be delivered to the vendor mobile app primarily via push notifications (Expo Push / FCM / APNs). The app then retrieves authoritative data with `GET /api/v1/scans/{id}` for scans and `GET /api/v1/alerts` for alerts. Short limited polling is allowed only while a result screen is open, or as a fallback when push permission is denied.

# 3.10 Database requirements

Issue: [#43](https://github.com/FreshLens-AI/FreshLens-AI/issues/43). Priority: Must (P0).

These are logical data requirements. Physical schema, indexes, and exact SQL RLS policies belong in the SAD (Data View).

## Entities

### DR-001 Core entities (Must)

The persistent store shall support at least these entities and relationships:

| Entity | Purpose |
|--------|---------|
| `tenants` | Vendor organizations / isolation roots |
| `users` | Authenticated actors linked to a tenant and role |
| `products` | Catalogue items (produce types) available to tenants / platform |
| `scans` | Image submissions and classification results |
| `batches` | Intake groupings for quantity and aging |
| `sales` | Confirmed manual or voice-assisted sale transactions |
| `sale_items` | Product, batch, and quantity lines belonging to a sale |
| `device_tokens` | Tenant-scoped push notification tokens by user and device |
| `alerts` | Low-stock, aging, spoilage, and related notices |

### DR-002 Tenant column on business tables (Must)

Every business table that stores vendor operational data (`users`, `products` as tenant-scoped, `scans`, `batches`, `sales`, `sale_items`, `device_tokens`, `alerts`, and any future tenant-scoped table) shall include a `tenant_id` attribute referencing the owning tenant. Platform-global catalogue design may distinguish shared vs tenant-owned products in the SAD, but any tenant-owned row shall carry `tenant_id`.

### DR-003 RLS requirement (Must)

For every tenant-scoped table, the same database migration that creates the table shall enable RLS and define policies so that access is limited to rows matching the session `app.tenant_id`.

### DR-004 Scan attributes (Must)

A scan record shall be able to store at least:

| Attribute | Notes |
|-----------|--------|
| `id` | UUID |
| `tenant_id` | UUID |
| `image_path` | Object storage key/path |
| `quantity` | Integer >= 1 |
| `status` | `pending` \| `processing` \| `completed` \| `failed` |
| `classification` | `fresh` \| `medium` \| `spoiled` or null until complete |
| `freshness_score` | Numeric [0, 1] or null |
| `model_version` | String or null |
| `product_id` | Optional UUID |
| `batch_id` | Optional UUID |
| `created_at` / `updated_at` | Timestamps |

### DR-005 Batch attributes (Must)

A batch record shall be able to store at least:

| Attribute | Notes |
|-----------|--------|
| `id` | UUID |
| `tenant_id` | UUID |
| `product_id` | UUID |
| `intake_date` | Date/timestamp of intake |
| `quantity_received` | Integer |
| `quantity_remaining` | Non-negative integer changed only through validated inventory operations such as confirmed sales |
| Shelf-life context | Administrator-configurable typical shelf-life in days (per category or product); used for V1 static aging alerts |

### DR-006 Alert attributes (Must)

An alert record shall be able to store at least: `id`, `tenant_id`, `type` (`spoilage` \| `low_stock` \| `aging` \| `other`), `message`, `severity` (`info` \| `warning` \| `critical`), `created_at`, and optional `batch_id` / `product_id`.

### DR-007 Referential integrity (Must)

Scans may optionally reference a batch and product. Batches shall reference a product and tenant. Deleting or cascading rules shall not allow cross-tenant references.

### DR-008 Audit-friendly timestamps (Should)

Core mutable entities shall record creation time and, where updated, last update time.

### DR-009 Data retention (Could / prototype)

For the academic prototype, indefinite retention of demo business data is acceptable. Raw audio and transcripts used for voice-assisted sale drafts shall not be retained by default. Production retention and purge policies are out of scope for V1.

### DR-010 Sale transaction attributes (Must)

A sale record shall be able to store at least:

| Attribute | Notes |
|-----------|--------|
| `id` | UUID |
| `tenant_id` | UUID |
| `created_by` | UUID identifying the authenticated vendor |
| `source` | `manual` \| `voice` |
| `idempotency_key` | Client-generated key unique within the tenant |
| `created_at` | Timestamp |

The combination of `tenant_id` and `idempotency_key` shall be unique so retrying the same sale cannot create another deduction.

### DR-011 Sale item attributes and stock invariant (Must)

A sale item record shall be able to store at least:

| Attribute | Notes |
|-----------|--------|
| `id` | UUID |
| `tenant_id` | UUID |
| `sale_id` | UUID referencing the owning sale |
| `product_id` | UUID |
| `batch_id` | UUID |
| `quantity_sold` | Positive quantity |

Each sale, sale item, product, and batch reference shall belong to the same tenant. Each selected batch shall belong to the selected product. A sale deduction shall not make any batch `quantity_remaining` negative.

### DR-012 Device token attributes (Must)

A device token record shall be able to store at least:

| Attribute | Notes |
|-----------|--------|
| `id` | UUID |
| `tenant_id` | UUID |
| `user_id` | UUID referencing the owning user |
| `token` | Push notification token string |
| `platform` | Device platform identifier (e.g. ios, android) |
| `active` | Boolean indicating whether the token is currently valid |
| `created_at` / `updated_at` | Timestamps |

The same migration that creates `device_tokens` shall enable RLS and define policies limiting access to rows matching the session `app.tenant_id`.

# 3.11 to 3.12 Legal / standards and Section 4 Supporting information

Issue: [#44](https://github.com/FreshLens-AI/FreshLens-AI/issues/44). Priority: Must.

## 3.11 Licensing, legal, copyright, notices

### NFR-LEG-001 Academic prototype copyright (Must)

Source code and documentation produced for CS3203 Group 21 remain subject to course submission rules. Team members are listed in the project proposal.

### NFR-LEG-002 Third-party notices (Must)

Open-source dependencies and dataset licenses shall be respected. A NOTICE or final-report appendix shall list major third-party components used for the graded demo.

### NFR-LEG-003 Privacy of demo data (Should)

Prototype deployments shall avoid uploading real customer personal data beyond what is needed for auth (for example, demo emails). Produce photos used in demos should be team-captured or licensed dataset images.

### NFR-LEG-004 No warranty (Must)

The V1 academic prototype is provided for coursework demonstration and is not a commercial food-safety certification system. Classifications are assistive and do not replace human judgment for saleability.

## 3.12 Applicable standards



### NFR-STD-001 Requirements quality (Must)

This SRS is written to match the quality characteristics described in IEEE 830 / ISO/IEC/IEEE 29148 (correct, unambiguous, verifiable, traceable, ranked) while following the CS3203 SRS template section order.

### NFR-STD-002 API description (Must)

The HTTP interface shall be described using OpenAPI 3.1 for V1.

### NFR-STD-003 Secure multi-tenancy (Must)

Tenant isolation requirements follow defense in depth with PostgreSQL RLS as the authoritative data-plane control.

---



## 4. Supporting information



### 4.1 Document status


| Field           | Value                                                                               |
| --------------- | ----------------------------------------------------------------------------------- |
| Product         | FreshLens                                                                           |
| Course          | CS3203 Software Engineering Project                                                 |
| Group / PID     | 21 / 5                                                                              |
| Milestone       | M2: SRS + Architecture (due 2026-08-09)                                             |
| Companion       | Software Architecture Document (SAD), issue #6, `docs/design/`                      |
| Working sources | Files under `docs/srs/*.md`; master assemble `FreshLens-SRS.md`                     |
| Submission note | Paste into official CS3203 SRS template; remove InfoBlue guidance before PDF submit |




### 4.2 Revision history


| Version | Date       | Author(s) | Changes                                                        |
| ------- | ---------- | --------- | -------------------------------------------------------------- |
| 0.1     | 2026-07-25 | Group 21  | Initial SRS draft from proposal + OpenAPI + architecture rules |
| 0.2     | 2026-07-26 | Group 21  | Push notification implementation                               |
| 0.3     | 2026-08-02 | Group 21  | Added manual and voice-assisted sale requirements              |




### 4.3 Traceability (selected)


| Req ID                           | Source                                              | Verification idea                                                                           |
| -------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| FR-S-001                         | Proposal Section 2 scan flow; OpenAPI `POST /scans` | Integration test: 202 before classification fields set                                      |
| FR-S-007                         | Proposal FL-2TC; OpenAPI `Classification`           | Assert enum; stub vs model_version                                                          |
| FR-S-008                         | Architecture rules                                  | Code review / static check no inference in routes                                           |
| FR-S-009 / FR-S-010              | Proposal Section 5.2 alerts                         | Unit/integration tests for threshold and aging rule                                         |
| FR-S-013 / FR-V-008 / IR-COM-003 | Proposal Section 5.2 alerts; mobile push delivery   | Integration test: alert creation triggers push; app fetches `GET /api/v1/alerts` on receive |
| FR-V-011 / FR-S-014              | Approved mid-evaluation manual sale scope           | Manual and integration tests for one-item confirmation and committed stock deduction        |
| FR-V-012 / FR-S-015              | Approved final V1 voice-assisted sale scope         | Voice draft schema, ambiguity, correction, and explicit confirmation tests                  |
| FR-S-016                         | Sale product and batch selection                    | Integration tests for tenant-scoped product lookup and product-filtered active batches      |
| NFR-R-005                        | Sale transaction reliability                        | Concurrent atomicity, insufficient-stock rollback, and idempotency tests                    |
| NFR-SEC-007                      | Voice draft trust boundary and data minimization    | Tests for schema validation, explicit confirmation, tenant derivation, and no default retention |
| NFR-SEC-003 / DR-003             | Architecture RLS                                    | Dedicated RLS isolation tests (different tenant JWTs)                                       |
| NFR-P-001                        | OpenAPI async contract                              | Latency test on accept path                                                                 |
| FR-V-                            | Proposal mobile scope                               | Manual / E2E mobile demo script                                                             |
| FR-A-                            | Proposal web scope                                  | Manual admin demo script                                                                    |
| DR-004 / DR-005                  | Architecture record shapes                          | Schema review vs SAD Data View                                                              |
| DR-010 / DR-011                  | Approved sale data requirements                     | Schema and invariant review against the SAD Data View                                       |




### 4.4 Glossary cross-reference

See Section 1.3 Definitions. Enumerations for API fields must match `docs/api/v1/openapi.yaml`.

### 4.5 Assembly checklist

- [x] Section 1 Introduction
- [x] Section 2 Overall Description
- [x] Section 3.1 Vendor, Admin, Scan/ML/Alerts
- [x] Section 3.2 Usability
- [x] Section 3.3 to 3.5 NFRs
- [x] Section 3.6 to 3.8 Constraints / help / purchased
- [x] Section 3.9 Interfaces
- [x] Section 3.10 Database
- [x] Section 3.11 to 3.12 Legal / standards
- [x] Assembled master: `FreshLens-SRS.md`
- [ ] Paste into CS3203 Word template and strip InfoBlue (team submission step)
- [ ] Mentor review
- [ ] Close parent issue #5 after PDF accepted internally
