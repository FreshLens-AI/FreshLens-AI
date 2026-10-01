begin;

alter table public.users
  add column status text not null default 'active'
  check (status in ('active', 'inactive'));

create index users_tenant_status_idx on public.users (tenant_id, status);

-- The auth-hook role already has narrowly scoped, RLS-protected access to the
-- identity tables. Owning this helper with that role lets RLS check the current
-- user's access state without recursively evaluating the users policy.
grant select (status) on public.users to supabase_auth_admin;

create or replace function public.current_vendor_has_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.current_app_role() = 'vendor'
    and exists (
      select 1
      from public.users as current_user_profile
      join public.tenants as current_tenant
        on current_tenant.id = current_user_profile.tenant_id
      where current_user_profile.id = public.current_app_user_id()
        and current_user_profile.tenant_id = public.current_tenant_id()
        and current_user_profile.status = 'active'
        and current_tenant.status = 'active'
    )
$$;

alter function public.current_vendor_has_access() owner to supabase_auth_admin;
revoke execute on function public.current_vendor_has_access() from public, anon;
grant execute on function public.current_vendor_has_access()
to authenticated, freshlens_api;

create or replace function public.vendor_owns_active_tenant(row_tenant_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select
    row_tenant_id is not null
    and row_tenant_id = public.current_tenant_id()
    and public.current_vendor_has_access()
$$;

drop policy tenants_select_authorized on public.tenants;
create policy tenants_select_authorized
on public.tenants
for select
to authenticated, freshlens_api
using (
  public.current_app_role() = 'platform_admin'
  or (
    id = public.current_tenant_id()
    and public.current_vendor_has_access()
  )
);

drop policy users_select_authorized on public.users;
create policy users_select_authorized
on public.users
for select
to authenticated, freshlens_api
using (
  public.current_app_role() = 'platform_admin'
  or (
    public.current_vendor_has_access()
    and (
      id = public.current_app_user_id()
      or tenant_id = public.current_tenant_id()
    )
  )
);

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
    and users.status = 'active'
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

comment on column public.users.status is
  'Platform-admin controlled access state. Inactive users receive no FreshLens claims.';
comment on function public.current_vendor_has_access() is
  'True only when the current vendor and their tenant are both active.';

commit;
