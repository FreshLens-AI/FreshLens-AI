---
name: agent-sync
description: Coordinate with other AI agents (Cursor, Claude Code) working in the same FreshLens checkout. Use at the start of any session, before editing files, before committing or opening a PR, and when finishing work, so agents don't overwrite each other's in-flight changes.
---

# Skill: Agent Sync

Cursor and Claude Code share ONE working directory. Uncommitted edits made by one agent are immediately visible to (and clobberable by) the other. This skill is the protocol that prevents that.

## Live state lives in `.agents/HANDOFF.md`

Local-only (gitignored). Created by `scripts/agent-status.sh --init`. Sections: **Claims**, **Done**, **Blocked / Notes**. Do not commit it; do not paste secrets into it.

## Protocol

1. **Start of session** — run `scripts/agent-status.sh`. It prints branch, uncommitted files, ahead/behind, open PRs, recent commits and the handoff file. Read it before touching anything.
2. **Before editing** — check `git status` for files you did not change. Those are the other agent's (or the user's): do not edit, reformat, stage or revert them. If you need one, add a line under **Blocked / Notes** and ask the user.
3. **Claim your area** — add one line under **Claims**: `- [agent] paths/globs — intent (branch, date)`. Prefer claiming by directory (`apps/mobile/`), not the whole repo.
4. **Stay on your branch** — never commit to `main`. Branch names: `feat|fix|docs|chore/<area>-<desc>`. Stage files by explicit path, never `git add -A` / `git add .`, so the other agent's uncommitted work is not swept into your commit.
5. **Commits / PRs** — Conventional Commits with scope `api|web|mobile|ml|infra|db`; PRs < 400 lines with `Closes #N`. Attribution trailers follow the tool's own convention.
6. **End of session** — move your Claims to **Done** with a one-line result (commit/PR/branch), list anything left half-finished under **Blocked / Notes**, and tell the user the next command.

## Conflict rules

- Same file claimed by both agents → stop and ask the user which goes first.
- `infra/db/migrations/` is serialized: claim the next number in the handoff file *before* creating it, and require @buwaneka-halpage review (CODEOWNERS).
- Never resolve the other agent's uncommitted changes by `git checkout`, `git stash`, `git reset` or `git clean`.

## Authority documents (when docs and code disagree)

`AGENTS.md` (root + per-app), `docs/api/v1/openapi.yaml`, `docs/design/FreshLens-SAD.md`, `docs/authentication.md`. Per-tool rules under `.cursor/rules/` mirror `AGENTS.md`; if they differ, `AGENTS.md` wins and the rule should be fixed.
