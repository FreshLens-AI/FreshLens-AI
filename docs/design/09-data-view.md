# 9. Data View

This view defines the logical data model, tenant isolation, and sale invariants. Physical indexes and migration filenames evolve in `infra/db/migrations/`; the rules here are stable for V1.

## 9.1 Entity-relationship model

Core entities: `tenants`, `users`, `products`, `batches`, `scans`, `alerts`, `device_tokens`, `sales`, `sale_items`.

| Entity | Primary key | Notable attributes | Cardinality notes |
|---|---|---|---|
| `tenants` | `id` uuid | name, timestamps | Root |
| `users` | `id` uuid | `tenant_id`, role, auth subject | N users per tenant |
| `products` | `id` uuid | `tenant_id`, name, `shelf_life_days`, `low_stock_threshold` | N products per tenant |
| `batches` | `id` uuid | `tenant_id`, `product_id`, intake dates, quantities | N batches per product |
| `scans` | `id` uuid | `tenant_id`, `image_path`, status, classification fields, optional `batch_id` | N scans per tenant |
| `alerts` | `id` uuid | `tenant_id`, type, severity, optional product/batch | N alerts per tenant |
| `device_tokens` | `id` uuid | `tenant_id`, user/device token fields | N tokens per tenant |
| `sales` | `id` uuid | `tenant_id`, `source`, `idempotency_key`, `created_at` | N sales per tenant |
| `sale_items` | `id` uuid | `tenant_id`, `sale_id`, `product_id`, `batch_id`, `quantity_sold` | N items per sale |

Every business table above includes `tenant_id` and an RLS policy in the same migration that creates the table (DR-001 through DR-012). Cross-tenant foreign keys are rejected by RLS and by application checks that resolve related rows under the same `app.tenant_id`.

![Figure 9.1. Entity-relationship model](diagrams/fig-9-1-er-model.png)

*Figure 9.1. Logical ER model for FreshLens V1, including sales, sale_items, and device_tokens.*

## 9.2 RLS and request context

On each authenticated API request (and on worker DB sessions that act for a tenant), the session executes `SET app.tenant_id = '<uuid from JWT>'` before business SQL. Policies follow:

```sql
USING (tenant_id = current_setting('app.tenant_id')::uuid)
```

Application `WHERE tenant_id = ...` filters are defense in depth only.

![Figure 9.2. Auth to RLS sequence](diagrams/fig-9-2-auth-rls-sequence.png)

*Figure 9.2. JWT validation sets tenant context; PostgreSQL RLS restricts rows for the rest of the transaction.*

## 9.3 Sale and stock invariants

1. `sales.idempotency_key` is unique per tenant so retries cannot create a second deduction.
2. Each `sale_items` row references a product and a vendor-selected batch in the same tenant.
3. Before deduction, the sales transaction locks the selected batch rows and checks `quantity_remaining >= quantity_sold`.
4. Deduction updates `quantity_remaining` without allowing negative values.
5. Low-stock evaluation uses committed post-sale quantities.
6. Voice drafts are not tables of record; raw audio and transcripts are not retained by default.

## 9.4 Scan image storage

`scans.image_path` points at an object in Cloudflare R2. Binary image bytes are not stored in PostgreSQL. Classification fields remain null until the worker completes.

## 9.5 Traceability

| Rule | Requirement IDs |
|---|---|
| tenant_id + RLS same migration | DR-001, DR-002, DR-003 |
| sales / sale_items | DR-010, DR-011, FR-S-014 |
| device_tokens tenant scope | DR-012, FR-S-013 |
| non-negative batches / idempotent sales | NFR-R-005 |
| no default transcript retention | NFR-SEC-007 |
