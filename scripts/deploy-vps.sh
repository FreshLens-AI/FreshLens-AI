#!/usr/bin/env bash
# Deploy FreshLens API stack on the demo VPS (Docker Compose).
# Preserves host .env and named volumes. Never runs `down -v`.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_DIR="$ROOT/infra/docker"
ENV_FILE="$ROOT/.env"
BRANCH="${DEPLOY_BRANCH:-main}"
REMOTE="${DEPLOY_REMOTE:-origin}"

cd "$ROOT"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — copy secrets onto the host before deploying." >&2
  exit 1
fi

echo "==> Fetching $REMOTE/$BRANCH"
git fetch --prune "$REMOTE" "$BRANCH"
git checkout "$BRANCH"
git reset --hard "$REMOTE/$BRANCH"

compose=(docker compose --env-file "$ENV_FILE" -f docker-compose.yml)
if grep -qE '^CLASSIFIER=stub([[:space:]]|$)' "$ENV_FILE" \
  && [[ -f "$COMPOSE_DIR/compose.demo.override.yml" ]]; then
  compose+=(-f compose.demo.override.yml)
  echo "==> Using stub worker override (CLASSIFIER=stub)"
fi

if grep -qE '^API_DOMAIN=.+' "$ENV_FILE" \
  && [[ -f "$COMPOSE_DIR/compose.prod.yml" ]]; then
  compose+=(-f compose.prod.yml)
  echo "==> Using HTTPS edge (compose.prod.yml)"
fi

cd "$COMPOSE_DIR"
echo "==> Building and starting stack"
"${compose[@]}" up -d --build --remove-orphans

echo "==> Waiting for API health"
ok=0
for _ in $(seq 1 30); do
  if curl -fsS -m 3 http://127.0.0.1:8000/health >/dev/null 2>&1; then
    ok=1
    break
  fi
  sleep 2
done

"${compose[@]}" ps
if [[ "$ok" -ne 1 ]]; then
  echo "API health check failed" >&2
  "${compose[@]}" logs --tail=80 api worker scheduler || true
  exit 1
fi

curl -fsS http://127.0.0.1:8000/health
echo
echo "==> Deploy OK ($(git rev-parse --short HEAD))"
