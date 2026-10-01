-- Development-only API login. Production must create a different LOGIN role
-- with a generated secret and grant it the NOLOGIN freshlens_api group.

do $local_runtime_role$
begin
  if not exists (select 1 from pg_roles where rolname = 'freshlens_api_local') then
    create role freshlens_api_local
      login
      password 'freshlens_api_local'
      nosuperuser
      nocreatedb
      nocreaterole
      inherit
      nobypassrls;
  else
    alter role freshlens_api_local
      login
      password 'freshlens_api_local'
      nosuperuser
      nocreatedb
      nocreaterole
      inherit
      nobypassrls;
  end if;
end
$local_runtime_role$;

grant freshlens_api to freshlens_api_local;

-- Local Postgres has a lightweight auth.users stand-in. The hosted Auth API
-- creates the real user; this management-only function mirrors its ID for the FK.
create or replace function public.create_local_auth_shadow(user_id uuid, user_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.current_app_role() is distinct from 'platform_admin'::public.app_role
    and public.current_app_role() is distinct from 'tenant_admin'::public.app_role then
    raise exception 'Only platform or tenant admins can provision local auth users';
  end if;
  insert into auth.users (id, email) values (user_id, user_email);
end;
$$;

revoke all on function public.create_local_auth_shadow(uuid, text) from public;
grant execute on function public.create_local_auth_shadow(uuid, text) to freshlens_api;
