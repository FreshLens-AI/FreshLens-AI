#!/usr/bin/env bash
# Build application artifacts; optional APK compilation uses local EAS Build.
source "$(dirname "${BASH_SOURCE[0]}")/submission-common.sh"
INSTALL=true
WEB_ONLY=false
APK=false
for arg in "$@"; do
  case "$arg" in
    --no-install) INSTALL=false ;;
    --web-only) WEB_ONLY=true ;;
    --apk) APK=true ;;
    -h|--help)
      printf 'Usage: bash scripts/build.sh [--no-install] [--web-only | --apk]\n'
      printf 'Default: install dependencies; build web, Docker images and Android JS/assets.\n'
      printf '%s\n' '--apk additionally builds a signed preview APK using local EAS Build.'
      exit 0 ;;
    *) die "Unknown option: $arg (see --help)." ;;
  esac
done
if [[ "$WEB_ONLY" != true ]]; then
  require docker
  docker info >/dev/null 2>&1 || die 'Start Docker and ensure your user can access it.'
  docker compose version >/dev/null 2>&1 || die 'Install the Docker Compose v2 plugin.'
  [[ -f "$ROOT/.env" ]] || die 'Copy .env.example to .env and configure it first.'
  for weights in identity-v1 freshness-v1; do
    [[ -s "$ROOT/packages/ml/models/$weights.pt" ]] || die "Missing model: packages/ml/models/$weights.pt"
  done
fi
if [[ "$APK" == true ]]; then
  [[ "$WEB_ONLY" != true ]] || die '--apk cannot be combined with --web-only.'
  require eas
  require java
  [[ -d "${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}" ]] || die 'Set ANDROID_HOME to your Android SDK directory.'
  [[ -f "${GOOGLE_SERVICES_JSON:-$ROOT/apps/mobile/google-services.json}" ]] || die 'Supply the Firebase client config as GOOGLE_SERVICES_JSON (absolute path).'
fi
init_run build
export NEXT_TELEMETRY_DISABLED=1 EXPO_NO_TELEMETRY=1 CI=1
[[ "$INSTALL" != true ]] || install_node
run_step web-build "$ROOT/apps/web" npm run build
if [[ "$WEB_ONLY" != true ]]; then
  run_step docker-build "$ROOT" docker compose --env-file "$ROOT/.env" \
    --project-name freshlens-submission -f infra/docker/docker-compose.yml build api worker scheduler
  if [[ "$FAILED" == 0 ]]; then
    run_step docker-images "$ROOT" docker image inspect freshlens-submission-api \
      freshlens-submission-worker freshlens-submission-scheduler --format '{{.RepoTags}} {{.Id}}'
  fi
  run_step mobile-env "$ROOT/apps/mobile" npm run env:check
  [[ "$FAILED" == 0 ]] || finish
  run_step mobile-export "$ROOT/apps/mobile" npx --no-install expo export \
    --platform android --output-dir "$RUN_DIR/mobile"
  if [[ "$APK" == true && "$FAILED" == 0 ]]; then
    run_step android-apk "$ROOT/apps/mobile" eas build --platform android --profile preview \
      --local --non-interactive --output "$RUN_DIR/freshlens-preview.apk"
  fi
fi
printf '\nWeb output: %s/apps/web/.next\n' "$ROOT" | tee -a "$RUN_DIR/summary.txt"
finish
