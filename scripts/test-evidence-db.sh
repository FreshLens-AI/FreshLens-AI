#!/usr/bin/env bash
# Run the repository's SQL tests against a new, disposable PostgreSQL instance.
set -euo pipefail
cd "$(dirname "$0")/.."
image="${TEST_POSTGRES_IMAGE:-postgres:16.14-alpine}"
container="freshlens-test-evidence-$$"
trap 'docker rm -f "$container" >/dev/null 2>&1 || true' EXIT

docker run --detach --rm --name "$container" --network none \
  --tmpfs /var/lib/postgresql/data \
  -e POSTGRES_USER=freshlens -e POSTGRES_PASSWORD=freshlens \
  -e POSTGRES_DB=freshlens "$image" >/dev/null

ready=false
for attempt in {1..60}; do
  if docker exec "$container" pg_isready -h 127.0.0.1 -U freshlens -d freshlens >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 1
done
if [[ "$ready" != true ]]; then
  docker logs "$container"
  exit 1
fi

echo "Isolated database: $image (temporary storage, no host ports)"
docker exec "$container" psql -X -U freshlens -d freshlens -c 'select version();'
for sql_file in \
  infra/db/local/0000_supabase_compat.sql \
  infra/db/migrations/0001_auth_tenancy.sql \
  infra/db/migrations/0002_business_tables.sql \
  infra/db/migrations/0003_scan_identity.sql \
  infra/db/local/0020_runtime_login.sql \
  infra/db/tests/rls_isolation.sql; do
  echo "Running: $sql_file"
  docker exec -i "$container" psql -X -U freshlens -d freshlens \
    -v ON_ERROR_STOP=1 < "$sql_file"
done

echo 'Running: infra/db/tests/runtime_role.sql (actual restricted login over TCP)'
docker exec -i -e PGPASSWORD=freshlens_api_local "$container" \
  psql -X -h 127.0.0.1 -U freshlens_api_local -d freshlens \
  -v ON_ERROR_STOP=1 < infra/db/tests/runtime_role.sql
echo 'PASS: both SQL suites completed with ON_ERROR_STOP=1.'
