#!/usr/bin/env bash
# Reproduce automated regression tests and static checks without hosted services.
source "$(dirname "${BASH_SOURCE[0]}")/submission-common.sh"
INSTALL=true
INTEGRATION=false
for arg in "$@"; do
  case "$arg" in
    --no-install) INSTALL=false ;;
    --integration) INTEGRATION=true ;;
    -h|--help)
      printf 'Usage: bash scripts/test.sh [--no-install] [--integration]\n'
      printf 'Default: install dependencies; test API, ML, web, mobile and isolated PostgreSQL.\n'
      printf 'Use FRESHLENS_PYTHON to select an existing Python 3.12 virtual environment.\n'
      exit 0 ;;
    *) die "Unknown option: $arg (see --help)." ;;
  esac
done
require docker
docker info >/dev/null 2>&1 || die 'Start Docker and ensure your user can access it.'
PYTHON="${FRESHLENS_PYTHON:-$ROOT/.venv-submission/bin/python}"
if [[ "$INSTALL" == true && ! -x "$PYTHON" ]]; then
  [[ -z "${FRESHLENS_PYTHON:-}" ]] || die "Python executable not found: $PYTHON"
  require python3.12
  python3.12 -m venv "$ROOT/.venv-submission"
fi
[[ -x "$PYTHON" ]] || die 'Run without --no-install first, or set FRESHLENS_PYTHON to a venv Python path.'
PYTHON="$(cd "$(dirname "$PYTHON")" && pwd)/$(basename "$PYTHON")"
"$PYTHON" -c 'import sys; assert sys.version_info[:2] == (3, 12), "Python 3.12 is required"'
init_run tests
if [[ "$INSTALL" == true ]]; then
  run_step python-dependencies "$ROOT" "$PYTHON" -m pip install \
    -r apps/api/requirements.txt -r packages/ml/requirements.txt
  [[ "$FAILED" == 0 ]] || finish
  install_node
fi
# Override application configuration with synthetic local test settings.
export APP_ENV=test SUPABASE_URL=https://example.supabase.co
export SUPABASE_SERVICE_ROLE_KEY= SUPABASE_AUTH_HOOK_SECRET= GEMINI_API_KEY=
export DATABASE_URL=postgresql://freshlens_api_local:freshlens_api_local@localhost:5432/freshlens
export DATABASE_SSL_MODE=prefer LOCAL_AUTH_SHADOW=false
export REDIS_URL=redis://localhost:6379/0 CELERY_BROKER_URL=redis://localhost:6379/0
export CELERY_RESULT_BACKEND=redis://localhost:6379/1 SCAN_STORAGE_DIR="$RUN_DIR/scans"
export NEXT_TELEMETRY_DISABLED=1
run_step repository-structure "$ROOT" "$PYTHON" -c \
  'from pathlib import Path; assert all(Path(p).exists() for p in ("apps/api", "apps/web", "apps/mobile", "packages/ml", "infra/db/migrations", "infra/docker/docker-compose.yml", "CONTRIBUTING.md")), "Missing required repository paths"'
run_step api "$ROOT/apps/api" "$PYTHON" -m pytest -p no:cacheprovider --junitxml="$RUN_DIR/api.xml"
run_step ml "$ROOT/packages/ml" "$PYTHON" -m pytest -p no:cacheprovider --junitxml="$RUN_DIR/ml.xml"
run_step web "$ROOT/apps/web" npm test
run_step web-lint "$ROOT/apps/web" npm run lint
run_step web-types "$ROOT/apps/web" npm run typecheck
run_step mobile "$ROOT/apps/mobile" npm test
run_step mobile-types "$ROOT/apps/mobile" npm run typecheck
run_step database "$ROOT" bash scripts/test-evidence-db.sh
if [[ "$INTEGRATION" == true ]]; then
  run_step integration "$ROOT" "$PYTHON" scripts/run-system-evidence.py integration --output "$RUN_DIR/integration"
fi
finish
