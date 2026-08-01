\set ON_ERROR_STOP on

do $runtime_role$
begin
  if current_user <> 'freshlens_api_local' then
    raise exception 'expected freshlens_api_local, connected as %', current_user;
  end if;

  if exists (
    select 1
    from pg_roles
    where rolname = current_user
      and (rolsuper or rolbypassrls)
  ) then
    raise exception 'runtime login has superuser or BYPASSRLS privileges';
  end if;

  if not pg_has_role(current_user, 'freshlens_api', 'member') then
    raise exception 'runtime login is not a freshlens_api member';
  end if;
end
$runtime_role$;

select 'restricted runtime login checks passed' as result;
