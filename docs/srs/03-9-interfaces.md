# 3.9 Interfaces (user, hardware, software, communications)

Issue: [#42](https://github.com/FreshLens-AI/FreshLens-AI/issues/42). Priority: Must.

Interface requirements state what must be exchanged. Wire formats for HTTP are described in `docs/api/v1/openapi.yaml`.

## User interfaces

### IR-UI-001 Vendor mobile UI (Must)

The vendor shall interact via a mobile GUI supporting: sign-in, camera/capture, quantity confirmation, scan submit/result, scan list, alerts, and a simple dashboard (see FR-V-\*).

### IR-UI-002 Platform admin web UI (Must)

The platform admin shall interact via a web GUI supporting: sign-in, tenant list/profiles, product catalogue, shelf-life configuration, and analytics (see FR-A-\*).

### IR-UI-003 Freshness presentation (Must)

UIs presenting classification shall map to the three labels `fresh` | `medium` | `spoiled` without inventing additional Tier-2 classes in V1.

## Hardware interfaces

### IR-HW-001 Smartphone camera (Must)

The vendor client shall use the device camera (or demo gallery fallback) as the sole produce sensor for V1. No barcode scanner, smart scale, or IoT sensor interface is required.

### IR-HW-002 Admin workstation (Must)

The admin client shall run in a modern desktop browser (Chrome/Edge/Firefox or Safari current ESR/stable). No special admin hardware is required.

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

## Communications interfaces

### IR-COM-001 HTTPS / HTTP JSON (Must)

Clients and API shall communicate over HTTP(S) with JSON response bodies (multipart for scan upload). Prototype local development may use HTTP on localhost.

### IR-COM-002 Bearer token header (Must)

Protected requests shall send `Authorization: Bearer <JWT>`.

### IR-COM-003 Push for scan completion; no client webhooks (Must)

V1 clients are not required to expose inbound webhooks. Scan completion shall be delivered to the vendor mobile app primarily via push notifications (Expo Push / FCM / APNs). The app then retrieves authoritative scan data with `GET /api/v1/scans/{id}`. Short limited polling is allowed only while a result screen is open, or as a fallback when push permission is denied.
