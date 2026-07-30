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
| Inputs | Product/batch quantity remaining; configured threshold |
| Processing | Compare remaining quantity to threshold; create alert with type `low_stock` and appropriate severity |
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
