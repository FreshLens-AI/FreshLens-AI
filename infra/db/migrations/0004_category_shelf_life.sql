begin;

-- Shared catalogue reference data: these four rules contain no tenant data.
-- Tenant inventory remains in public.products under its existing RLS policy.
create table public.product_category_shelf_life (
  category text primary key check (category in ('banana', 'cucumber', 'eggplant', 'tomato')),
  fresh_to_medium_days integer check (fresh_to_medium_days > 0),
  medium_to_spoiled_days integer check (medium_to_spoiled_days > 0),
  updated_at timestamptz not null default now(),
  check ((fresh_to_medium_days is null) = (medium_to_spoiled_days is null))
);

insert into public.product_category_shelf_life (category)
values ('banana'), ('cucumber'), ('eggplant'), ('tomato');

create policy category_shelf_life_read
on public.product_category_shelf_life
for select to authenticated, freshlens_api
using (public.current_app_role() in ('vendor', 'platform_admin'));

create policy category_shelf_life_admin_update
on public.product_category_shelf_life
for update to authenticated, freshlens_api
using (public.current_app_role() = 'platform_admin')
with check (public.current_app_role() = 'platform_admin');

alter table public.product_category_shelf_life enable row level security;
alter table public.product_category_shelf_life force row level security;
revoke all on public.product_category_shelf_life from anon;
grant select, update on public.product_category_shelf_life to authenticated, freshlens_api;

-- The existing total shelf life drives aging alerts. Keep it synchronized for
-- every retailer, including products added after an administrator saves a rule.
create function public.apply_category_shelf_life_to_product()
returns trigger
language plpgsql
as $$
declare
  configured_days integer;
begin
  select fresh_to_medium_days + medium_to_spoiled_days
    into configured_days
  from public.product_category_shelf_life
  where category = lower(trim(new.name));

  if configured_days is not null then
    new.shelf_life_days := configured_days;
  end if;
  return new;
end;
$$;

create trigger products_apply_category_shelf_life
before insert or update of name, shelf_life_days on public.products
for each row execute function public.apply_category_shelf_life_to_product();

create function public.sync_category_shelf_life_products()
returns trigger
language plpgsql
as $$
begin
  if new.fresh_to_medium_days is not null then
    update public.products
    set shelf_life_days = new.fresh_to_medium_days + new.medium_to_spoiled_days,
        updated_at = now()
    where lower(trim(name)) = new.category;
  end if;
  return new;
end;
$$;

create trigger category_shelf_life_sync_products
after update of fresh_to_medium_days, medium_to_spoiled_days
on public.product_category_shelf_life
for each row execute function public.sync_category_shelf_life_products();

revoke all on function public.apply_category_shelf_life_to_product() from public;
revoke all on function public.sync_category_shelf_life_products() from public;

commit;
