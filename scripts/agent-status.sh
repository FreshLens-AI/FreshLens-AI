#!/usr/bin/env bash
# Snapshot of repo state for AI agents (Cursor / Claude Code) sharing this checkout.
#   scripts/agent-status.sh          print status
#   scripts/agent-status.sh --init   also create .agents/HANDOFF.md if missing
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"

HANDOFF=".agents/HANDOFF.md"

if [[ "${1:-}" == "--init" && ! -f "$HANDOFF" ]]; then
  mkdir -p .agents
  cat > "$HANDOFF" <<'EOF'
# Agent handoff (local, gitignored) — see .agents/skills/agent-sync/SKILL.md

## Claims
<!-- - [cursor|claude] paths — intent (branch, YYYY-MM-DD) -->

## Done
<!-- - [agent] result (commit/PR/branch) -->

## Blocked / Notes
<!-- questions for the other agent or the user -->
EOF
  echo "created $HANDOFF"
fi

echo "== branch =="
git status -sb | head -1
git rev-list --left-right --count '@{upstream}...HEAD' 2>/dev/null \
  | awk '{print "behind " $1 ", ahead " $2}'

echo; echo "== uncommitted (do not touch files you did not change) =="
git status --short | head -40

echo; echo "== recent commits =="
git log --oneline -5

if command -v gh >/dev/null 2>&1; then
  echo; echo "== open PRs =="
  gh pr list --limit 10 2>/dev/null || echo "(gh unavailable or not authenticated)"
fi

echo; echo "== handoff =="
if [[ -f "$HANDOFF" ]]; then cat "$HANDOFF"; else echo "(none — run with --init)"; fi
