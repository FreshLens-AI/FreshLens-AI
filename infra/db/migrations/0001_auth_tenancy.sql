begin;

-- Application connections inherit this group. It cannot log in or bypass RLS.
-- Production creates a separate LOGIN role with a secret password and grants
-- this role to it; local Compose does the same in local/0020_runtime_login.sql.
do $freshlens_roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'freshlens_api') then
    create role freshlens_api
      nologin
      nosuperuser
      nocreatedb
      nocreaterole
      noinherit
      nobypassrls;
  else
    alter role freshlens_api
      nologin
      nosuperuser
      nocreatedb
      nocreaterole
      noinherit
      nobypassrls;
  end if;
end
$freshlens_roles$;

create type public.app_role as enum ('vendor', 'platform_admin');

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  status text not null default 'active'
    check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete restrict,
  role public.app_role not null,
  display_name text not null check (char_length(trim(display_name)) > 0),
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_role_tenant_check check (
    (role = 'vendor' and tenant_id is not null)
    or (role = 'platform_admin' and tenant_id is null)
  )
);

create index users_tenant_id_idx on public.users (tenant_id);
create index users_role_idx on public.users (role);

alter table public.tenants enable row level security;
alter table public.tenants force row level security;
alter table public.users enable row level security;
alter table public.users force row level security;

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
set search_path = ''
as $$
  select coalesce(
    nullif(current_setting('app.user_role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'app_role'
  )::public.app_role
$$;

create or replace function public.current_tenant_id()
returns uuid
language sql
stable
set search_path = ''
as $$
  select coalesce(
    nullif(current_setting('app.tenant_id', true), '')::uuid,
    (
      nullif(current_setting('request.jwt.claims', true), '')::jsonb
      ->> 'tenant_id'
    )::uuid
  )
$$;

create or replace function public.current_app_user_id()
returns uuid
language sql
stable
set search_path = ''
as $$
  select coalesce(
    nullif(current_setting('app.user_id', true), '')::uuid,
    (
      nullif(current_setting('request.jwt.claims', true), '')::jsonb
      ->> 'sub'
    )::uuid
  )
$$;

create policy tenants_select_authorized
on public.tenants
for select
to authenticated, freshlens_api
using (
  public.current_app_role() = 'platform_admin'
  or (
    public.current_app_role() = 'vendor'
    and id = public.current_tenant_id()
    and status = 'active'
  )
);

create policy tenants_admin_update
on public.tenants
for update
to authenticated, freshlens_api
using (public.current_app_role() = 'platform_admin')
with check (public.current_app_role() = 'platform_admin');

-- The auth hook is an invoker and receives SELECT-only access through RLS.
-- It must inspect any tenant because it issues tokens for every account.
create policy tenants_auth_hook_select
on public.tenants
for select
to supabase_auth_admin
using (true);

create policy users_select_authorized
on public.users
for select
to authenticated, freshlens_api
using (
  public.current_app_role() = 'platform_admin'
  or (
    public.current_app_role() = 'vendor'
    and (
      id = public.current_app_user_id()
      or tenant_id = public.current_tenant_id()
    )
    and exists (
      select 1
      from public.tenants as active_tenant
      where active_tenant.id = public.current_tenant_id()
        and active_tenant.status = 'active'
    )
  )
);

create policy users_admin_update
on public.users
for update
to authenticated, freshlens_api
using (public.current_app_role() = 'platform_admin')
with check (public.current_app_role() = 'platform_admin');

create policy users_auth_hook_select
on public.users
for select
to supabase_auth_admin
using (true);

revoke all on public.tenants from anon;
revoke all on public.users from anon;
grant select, update on public.tenants to authenticated;
grant select, update on public.users to authenticated;
grant usage on schema public to freshlens_api;
grant usage on type public.app_role to freshlens_api;
grant select, update on public.tenants to freshlens_api;
grant select, update on public.users to freshlens_api;

-- The hook can read only the columns required to construct trusted claims.
grant usage on schema public to supabase_auth_admin;
grant usage on type public.app_role to supabase_auth_admin;
grant select (id, status) on public.tenants to supabase_auth_admin;
grant select (id, tenant_id, role) on public.users to supabase_auth_admin;

-- Enable this function as the project's Custom Access Token Hook in
-- Authentication > Hooks after applying the migration.
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  claims jsonb;
  profile_role public.app_role;
  profile_tenant_id uuid;
begin
  select users.role, users.tenant_id
    into profile_role, profile_tenant_id
  from public.users as users
  left join public.tenants as tenants on tenants.id = users.tenant_id
  where users.id = (event ->> 'user_id')::uuid
    and (
      users.role = 'platform_admin'
      or (users.role = 'vendor' and tenants.status = 'active')
    );

  claims := event -> 'claims';

  if found then
    claims := jsonb_set(
      claims,
      '{app_role}',
      to_jsonb(profile_role::text),
      true
    );

    if profile_tenant_id is null then
      claims := claims - 'tenant_id';
    else
      claims := jsonb_set(
        claims,
        '{tenant_id}',
        to_jsonb(profile_tenant_id::text),
        true
      );
    end if;
  else
    claims := claims - 'app_role' - 'tenant_id';
  end if;

  return jsonb_set(event, '{claims}', claims, true);
end;
$$;

revoke execute on function public.custom_access_token_hook(jsonb)
from public, anon, authenticated, freshlens_api;
grant execute on function public.custom_access_token_hook(jsonb)
to supabase_auth_admin;

comment on function public.custom_access_token_hook(jsonb) is
  'Adds FreshLens claims for provisioned admins and vendors in active tenants.';

commit;
