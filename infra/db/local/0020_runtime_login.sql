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
