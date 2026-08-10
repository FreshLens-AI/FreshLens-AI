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
