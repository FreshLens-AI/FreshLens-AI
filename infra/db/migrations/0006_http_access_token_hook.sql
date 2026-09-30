begin;

-- Supabase Auth is the identity provider only; FreshLens roles and tenants live
-- in the application database. Supabase calls the API's HTTP access-token hook,
-- and the API resolves claims here instead of Supabase reading its own copy of
-- public.users.
--
-- The wrapper runs the existing invoker hook as supabase_auth_admin, so it gets
-- only that role's SELECT-only hook policies and column grants from 0001. It
-- adds no new table access, and only the restricted API group may execute it.
create or replace function public.resolve_access_token_claims(event jsonb)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.custom_access_token_hook(event)
$$;

alter function public.resolve_access_token_claims(jsonb)
owner to supabase_auth_admin;

revoke execute on function public.resolve_access_token_claims(jsonb)
from public, anon, authenticated;
grant execute on function public.resolve_access_token_claims(jsonb)
to freshlens_api;

comment on function public.resolve_access_token_claims(jsonb) is
  'Access-token claims for the API HTTP hook; runs the 0001 hook as supabase_auth_admin.';

commit;
