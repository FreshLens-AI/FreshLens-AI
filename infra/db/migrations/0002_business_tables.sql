begin;

-- Tenant-scoped operational tables (SAD §9 / SRS §3.10). Identity roots remain
-- in 0001. Every table here carries tenant_id + RLS in this same migration.

create type public.scan_status as enum (
  'pending',
  'processing',
  'completed',
  'failed'
);

create type public.classification as enum (
  'fresh',
  'medium',
  'spoiled'
);

create type public.alert_type as enum (
  'spoilage',
  'low_stock',
  'aging',
  'other'
);

create type public.alert_severity as enum (
  'info',
  'warning',
  'critical'
);

create type public.sale_source as enum (
  'manual',
  'voice'
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  shelf_life_days integer not null check (shelf_life_days > 0),
  low_stock_threshold integer not null default 0 check (low_stock_threshold >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id)
);

create index products_tenant_id_idx on public.products (tenant_id);

create table public.batches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  product_id uuid not null,
  intake_date timestamptz not null default now(),
  quantity_received integer not null check (quantity_received >= 0),
  quantity_remaining integer not null check (quantity_remaining >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (quantity_remaining <= quantity_received),
  unique (id, tenant_id),
  foreign key (product_id, tenant_id)
    references public.products (id, tenant_id)
    on delete restrict
);

create index batches_tenant_id_idx on public.batches (tenant_id);
create index batches_product_id_idx on public.batches (product_id);

create table public.scans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  image_path text not null check (char_length(trim(image_path)) > 0),
  quantity integer not null check (quantity >= 1),
  status public.scan_status not null default 'pending',
  classification public.classification,
  freshness_score real check (
    freshness_score is null
    or (freshness_score >= 0 and freshness_score <= 1)
  ),
  model_version text,
  product_id uuid,
  batch_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (product_id, tenant_id)
    references public.products (id, tenant_id)
    on delete set null,
  foreign key (batch_id, tenant_id)
    references public.batches (id, tenant_id)
    on delete set null
);

create index scans_tenant_id_idx on public.scans (tenant_id);
create index scans_status_idx on public.scans (tenant_id, status);
create index scans_created_at_idx on public.scans (tenant_id, created_at desc);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  created_by uuid not null references public.users (id) on delete restrict,
  source public.sale_source not null,
  idempotency_key text not null check (char_length(trim(idempotency_key)) > 0),
  created_at timestamptz not null default now(),
  unique (id, tenant_id),
  unique (tenant_id, idempotency_key)
);

create index sales_tenant_id_idx on public.sales (tenant_id);
create index sales_created_at_idx on public.sales (tenant_id, created_at desc);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  sale_id uuid not null,
  product_id uuid not null,
  batch_id uuid not null,
  quantity_sold integer not null check (quantity_sold >= 1),
  created_at timestamptz not null default now(),
  foreign key (sale_id, tenant_id)
    references public.sales (id, tenant_id)
    on delete cascade,
  foreign key (product_id, tenant_id)
    references public.products (id, tenant_id)
    on delete restrict,
  foreign key (batch_id, tenant_id)
    references public.batches (id, tenant_id)
    on delete restrict
);

create index sale_items_tenant_id_idx on public.sale_items (tenant_id);
create index sale_items_sale_id_idx on public.sale_items (sale_id);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  type public.alert_type not null,
  severity public.alert_severity not null,
  message text not null check (char_length(trim(message)) > 0),
  product_id uuid,
  batch_id uuid,
  created_at timestamptz not null default now(),
  foreign key (product_id, tenant_id)
    references public.products (id, tenant_id)
    on delete set null,
  foreign key (batch_id, tenant_id)
    references public.batches (id, tenant_id)
    on delete set null
);

create index alerts_tenant_id_idx on public.alerts (tenant_id);
create index alerts_created_at_idx on public.alerts (tenant_id, created_at desc);

create table public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  token text not null check (char_length(trim(token)) > 0),
  platform text not null check (platform in ('ios', 'android', 'web')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, token)
);

create index device_tokens_tenant_id_idx on public.device_tokens (tenant_id);
create index device_tokens_user_id_idx on public.device_tokens (user_id);

-- Vendor rows match app.tenant_id and require an active tenant (same edge as
-- identity policies). Platform admin bypass supports Day-3 catalogue/admin reads.
-- ponytail: one all-command policy per table; split by command if write rules diverge.
create or replace function public.vendor_owns_active_tenant(row_tenant_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select
    public.current_app_role() = 'vendor'
    and row_tenant_id is not null
    and row_tenant_id = public.current_tenant_id()
    and exists (
      select 1
      from public.tenants as active_tenant
      where active_tenant.id = public.current_tenant_id()
        and active_tenant.status = 'active'
    )
$$;

create policy products_tenant_isolation
on public.products
for all
to authenticated, freshlens_api
using (
  public.current_app_role() = 'platform_admin'
  or public.vendor_owns_active_tenant(tenant_id)
)
with check (
  public.current_app_role() = 'platform_admin'
  or public.vendor_owns_active_tenant(tenant_id)
);

create policy batches_tenant_isolation
on public.batches
for all
to authenticated, freshlens_api
using (
  public.current_app_role() = 'platform_admin'
  or public.vendor_owns_active_tenant(tenant_id)
)
with check (
  public.current_app_role() = 'platform_admin'
  or public.vendor_owns_active_tenant(tenant_id)
);

create policy scans_tenant_isolation
on public.scans
for all
to authenticated, freshlens_api
using (
  public.current_app_role() = 'platform_admin'
  or public.vendor_owns_active_tenant(tenant_id)
)
with check (
  public.current_app_role() = 'platform_admin'
  or public.vendor_owns_active_tenant(tenant_id)
);

create policy sales_tenant_isolation
on public.sales
for all
to authenticated, freshlens_api
using (
  public.current_app_role() = 'platform_admin'
  or public.vendor_owns_active_tenant(tenant_id)
)
with check (
  public.current_app_role() = 'platform_admin'
  or public.vendor_owns_active_tenant(tenant_id)
);

create policy sale_items_tenant_isolation
on public.sale_items
for all
to authenticated, freshlens_api
using (
  public.current_app_role() = 'platform_admin'
  or public.vendor_owns_active_tenant(tenant_id)
)
with check (
  public.current_app_role() = 'platform_admin'
  or public.vendor_owns_active_tenant(tenant_id)
);

create policy alerts_tenant_isolation
on public.alerts
for all
to authenticated, freshlens_api
using (
  public.current_app_role() = 'platform_admin'
  or public.vendor_owns_active_tenant(tenant_id)
)
with check (
  public.current_app_role() = 'platform_admin'
  or public.vendor_owns_active_tenant(tenant_id)
);

create policy device_tokens_tenant_isolation
on public.device_tokens
for all
to authenticated, freshlens_api
using (
  public.current_app_role() = 'platform_admin'
  or public.vendor_owns_active_tenant(tenant_id)
)
with check (
  public.current_app_role() = 'platform_admin'
  or public.vendor_owns_active_tenant(tenant_id)
);

revoke all on function public.vendor_owns_active_tenant(uuid) from public;
grant execute on function public.vendor_owns_active_tenant(uuid)
to authenticated, freshlens_api;

alter table public.products enable row level security;
alter table public.products force row level security;
alter table public.batches enable row level security;
alter table public.batches force row level security;
alter table public.scans enable row level security;
alter table public.scans force row level security;
alter table public.sales enable row level security;
alter table public.sales force row level security;
alter table public.sale_items enable row level security;
alter table public.sale_items force row level security;
alter table public.alerts enable row level security;
alter table public.alerts force row level security;
alter table public.device_tokens enable row level security;
alter table public.device_tokens force row level security;

revoke all on public.products from anon;
revoke all on public.batches from anon;
revoke all on public.scans from anon;
revoke all on public.sales from anon;
revoke all on public.sale_items from anon;
revoke all on public.alerts from anon;
revoke all on public.device_tokens from anon;

grant usage on type public.scan_status to authenticated, freshlens_api;
grant usage on type public.classification to authenticated, freshlens_api;
grant usage on type public.alert_type to authenticated, freshlens_api;
grant usage on type public.alert_severity to authenticated, freshlens_api;
grant usage on type public.sale_source to authenticated, freshlens_api;

grant select, insert, update, delete on public.products to authenticated, freshlens_api;
grant select, insert, update, delete on public.batches to authenticated, freshlens_api;
grant select, insert, update, delete on public.scans to authenticated, freshlens_api;
grant select, insert, update, delete on public.sales to authenticated, freshlens_api;
grant select, insert, update, delete on public.sale_items to authenticated, freshlens_api;
grant select, insert, update, delete on public.alerts to authenticated, freshlens_api;
grant select, insert, update, delete on public.device_tokens to authenticated, freshlens_api;

commit;
