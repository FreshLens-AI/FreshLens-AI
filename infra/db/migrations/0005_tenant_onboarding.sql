begin;

create policy tenants_admin_insert
on public.tenants
for insert to freshlens_api
with check (public.current_app_role() = 'platform_admin');

create policy users_admin_insert
on public.users
for insert to freshlens_api
with check (public.current_app_role() = 'platform_admin');

grant insert on public.tenants to freshlens_api;
grant insert on public.users to freshlens_api;

commit;
