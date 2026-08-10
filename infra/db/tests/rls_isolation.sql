\set ON_ERROR_STOP on

insert into auth.users (id, email) values
  ('10000000-0000-4000-8000-000000000001', 'vendor-a@example.com'),
  ('10000000-0000-4000-8000-000000000002', 'vendor-b@example.com'),
  ('10000000-0000-4000-8000-000000000003', 'inactive@example.com'),
  ('10000000-0000-4000-8000-000000000004', 'admin@example.com');

insert into public.tenants (id, name, status) values
  ('20000000-0000-4000-8000-000000000001', 'Tenant A', 'active'),
  ('20000000-0000-4000-8000-000000000002', 'Tenant B', 'active'),
  ('20000000-0000-4000-8000-000000000003', 'Inactive tenant', 'inactive');

insert into public.users (id, tenant_id, role, display_name, email) values
  (
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'vendor',
    'Vendor A',
    'vendor-a@example.com'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    'vendor',
    'Vendor B',
    'vendor-b@example.com'
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000003',
    'vendor',
    'Inactive Vendor',
    'inactive@example.com'
  ),
  (
    '10000000-0000-4000-8000-000000000004',
    null,
    'platform_admin',
    'Platform Admin',
    'admin@example.com'
  );

insert into public.products (
  id, tenant_id, name, shelf_life_days, low_stock_threshold
) values
  (
    '30000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'Tomato A',
    5,
    3
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    'Tomato B',
    5,
    3
  ),
  (
    '30000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000003',
    'Tomato Inactive',
    5,
    3
  );

insert into public.batches (
  id,
  tenant_id,
  product_id,
  quantity_received,
  quantity_remaining
) values
  (
    '40000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    10,
    10
  ),
  (
    '40000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000002',
    8,
    8
  );

insert into public.scans (
  id, tenant_id, image_path, quantity, status, product_id, batch_id
) values
  (
    '50000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'tenant-a/scan-1.jpg',
    2,
    'pending',
    '30000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001'
  ),
  (
    '50000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    'tenant-b/scan-1.jpg',
    1,
    'pending',
    '30000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000002'
  );

insert into public.alerts (
  id, tenant_id, type, severity, message, product_id, batch_id
) values
  (
    '60000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'low_stock',
    'warning',
    'Tomato A is low',
    '30000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001'
  ),
  (
    '60000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    'aging',
    'info',
    'Tomato B is aging',
    '30000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000002'
  );

insert into public.sales (
  id, tenant_id, created_by, source, idempotency_key
) values
  (
    '70000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'manual',
    'sale-a-1'
  ),
  (
    '70000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    'manual',
    'sale-b-1'
  );

insert into public.sale_items (
  id, tenant_id, sale_id, product_id, batch_id, quantity_sold
) values
  (
    '71000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '70000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    1
  ),
  (
    '71000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    '70000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000002',
    1
  );

insert into public.device_tokens (
  id, tenant_id, user_id, token, platform, active
) values
  (
    '80000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'expo-token-a',
    'ios',
    true
  ),
  (
    '80000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    'expo-token-b',
    'android',
    true
  );

do $role_assertions$
begin
  if (select rolcanlogin from pg_roles where rolname = 'freshlens_api') then
    raise exception 'freshlens_api must remain NOLOGIN';
  end if;
  if (select rolsuper or rolbypassrls from pg_roles where rolname = 'freshlens_api_local') then
    raise exception 'local API login must not bypass RLS';
  end if;
  if not pg_has_role('freshlens_api_local', 'freshlens_api', 'member') then
    raise exception 'local API login must be a freshlens_api member';
  end if;
end
$role_assertions$;

-- No verified request context means deny by default.
begin;
set local role freshlens_api_local;
do $no_context$
begin
  if (select count(*) from public.tenants) <> 0 then
    raise exception 'RLS exposed tenants without request context';
  end if;
  if (select count(*) from public.users) <> 0 then
    raise exception 'RLS exposed users without request context';
  end if;
  if (select count(*) from public.products) <> 0
    or (select count(*) from public.batches) <> 0
    or (select count(*) from public.scans) <> 0
    or (select count(*) from public.sales) <> 0
    or (select count(*) from public.sale_items) <> 0
    or (select count(*) from public.alerts) <> 0
    or (select count(*) from public.device_tokens) <> 0 then
    raise exception 'RLS exposed business rows without request context';
  end if;
end
$no_context$;
rollback;

-- Tenant A sees only Tenant A and its own tenant members.
begin;
set local role freshlens_api_local;
select set_config('app.user_role', 'vendor', true);
select set_config('app.user_id', '10000000-0000-4000-8000-000000000001', true);
select set_config('app.tenant_id', '20000000-0000-4000-8000-000000000001', true);
do $tenant_a$
begin
  if (select array_agg(id order by id) from public.tenants)
    <> array['20000000-0000-4000-8000-000000000001'::uuid] then
    raise exception 'Tenant A can see another tenant';
  end if;
  if (select array_agg(id order by id) from public.users)
    <> array['10000000-0000-4000-8000-000000000001'::uuid] then
    raise exception 'Tenant A can see another tenant user';
  end if;
  if (select array_agg(id order by id) from public.products)
    <> array['30000000-0000-4000-8000-000000000001'::uuid] then
    raise exception 'Tenant A can see another tenant product';
  end if;
  if (select array_agg(id order by id) from public.batches)
    <> array['40000000-0000-4000-8000-000000000001'::uuid] then
    raise exception 'Tenant A can see another tenant batch';
  end if;
  if (select array_agg(id order by id) from public.scans)
    <> array['50000000-0000-4000-8000-000000000001'::uuid] then
    raise exception 'Tenant A can see another tenant scan';
  end if;
  if (select array_agg(id order by id) from public.sales)
    <> array['70000000-0000-4000-8000-000000000001'::uuid] then
    raise exception 'Tenant A can see another tenant sale';
  end if;
  if (select array_agg(id order by id) from public.sale_items)
    <> array['71000000-0000-4000-8000-000000000001'::uuid] then
    raise exception 'Tenant A can see another tenant sale item';
  end if;
  if (select array_agg(id order by id) from public.alerts)
    <> array['60000000-0000-4000-8000-000000000001'::uuid] then
    raise exception 'Tenant A can see another tenant alert';
  end if;
  if (select array_agg(id order by id) from public.device_tokens)
    <> array['80000000-0000-4000-8000-000000000001'::uuid] then
    raise exception 'Tenant A can see another tenant device token';
  end if;
end
$tenant_a$;

do $tenant_a_cannot_update$
declare
  affected_rows bigint;
begin
  update public.tenants
  set name = 'Vendor changed own tenant'
  where id = '20000000-0000-4000-8000-000000000001';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 0 then
    raise exception 'vendor updated its own tenant';
  end if;

  update public.tenants
  set name = 'Vendor changed another tenant'
  where id = '20000000-0000-4000-8000-000000000002';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 0 then
    raise exception 'vendor updated another tenant';
  end if;

  update public.users
  set display_name = 'Vendor changed self'
  where id = '10000000-0000-4000-8000-000000000001';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 0 then
    raise exception 'vendor updated its own identity row';
  end if;

  update public.users
  set display_name = 'Vendor changed another user'
  where id = '10000000-0000-4000-8000-000000000002';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 0 then
    raise exception 'vendor updated another tenant identity row';
  end if;

  update public.products
  set name = 'Hijacked Tomato B'
  where id = '30000000-0000-4000-8000-000000000002';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 0 then
    raise exception 'vendor updated another tenant product';
  end if;

  update public.scans
  set status = 'completed'
  where id = '50000000-0000-4000-8000-000000000002';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 0 then
    raise exception 'vendor updated another tenant scan';
  end if;
end
$tenant_a_cannot_update$;
rollback;

-- Tenant B receives the symmetric isolation guarantee.
begin;
set local role freshlens_api_local;
select set_config('app.user_role', 'vendor', true);
select set_config('app.user_id', '10000000-0000-4000-8000-000000000002', true);
select set_config('app.tenant_id', '20000000-0000-4000-8000-000000000002', true);
do $tenant_b$
begin
  if (select array_agg(id order by id) from public.tenants)
    <> array['20000000-0000-4000-8000-000000000002'::uuid] then
    raise exception 'Tenant B can see another tenant';
  end if;
  if (select array_agg(id order by id) from public.users)
    <> array['10000000-0000-4000-8000-000000000002'::uuid] then
    raise exception 'Tenant B can see another tenant user';
  end if;
  if (select array_agg(id order by id) from public.products)
    <> array['30000000-0000-4000-8000-000000000002'::uuid] then
    raise exception 'Tenant B can see another tenant product';
  end if;
  if (select array_agg(id order by id) from public.scans)
    <> array['50000000-0000-4000-8000-000000000002'::uuid] then
    raise exception 'Tenant B can see another tenant scan';
  end if;
  if (select count(*) from public.alerts) <> 1 then
    raise exception 'Tenant B alert isolation failed';
  end if;
end
$tenant_b$;
rollback;

-- Already-issued claims stop exposing identity data as soon as the tenant is
-- inactive; token/session revocation is not required for the RLS boundary.
begin;
set local role freshlens_api_local;
select set_config('app.user_role', 'vendor', true);
select set_config('app.user_id', '10000000-0000-4000-8000-000000000003', true);
select set_config('app.tenant_id', '20000000-0000-4000-8000-000000000003', true);
do $inactive_tenant$
begin
  if (select count(*) from public.tenants) <> 0 then
    raise exception 'inactive vendor context exposed a tenant';
  end if;
  if (select count(*) from public.users) <> 0 then
    raise exception 'inactive vendor context exposed users';
  end if;
  if (select count(*) from public.products) <> 0
    or (select count(*) from public.batches) <> 0
    or (select count(*) from public.scans) <> 0
    or (select count(*) from public.sales) <> 0
    or (select count(*) from public.sale_items) <> 0
    or (select count(*) from public.alerts) <> 0
    or (select count(*) from public.device_tokens) <> 0 then
    raise exception 'inactive vendor context exposed business rows';
  end if;
end
$inactive_tenant$;
rollback;

-- Platform admins can inspect all identity rows and perform the update allowed
-- by policy. The transaction is rolled back so later assertions stay stable.
begin;
set local role freshlens_api_local;
select set_config('app.user_role', 'platform_admin', true);
select set_config('app.user_id', '10000000-0000-4000-8000-000000000004', true);
do $platform_admin$
declare
  affected_rows bigint;
begin
  if (select count(*) from public.tenants) <> 3 then
    raise exception 'platform admin cannot see every tenant';
  end if;
  if (select count(*) from public.users) <> 4 then
    raise exception 'platform admin cannot see every identity row';
  end if;
  if (select count(*) from public.products) <> 3
    or (select count(*) from public.batches) <> 2
    or (select count(*) from public.scans) <> 2
    or (select count(*) from public.sales) <> 2
    or (select count(*) from public.sale_items) <> 2
    or (select count(*) from public.alerts) <> 2
    or (select count(*) from public.device_tokens) <> 2 then
    raise exception 'platform admin cannot see every business row';
  end if;

  update public.tenants
  set status = 'inactive'
  where id = '20000000-0000-4000-8000-000000000001';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception 'platform admin tenant update affected % rows', affected_rows;
  end if;
end
$platform_admin$;
rollback;

-- The invoker hook can read only through its dedicated RLS policies. It emits
-- claims for active vendors/admins and strips claims for inactive vendors.
begin;
set local role supabase_auth_admin;
do $hook_assertions$
declare
  active_claims jsonb;
  inactive_claims jsonb;
  admin_claims jsonb;
begin
  active_claims := public.custom_access_token_hook(
    jsonb_build_object(
      'user_id', '10000000-0000-4000-8000-000000000001',
      'claims', jsonb_build_object('sub', '10000000-0000-4000-8000-000000000001')
    )
  );
  if active_claims #>> '{claims,app_role}' <> 'vendor'
    or active_claims #>> '{claims,tenant_id}'
      <> '20000000-0000-4000-8000-000000000001' then
    raise exception 'active vendor claims were not issued';
  end if;

  inactive_claims := public.custom_access_token_hook(
    jsonb_build_object(
      'user_id', '10000000-0000-4000-8000-000000000003',
      'claims', jsonb_build_object(
        'sub', '10000000-0000-4000-8000-000000000003',
        'app_role', 'vendor',
        'tenant_id', '20000000-0000-4000-8000-000000000003'
      )
    )
  );
  if (inactive_claims -> 'claims') ? 'app_role'
    or (inactive_claims -> 'claims') ? 'tenant_id' then
    raise exception 'inactive vendor retained application claims';
  end if;

  admin_claims := public.custom_access_token_hook(
    jsonb_build_object(
      'user_id', '10000000-0000-4000-8000-000000000004',
      'claims', jsonb_build_object('sub', '10000000-0000-4000-8000-000000000004')
    )
  );
  if admin_claims #>> '{claims,app_role}' <> 'platform_admin'
    or (admin_claims -> 'claims') ? 'tenant_id' then
    raise exception 'platform admin claim shape is invalid';
  end if;
end
$hook_assertions$;
rollback;

select 'RLS isolation and auth-hook checks passed' as result;
