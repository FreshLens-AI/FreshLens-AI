#!/usr/bin/env python3
"""Run tests live in GNOME Terminal tabs and keep each result open for screenshots."""
from datetime import datetime
import argparse
import os
from pathlib import Path
import shlex
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--system", action="store_true", help="Run live integration and k6 smoke/load/spike tests sequentially")
    args = parser.parse_args()
    now = datetime.now().astimezone()
    out = ROOT / "runs/test-evidence" / now.strftime("terminal-%Y%m%d-%H%M%S")
    out.mkdir(parents=True)
    branch = subprocess.check_output(["git", "branch", "--show-current"], cwd=ROOT, text=True).strip()
    commit = subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], cwd=ROOT, text=True).strip()
    jobs = [
        ("API-01", "Scan upload", "apps/api", "pytest -v tests/test_scans.py"),
        ("API-02", "Sales and idempotency", "apps/api", "pytest -v tests/test_sales.py"),
        ("SEC-01", "PostgreSQL isolation and runtime role", ".", "bash scripts/test-evidence-db.sh"),
        ("ML-01", "Identity confidence thresholds", "packages/ml", "pytest -v tests/test_identity.py"),
        ("UI-01", "Web mapping and auth logic", "apps/web", "npm test"),
        ("Mobile", "Mobile auth and session storage", "apps/mobile", "npm test"),
        ("API-all", "Complete API suite", "apps/api", "pytest"),
        ("ML-all", "Complete ML suite", "packages/ml", "pytest"),
        ("Checks", "Lint and TypeScript checks", ".",
         "npm --prefix apps/web run lint && npm --prefix apps/web run typecheck && npm --prefix apps/mobile run typecheck"),
    ]
    if args.system:
        jobs = [(title, description, ".", shlex.join([
            str(ROOT / ".venv-test-report/bin/python"), "scripts/run-system-evidence.py",
            profile, "--output", str(out / profile),
        ])) for title, description, profile in [
            ("Integration", "Live API + PostgreSQL + Redis/Celery integration", "integration"),
            ("K6-Smoke", "Performance smoke: 1 virtual user / 10 seconds", "smoke"),
            ("K6-Load", "Load: gradual ramp to 10 virtual users / 60 seconds", "load"),
            ("K6-Spike", "Spike: sudden increase to 25 virtual users / 44 seconds", "spike"),
        ]]
    env = dict(
        PATH=str(ROOT / ".venv-test-report/bin") + os.pathsep + os.environ["PATH"],
        APP_ENV="test", SUPABASE_URL="https://example.supabase.co",
        DATABASE_URL="postgresql://freshlens_api_local:freshlens_api_local@localhost:5432/freshlens",
        DATABASE_SSL_MODE="prefer",
        CORS_ORIGINS="http://localhost:3000,http://localhost:3001,http://localhost:3002",
        CELERY_BROKER_URL="redis://localhost:6379/0", CELERY_RESULT_BACKEND="redis://localhost:6379/1",
        REDIS_URL="redis://localhost:6379/0", SCAN_STORAGE_DIR=str(out / "scan-storage"),
        PYTEST_ADDOPTS="-p no:cacheprovider",  # Existing cache is owned by another user.
    )
    terminal = ["gnome-terminal", "--window", "--maximize", "--zoom=0.95"]
    for index, (slug, title, cwd, command) in enumerate(jobs):
        script = out / f"{slug}.sh"
        exports = "\n".join(f"export {key}={shlex.quote(value)}" for key, value in env.items())
        heading = f"FreshLens | {slug}: {title}\nBranch: {branch} | Commit: {commit} | {now:%Y-%m-%d %H:%M:%S %z}\n"
        wait = ""
        if args.system and index:
            previous = shlex.quote(str(out / (jobs[index - 1][0] + ".exit")))
            wait = ("printf 'Waiting for the previous test to finish so performance runs do not overlap.\\n'\n"
                    f"while [[ ! -f {previous} ]]; do sleep 1; done\n"
                    "clear\n")
        script.write_text(
            "#!/usr/bin/env bash\nset -u\nunset NO_COLOR FORCE_COLOR\n" + exports + "\n"
            f"cd {shlex.quote(str(ROOT / cwd))}\nclear\n"
            + wait +
            f"printf '%s\\n' {shlex.quote(heading)}\n"
            f"printf '%s\\n\\n' {shlex.quote('$ ' + command)}\n"
            f"script --quiet --return --flush --command {shlex.quote(command)} {shlex.quote(str(out / (slug + '.log')))}\n"
            "result=$?\n"
            f"printf '%s\\n' \"$result\" > {shlex.quote(str(out / (slug + '.exit')))}\n"
            "printf '\\nCommand exit code: %s\\n' \"$result\"\n"
            "printf 'Finished. Capture this terminal; press Enter when you want to close this tab.\\n'\n"
            "read -r _\n"
        )
        if index:
            terminal.append("--tab")
        terminal.extend(["--title", slug, "--working-directory", str(ROOT / cwd),
                         "--command", shlex.join(["bash", str(script)])])
        if index == 0:
            terminal.append("--active")
    subprocess.run(terminal, check=True)
    print(f"Opened {len(jobs)} terminal tabs. Raw transcripts and exit codes: {out}")


if __name__ == "__main__":
    main()
