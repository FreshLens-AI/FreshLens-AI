#!/usr/bin/env bash
# Map a hosted Supabase Auth user onto the local Compose Postgres tenant.
# Usage: scripts/provision-local-vendor.sh <auth-user-uuid> <email>
set -euo pipefail

uuid="${1:-}"
email="${2:-}"
tenant_id="11111111-1111-4111-8111-111111111111"

if [[ -z "$uuid" || -z "$email" ]]; then
  echo "Usage: $0 <supabase-auth-user-uuid> <email>" >&2
  exit 1
fi

root="$(cd "$(dirname "$0")/.." && pwd)"
compose=(docker compose -f "$root/infra/docker/docker-compose.yml")

"${compose[@]}" exec -T postgres \
  env PGPASSWORD=freshlens \
  psql -U freshlens -d freshlens \
    -v ON_ERROR_STOP=1 \
    -v uuid="$uuid" \
    -v email="$email" \
    -v tenant_id="$tenant_id" <<'SQL'
insert into auth.users (id, email)
values (:'uuid', :'email')
on conflict (id) do update set email = excluded.email;

insert into public.users (id, tenant_id, role, display_name, email)
values (
  :'uuid',
  :'tenant_id',
  'vendor',
  'Example Vendor',
  :'email'
)
on conflict (id) do update
set tenant_id = excluded.tenant_id,
    role = excluded.role,
    email = excluded.email;
SQL

echo "Provisioned vendor $email ($uuid) on tenant $tenant_id"
