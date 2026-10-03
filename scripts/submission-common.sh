#!/usr/bin/env bash
# Shared setup and result logging for the submission entry points.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FAILED=0

die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
require() { command -v "$1" >/dev/null 2>&1 || die "Install $1 before running this script."; }

init_run() {
  require node
  require npm
  node -e 'const [major, minor] = process.versions.node.split(".").map(Number);
    if (major !== 22 || minor < 13) {
      console.error("Use Node.js 22.13+ (22.x), for example: nvm use 22"); process.exit(1);
    }'
  mkdir -p "$ROOT/runs/submission"
  RUN_DIR="$(mktemp -d "$ROOT/runs/submission/$1-$(date -u +%Y%m%dT%H%M%SZ)-XXXXXX")"
  printf 'FreshLens %s | %s\n' "$1" "$(date -u +%FT%TZ)" | tee "$RUN_DIR/summary.txt"
  printf 'Results: %s\n' "$RUN_DIR" | tee -a "$RUN_DIR/summary.txt"
  cd "$ROOT"
}

run_step() {
  local name="$1" directory="$2" code
  shift 2
  printf '\nRunning %s\n' "$name"
  if (cd "$directory" && "$@") 2>&1 | tee "$RUN_DIR/$name.log"; then
    printf 'PASS %s\n' "$name" | tee -a "$RUN_DIR/summary.txt"
  else
    code="${PIPESTATUS[0]}"
    [[ "$code" != 0 ]] || code=1
    FAILED=1
    printf 'FAIL %s (exit %s)\n' "$name" "$code" | tee -a "$RUN_DIR/summary.txt"
  fi
}

finish() {
  if [[ "$FAILED" == 0 ]]; then
    printf '\nOverall: PASS\n' | tee -a "$RUN_DIR/summary.txt"
  else
    printf '\nOverall: FAIL\n' | tee -a "$RUN_DIR/summary.txt"
  fi
  exit "$FAILED"
}

install_node() {
  run_step web-dependencies "$ROOT/apps/web" npm ci --no-audit --no-fund
  if [[ "${WEB_ONLY:-false}" != true ]]; then
    run_step mobile-dependencies "$ROOT/apps/mobile" npm ci --no-audit --no-fund
  fi
  [[ "$FAILED" == 0 ]] || finish
}
