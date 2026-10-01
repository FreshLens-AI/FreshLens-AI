-- PostgreSQL requires an enum value to be committed before it can be used.
alter type public.app_role add value if not exists 'tenant_admin' before 'platform_admin';

begin;

alter table public.users drop constraint users_role_tenant_check;
alter table public.users add constraint users_role_tenant_check check (
  (role in ('vendor', 'tenant_admin') and tenant_id is not null)
  or (role = 'platform_admin' and tenant_id is null)
);

-- Tenant admins are tenant members for operational RLS. The user-less vendor
-- context remains reserved for the tenant-scoped Celery worker.
create or replace function public.current_vendor_has_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.current_app_role() in ('vendor', 'tenant_admin')
    and exists (
      select 1
      from public.tenants as current_tenant
      where current_tenant.id = public.current_tenant_id()
        and current_tenant.status = 'active'
    )
    and (
      (
        public.current_app_role() = 'vendor'
        and public.current_app_user_id() is null
      )
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

create policy users_tenant_admin_insert
on public.users
for insert to freshlens_api
with check (
  public.current_app_role() = 'tenant_admin'
  and public.current_vendor_has_access()
  and tenant_id = public.current_tenant_id()
  and role = 'vendor'
);

create policy users_tenant_admin_update
on public.users
for update to freshlens_api
using (
  public.current_app_role() = 'tenant_admin'
  and public.current_vendor_has_access()
  and tenant_id = public.current_tenant_id()
  and role = 'vendor'
)
with check (
  public.current_app_role() = 'tenant_admin'
  and public.current_vendor_has_access()
  and tenant_id = public.current_tenant_id()
  and role = 'vendor'
);

create type public.tenant_application_status as enum (
  'pending',
  'approved',
  'rejected'
);

create table public.tenant_applications (
  id uuid primary key default gen_random_uuid(),
  organization_name text not null check (char_length(trim(organization_name)) between 2 and 120),
  applicant_name text not null check (char_length(trim(applicant_name)) between 2 and 120),
  applicant_email text not null check (char_length(trim(applicant_email)) between 3 and 320),
  phone text check (phone is null or char_length(trim(phone)) between 5 and 40),
  status public.tenant_application_status not null default 'pending',
  review_note text check (review_note is null or char_length(review_note) <= 1000),
  reviewed_by uuid references public.users(id) on delete restrict,
  approved_tenant_id uuid references public.tenants(id) on delete restrict,
  approved_user_id uuid references public.users(id) on delete restrict,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint tenant_application_review_state_check check (
    (status = 'pending' and reviewed_by is null and reviewed_at is null
      and approved_tenant_id is null and approved_user_id is null)
    or (status = 'rejected' and reviewed_by is not null and reviewed_at is not null
      and approved_tenant_id is null and approved_user_id is null)
    or (status = 'approved' and reviewed_by is not null and reviewed_at is not null
      and approved_tenant_id is not null and approved_user_id is not null)
  )
);

create unique index tenant_applications_pending_email_unique
on public.tenant_applications (lower(trim(applicant_email)))
where status = 'pending';
create index tenant_applications_status_submitted_idx
on public.tenant_applications (status, submitted_at desc);

alter table public.tenant_applications enable row level security;
alter table public.tenant_applications force row level security;

create policy tenant_applications_admin_select
on public.tenant_applications
for select to freshlens_api
using (public.current_app_role() = 'platform_admin');

create policy tenant_applications_admin_update
on public.tenant_applications
for update to freshlens_api
using (public.current_app_role() = 'platform_admin')
with check (public.current_app_role() = 'platform_admin');

-- Public callers can submit through this narrow definer function without any
-- direct table permission. Repeated pending submissions return the same ID.
create or replace function public.submit_tenant_application(
  organization_name text,
  applicant_name text,
  applicant_email text,
  phone text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  application_id uuid;
  normalized_email text := lower(trim(applicant_email));
begin
  if char_length(trim(organization_name)) not between 2 and 120
    or char_length(trim(applicant_name)) not between 2 and 120
    or char_length(normalized_email) not between 3 and 320
    or position('@' in normalized_email) <= 1 then
    raise exception 'Invalid tenant application';
  end if;

  select id into application_id
  from public.tenant_applications
  where lower(trim(tenant_applications.applicant_email)) = normalized_email
    and status = 'pending';

  if application_id is not null then
    return application_id;
  end if;

  begin
    insert into public.tenant_applications (
      organization_name, applicant_name, applicant_email, phone
    ) values (
      trim(organization_name), trim(applicant_name), normalized_email,
      nullif(trim(phone), '')
    ) returning id into application_id;
  exception when unique_violation then
    select id into application_id
    from public.tenant_applications
    where lower(trim(tenant_applications.applicant_email)) = normalized_email
      and status = 'pending';
  end;

  return application_id;
end;
$$;

revoke all on public.tenant_applications from public, anon, authenticated;
grant select, update on public.tenant_applications to freshlens_api;
grant usage on type public.tenant_application_status to freshlens_api;
revoke all on function public.submit_tenant_application(text, text, text, text)
from public, anon, authenticated;
grant execute on function public.submit_tenant_application(text, text, text, text)
to freshlens_api;

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
      or (users.role in ('vendor', 'tenant_admin') and tenants.status = 'active')
    );

  claims := event -> 'claims';

  if found then
    claims := jsonb_set(claims, '{app_role}', to_jsonb(profile_role::text), true);
    if profile_tenant_id is null then
      claims := claims - 'tenant_id';
    else
      claims := jsonb_set(
        claims, '{tenant_id}', to_jsonb(profile_tenant_id::text), true
      );
    end if;
  else
    claims := claims - 'app_role' - 'tenant_id';
  end if;

  return jsonb_set(event, '{claims}', claims, true);
end;
$$;

comment on table public.tenant_applications is
  'Public tenant signup requests reviewed by platform administrators.';
comment on function public.submit_tenant_application(text, text, text, text) is
  'Idempotently submits a pending tenant application without exposing its table.';
comment on function public.current_vendor_has_access() is
  'True for active vendor or tenant-admin members, plus tenant-scoped workers.';

commit;
