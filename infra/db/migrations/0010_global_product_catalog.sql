begin;

-- Products are shared reference data. Inventory and activity remain tenant-owned
-- through batches, scans, sales, sale_items, and alerts.
alter table public.batches
  drop constraint batches_product_id_tenant_id_fkey;
alter table public.scans
  drop constraint scans_product_id_tenant_id_fkey;
alter table public.sale_items
  drop constraint sale_items_product_id_tenant_id_fkey;
alter table public.alerts
  drop constraint alerts_product_id_tenant_id_fkey;

-- Existing deployments may contain one copy of a product per tenant. Point all
-- operational rows at the oldest copy before collapsing those duplicates.
create temporary table product_catalog_merge on commit drop as
select
  id as source_id,
  first_value(id) over (
    partition by lower(trim(name))
    order by created_at, id
  ) as canonical_id
from public.products;

update public.batches as batches
set product_id = merge.canonical_id
from product_catalog_merge as merge
where batches.product_id = merge.source_id
  and merge.source_id <> merge.canonical_id;

update public.scans as scans
set product_id = merge.canonical_id
from product_catalog_merge as merge
where scans.product_id = merge.source_id
  and merge.source_id <> merge.canonical_id;

update public.sale_items as sale_items
set product_id = merge.canonical_id
from product_catalog_merge as merge
where sale_items.product_id = merge.source_id
  and merge.source_id <> merge.canonical_id;

update public.alerts as alerts
set product_id = merge.canonical_id
from product_catalog_merge as merge
where alerts.product_id = merge.source_id
  and merge.source_id <> merge.canonical_id;

delete from public.products as products
using product_catalog_merge as merge
where products.id = merge.source_id
  and merge.source_id <> merge.canonical_id;

drop policy products_tenant_isolation on public.products;
drop index public.products_tenant_id_idx;
alter table public.products
  drop constraint products_id_tenant_id_key,
  drop constraint products_tenant_id_fkey,
  drop column tenant_id;

create unique index products_normalized_name_unique
on public.products (lower(trim(name)));

-- Keep the model-supported catalogue present even in installations that had
-- no demo tenant or tenant-specific product rows.
with defaults (id, name, shelf_life_days, low_stock_threshold) as (
  values
    ('11111111-1111-4111-8111-111111111201'::uuid, 'Tomato', 5, 3),
    ('11111111-1111-4111-8111-111111111202'::uuid, 'Banana', 3, 2),
    ('11111111-1111-4111-8111-111111111203'::uuid, 'Cucumber', 7, 3),
    ('11111111-1111-4111-8111-111111111204'::uuid, 'Eggplant', 5, 3)
)
insert into public.products (
  id, name, shelf_life_days, low_stock_threshold
)
select
  defaults.id,
  defaults.name,
  coalesce(
    rules.fresh_to_medium_days + rules.medium_to_spoiled_days,
    defaults.shelf_life_days
  ),
  defaults.low_stock_threshold
from defaults
left join public.product_category_shelf_life as rules
  on rules.category = lower(defaults.name)
where not exists (
  select 1
  from public.products
  where lower(trim(products.name)) = lower(defaults.name)
)
on conflict do nothing;

alter table public.batches
  add constraint batches_product_id_fkey
  foreign key (product_id) references public.products (id) on delete restrict;
alter table public.scans
  add constraint scans_product_id_fkey
  foreign key (product_id) references public.products (id) on delete set null;
alter table public.sale_items
  add constraint sale_items_product_id_fkey
  foreign key (product_id) references public.products (id) on delete restrict;
alter table public.alerts
  add constraint alerts_product_id_fkey
  foreign key (product_id) references public.products (id) on delete set null;

create policy products_catalog_read
on public.products
for select
to authenticated, freshlens_api
using (
  public.current_app_role() = 'platform_admin'
  or public.current_vendor_has_access()
);

create policy products_catalog_admin_write
on public.products
for all
to authenticated, freshlens_api
using (public.current_app_role() = 'platform_admin')
with check (public.current_app_role() = 'platform_admin');

comment on table public.products is
  'Global produce catalogue shared by every active tenant; inventory remains tenant-owned in batches.';

-- Repair completed scans that were classified while their tenant had no
-- tenant-specific product row. Each scan receives one intake batch.
update public.scans as scans
set product_id = products.id,
    updated_at = now()
from public.products as products
where scans.product_id is null
  and scans.status = 'completed'
  and scans.identity_label is not null
  and scans.identity_score >= 0.75
  and lower(trim(products.name)) = lower(trim(scans.identity_label));

create temporary table scan_batch_backfill on commit drop as
select scans.id as scan_id, gen_random_uuid() as batch_id
from public.scans as scans
where scans.status = 'completed'
  and scans.product_id is not null
  and scans.batch_id is null;

insert into public.batches (
  id,
  tenant_id,
  product_id,
  intake_date,
  quantity_received,
  quantity_remaining,
  initial_classification,
  fresh_to_medium_at,
  medium_to_spoiled_at
)
select
  backfill.batch_id,
  scans.tenant_id,
  scans.product_id,
  scans.created_at,
  scans.quantity,
  scans.quantity,
  scans.classification,
  case scans.classification
    when 'fresh' then scans.created_at
      + make_interval(days => rules.fresh_to_medium_days)
    when 'medium' then scans.created_at
    when 'spoiled' then scans.created_at
  end,
  case scans.classification
    when 'fresh' then scans.created_at
      + make_interval(
          days => rules.fresh_to_medium_days + rules.medium_to_spoiled_days
        )
    when 'medium' then scans.created_at
      + make_interval(days => rules.medium_to_spoiled_days)
    when 'spoiled' then scans.created_at
  end
from scan_batch_backfill as backfill
join public.scans as scans on scans.id = backfill.scan_id
join public.products as products on products.id = scans.product_id
left join public.product_category_shelf_life as rules
  on rules.category = lower(trim(products.name));

update public.scans as scans
set batch_id = backfill.batch_id,
    updated_at = now()
from scan_batch_backfill as backfill
where scans.id = backfill.scan_id;

commit;
