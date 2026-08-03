# 4. Use-Case View

This view selects the scenarios that force architectural decisions. Ordinary CRUD that does not change concurrency, isolation, or deduction rules is omitted. Actors are Vendor and Platform Admin. External systems appear where they participate in a flow.

## 4.1 Use-case diagram

![Figure 4.1. Architecturally significant use cases](diagrams/fig-4-1-use-cases.png)

*Figure 4.1. Architecturally significant FreshLens V1 use cases. Vendor flows cover authentication, scan, sale (manual and voice-assisted), and alerts. Admin flows cover tenants, catalogue, and analytics. Sales always terminate in the shared sales service.*

## 4.2 UC-V-AUTH: Vendor authentication

| Field | Content |
|---|---|
| Actor | Vendor |
| Description | Sign in through Supabase Auth and obtain a JWT that carries tenant and role claims |
| Preconditions | Vendor account exists for a tenant |
| Main flow | 1. Vendor opens the mobile app. 2. App redirects or presents Supabase sign-in. 3. Auth returns a JWT. 4. App stores the session and attaches `Authorization: Bearer` on API calls. |
| Success | Subsequent API calls can set `app.tenant_id` from the JWT |
| Failure | Invalid credentials or missing tenant claim; API returns 401 |
| Extensions | Token refresh; sign-out clears local session |
| Requirements | FR-V-001, NFR-SEC-001, NFR-SEC-002 |

## 4.3 UC-V-SCAN: Submit produce scan

| Field | Content |
|---|---|
| Actor | Vendor |
| Description | Capture one product photo, confirm quantity, and submit for asynchronous classification |
| Preconditions | Authenticated vendor; camera available |
| Main flow | 1. Vendor captures a photo of one product. 2. Vendor confirms quantity >= 1. 3. Mobile uploads via `POST /api/v1/scans`. 4. API stores image in R2, inserts pending scan, enqueues Celery job, returns 202 with scan id. 5. Worker classifies and writes result. |
| Success | Scan accepted with HTTP 202; later status becomes completed or failed |
| Failure | Auth failure, oversized image, or enqueue failure after storage |
| Extensions | Mid-evaluation may use stub classifier; later FL-2TC |
| Requirements | FR-V-002, FR-V-003, FR-S-001, FR-S-002, FR-S-003, FR-S-008 |

![Figure 4.2. Scan use-case realization](diagrams/fig-4-2-scan-realization.png)

*Figure 4.2. Realization of submit produce scan. The API accepts work and returns 202. Classification runs in the worker, not in the request handler.*

## 4.4 UC-V-RESULT: View scan result

| Field | Content |
|---|---|
| Actor | Vendor |
| Description | Inspect scan status and classification for the vendor's tenant |
| Preconditions | Authenticated vendor; at least one submitted scan |
| Main flow | 1. Vendor opens scan list or detail. 2. Mobile calls list/get scan endpoints. 3. API reads under RLS and returns status, score, and classification when present. |
| Success | Vendor sees pending, processing, completed, or failed with labels when completed |
| Failure | 401/403; empty list when no scans |
| Extensions | Push wake-up may deep-link to a completed scan |
| Requirements | FR-V-004, FR-V-005, FR-S-007 |

## 4.5 UC-V-SALE-MANUAL: Record manual sale

| Field | Content |
|---|---|
| Actor | Vendor |
| Description | Mid-evaluation path: one product, one vendor-selected batch, positive quantity, explicit confirm |
| Preconditions | Authenticated vendor; product and batch with remaining stock |
| Main flow | 1. Vendor opens Record Sale. 2. Selects product and batch. 3. Enters quantity. 4. Confirms. 5. Mobile sends `POST /api/v1/sales` with Idempotency-Key. 6. Sales service locks batch, validates stock, deducts, commits, evaluates low-stock. |
| Success | Sale persisted; batch quantity reduced once; optional low-stock alert |
| Failure | Insufficient stock, missing batch, auth failure; no partial deduction |
| Extensions | Retry with same Idempotency-Key returns original sale |
| Requirements | FR-V-011, FR-S-014, FR-S-016, NFR-R-005, NFR-U-009 |

## 4.6 UC-V-SALE-VOICE: Record voice-assisted sale

| Field | Content |
|---|---|
| Actor | Vendor |
| Description | Final V1 path: device STT and LLM draft, then product resolution, batch selection, and confirmation into the shared sales API |
| Preconditions | Authenticated vendor; microphone and device speech-to-text available, or manual fallback |
| Main flow | 1. Vendor speaks a sale. 2. Device STT produces a transcript locally. 3. Mobile posts transcript to `POST /api/v1/sales/voice-draft`. 4. API calls LLM parser and returns untrusted draft lines. 5. Vendor resolves products, selects batches, edits quantities, confirms. 6. Mobile calls `POST /api/v1/sales` for the confirmed items. |
| Success | Confirmed lines deduct stock through the shared sales service |
| Failure | Parse failure, unresolved product, missing batch, or declined confirmation; inventory unchanged |
| Extensions | Vendor abandons draft and uses manual form (FR-V-011) |
| Requirements | FR-V-012, FR-S-015, FR-S-014, NFR-SEC-007, NFR-U-009, IR-HW-003, IR-SW-006 |

## 4.7 UC-V-ALERTS: View alerts and dashboard

| Field | Content |
|---|---|
| Actor | Vendor |
| Description | Review spoilage, low-stock, aging, and other alerts; see dashboard summaries |
| Preconditions | Authenticated vendor |
| Main flow | 1. Vendor opens alerts or dashboard. 2. Mobile fetches tenant-scoped alerts and summary data. 3. Push may have already woken the device for a new alert. |
| Success | Alerts listed under RLS; low-stock reflects post-sale quantities |
| Failure | Auth failure |
| Extensions | Mark-as-read if implemented later without changing alert creation rules |
| Requirements | FR-V-006, FR-V-007, FR-V-008, FR-S-009 through FR-S-013, issue #19 |

## 4.8 UC-A-TENANT: Administer tenants

| Field | Content |
|---|---|
| Actor | Platform Admin |
| Description | List and manage vendor organizations |
| Preconditions | Admin JWT with platform_admin role |
| Main flow | 1. Admin opens tenant admin screen. 2. Web calls admin tenant endpoints. 3. API enforces role and returns tenant list or updates. |
| Success | Admin sees cross-tenant administrative data allowed by role |
| Failure | Vendor JWT cannot access admin routes |
| Extensions | Create or deactivate tenant when those endpoints land |
| Requirements | FR-A-001, FR-A-002 |

## 4.9 UC-A-CATALOGUE: Manage catalogue and shelf life

| Field | Content |
|---|---|
| Actor | Platform Admin |
| Description | Maintain products and `shelf_life_days` used by V1 static aging alerts |
| Preconditions | Admin authenticated |
| Main flow | 1. Admin opens catalogue. 2. Creates or edits products and shelf-life days. 3. API persists under admin authorization. |
| Success | Products available for vendor batches and aging rules |
| Failure | Validation or auth failure |
| Extensions | Category-level defaults if introduced without breaking per-product override |
| Requirements | FR-A-005, FR-A-006 |

![Figure 4.3. Admin catalogue use-case realization](diagrams/fig-4-3-admin-catalogue-realization.png)

*Figure 4.3. Realization of catalogue and shelf-life administration. Admin web talks only to the API; aging rules later read `shelf_life_days` from persistence.*

## 4.10 UC-A-ANALYTICS: View platform analytics

| Field | Content |
|---|---|
| Actor | Platform Admin |
| Description | View aggregated scan, alert, and inventory analytics across tenants as authorized |
| Preconditions | Admin authenticated |
| Main flow | 1. Admin opens analytics. 2. Web requests aggregated metrics. 3. API returns aggregates without exposing unauthorized vendor detail beyond admin policy. |
| Success | Charts or tables render from API aggregates |
| Failure | Auth or empty data |
| Extensions | Export later without changing isolation rules for vendor JWTs |
| Requirements | FR-A-007, FR-A-008 |

## 4.11 Architecturally significant realizations

Scan acceptance and sale confirmation are the two realizations that lock concurrency and isolation choices. Scan must return 202 and enqueue work. Sale must be the only deduction path, atomic and idempotent, whether the UI was a form or a confirmed voice draft.
