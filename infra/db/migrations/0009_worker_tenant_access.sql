begin;

-- Celery workers set app.tenant_id + app.user_role=vendor but have no JWT user.
-- After 0007, current_vendor_has_access() required app.user_id, so scan UPDATEs
-- matched zero rows while classify_scan still reported success. Allow the
-- tenant-scoped worker path when the tenant is active and no user id is set.
-- API request transactions still set app.user_id from the verified JWT.

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
      from public.tenants as current_tenant
      where current_tenant.id = public.current_tenant_id()
        and current_tenant.status = 'active'
    )
    and (
      public.current_app_user_id() is null
      or exists (
        select 1
        from public.users as current_user_profile
        where current_user_profile.id = public.current_app_user_id()
          and current_user_profile.tenant_id = public.current_tenant_id()
          and current_user_profile.status = 'active'
      )
    )
$$;

alter function public.current_vendor_has_access() owner to supabase_auth_admin;
revoke execute on function public.current_vendor_has_access() from public, anon;
grant execute on function public.current_vendor_has_access()
to authenticated, freshlens_api;

comment on function public.current_vendor_has_access() is
  'True when the tenant is active and either the worker has no user id or the vendor user is active.';

commit;
