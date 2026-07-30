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