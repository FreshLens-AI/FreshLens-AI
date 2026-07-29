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
| Processing | Submit credentials to Supabase Auth over HTTPS; on success store JWT securely on-device and attach as Bearer token on all API calls; register or refresh a push device token with the backend for scan-completion notifications (FR-V-006); on invalid credentials show inline error without establishing a session; on session expiry prompt re-authentication before further scanning or dashboard access |
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

### FR-V-008 View alerts and batch context (Must)

The mobile application shall display tenant alerts (via `GET /api/v1/alerts`), including low-stock and static aging alerts with batch context, and an empty state when none exist.

| | |
|--|--|
| Inputs | Authenticated session; backend alert data (low-stock thresholds, shelf-life aging rules) |
| Processing | Fetch tenant-scoped alerts; render type, severity, message; link each alert to batch context (intake date, quantity received, quantity remaining, category shelf-life) where applicable; alerts are read-only on mobile in V1 |
| Outputs | Alerts list scoped to vendor tenant; batch context per alert sufficient to act (reorder, discount, remove aging stock) |

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
