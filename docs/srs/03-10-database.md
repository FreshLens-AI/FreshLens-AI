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
