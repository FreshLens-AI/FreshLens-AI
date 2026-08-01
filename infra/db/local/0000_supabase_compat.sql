-- Minimal Supabase-owned objects required to exercise FreshLens migrations on
-- vanilla PostgreSQL. Hosted Supabase already supplies these objects; never run
-- this compatibility file against a Supabase project.

do $local_supabase_roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    create role supabase_auth_admin nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
  end if;
end
$local_supabase_roles$;

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key,
  email text not null unique,
  created_at timestamptz not null default now()
);
