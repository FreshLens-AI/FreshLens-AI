# 3.1 Functionality: Vendor (mobile)

Issue: [#36](https://github.com/FreshLens-AI/FreshLens-AI/issues/36). Priority: Must.

Client: Expo / React Native mobile app. Role: `vendor`.

V1 does not require on-device CNN inference. Classification runs on the backend worker.

---

### FR-V-001 Vendor authentication (Must)

The mobile application shall allow a vendor to sign in using the project's Supabase Auth flow and retain a session token for API calls.

| | |
|--|--|
| Inputs | Vendor credentials (as supported by Supabase Auth for the prototype) |
| Processing | Obtain JWT; store securely on device per Expo/secure-store practices used by the app |
| Outputs | Authenticated session; subsequent API calls send `Authorization: Bearer <JWT>` |

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

The mobile application shall provide a camera interface (or gallery-picker fallback for demos) to capture one product type per photo for a scan.

| | |
|--|--|
| Inputs | Camera/gallery image |
| Processing | Preview image; allow retake before submit |
| Outputs | Image ready for upload with the scan request |

---

### FR-V-004 Confirm quantity at scan time (Must)

Before submit, the mobile application shall require the vendor to enter or confirm a quantity (integer >= 1) associated with the scan.

| | |
|--|--|
| Inputs | Vendor quantity entry |
| Processing | Validate >= 1; include as `quantity` in multipart submit |
| Outputs | Quantity bound to the pending submission |

---

### FR-V-005 Submit scan (Must)

The mobile application shall submit the image and quantity to `POST /api/v1/scans` and treat HTTP 202 as successful acceptance.

| | |
|--|--|
| Inputs | Image and quantity (optional product/batch ids if the UI supports linking) |
| Processing | Multipart upload with Bearer token; handle 401/403/422 errors with user-visible messages |
| Outputs | Accepted scan `id` and initial `status`; navigate to result/waiting UI |

---

### FR-V-006 View scan result status (Must)

After acceptance, the mobile application shall let the vendor view scan status and, when `completed`, show `classification` and `freshness_score` (polling `GET /api/v1/scans/{id}` or equivalent).

| | |
|--|--|
| Inputs | Scan id |
| Processing | Poll or refresh until terminal status; show pending, processing, failed, or completed as appropriate |
| Outputs | Status UI; on completed: freshness label and score |

---

### FR-V-007 List recent scans (Must)

The mobile application shall display a list of the vendor's recent scans for their tenant (via `GET /api/v1/scans`).

| | |
|--|--|
| Inputs | Authenticated session; optional pagination |
| Processing | Fetch list; render summary (status, time, classification if present) |
| Outputs | Scrollable scan history |

---

### FR-V-008 View alerts (Must)

The mobile application shall display tenant alerts (via `GET /api/v1/alerts`), including an empty state when none exist.

| | |
|--|--|
| Inputs | Authenticated session |
| Processing | Fetch alerts; show type, severity, message |
| Outputs | Alerts screen / section |

---

### FR-V-009 Inventory / freshness dashboard summary (Must)

The mobile application shall provide a simple dashboard summarizing the vendor's recent freshness and inventory information derived from scans (and batches when available), enough for the mid-evaluation demo.

| | |
|--|--|
| Inputs | Scan/alert/batch data from API |
| Processing | Aggregate or list key metrics in UI |
| Outputs | Dashboard view |

---

### FR-V-010 Offline capture queue (Could / V2)

Queuing scans while offline is not required for V1. If implemented later, uploads shall resume when connectivity returns without breaking tenant isolation.
