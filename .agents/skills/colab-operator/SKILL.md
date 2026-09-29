---
name: colab-operator
description: Operate Google Colab environments via the `colab` CLI. Use when asked to create or manage GPU/TPU sessions, run Python/shell on a remote Colab VM, sync files, automate environment setup (packages, auth, Drive), or export session history.
---

# Skill: Colab Session Operator

Operate Google Colab environments via the `colab` CLI: provision GPU/TPU sessions, run Python/shell on the VM, sync files, and capture work as notebooks.

## Installation

The tool is installed via:
```bash
uv tool install google-colab-cli
```

## When to activate
- Creating or managing TPU/GPU sessions.
- Running Python or shell on a remote Colab VM.
- Syncing files between local and remote.
- Automating environment setup (packages, auth, Drive).
- Exporting session history as a Jupyter notebook.

## Mental model (read this first)
- **A session == a live Jupyter kernel on a rented VM.** `colab new` allocates a billable VM; `colab stop` releases it. Nothing reclaims it automatically except a 24h keep-alive cap, so an unstopped session burns compute units indefinitely.
- **Kernel state PERSISTS across `colab exec` / `colab repl` calls in the same session.** Each invocation reattaches to the *same* kernel (the kernel ID is cached in local state) and only closes the websocket on exit — it does **not** shut the kernel down. So imports, variables, and defined functions survive between separate `colab exec` commands. Build up state incrementally; don't re-import everything each call. (`colab stop` and `colab restart-kernel` are what actually reset it.)
- **Default working directory is `/content`.** Every `exec`/`repl`/`run` `cd`s there first; prefer absolute paths (`/content/...`) for file work. For `colab ls/rm/upload/download`, absolute `/content/...` paths work and the default `ls` path is `content` (VM root).
- **`colab` is fire-and-forget.** Each command authenticates, does one thing, and exits. A detached background daemon (spawned by `colab new`) handles keep-alive; you don't manage it.

## Authentication
- Global flag: `--auth={adc,oauth2}` (default: `adc`).
- For agent use, either:
  1. ADC: `gcloud auth application-default login --scopes=openid,https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/userinfo.email,https://www.googleapis.com/auth/colaboratory`
  2. OAuth2: `colab --auth=oauth2 <command>` (opens browser consent on first use, token cached at `~/.config/colab-cli/token.json`).

## Workflow

### Provision
- `colab new -s <name>` (CPU). Add `--gpu T4` or `--gpu A100` or `--gpu L4`.
- Always pass `-s <name>`.

### Execute
- `colab exec -s <name> -f <script.py>` runs a local script on remote VM.
- `colab exec -s <name> -f <nb.ipynb>` runs each code cell and writes results to `<basename>_output.ipynb`.
- `colab run --gpu T4 script.py [args...]` one-shot ephemeral execution.
- `colab install -s <name> pkg1 pkg2` installs dependencies.
- `colab status -s <name>` shows session hardware and status.
- `colab stop -s <name>` releases VM.
