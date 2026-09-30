#!/usr/bin/env python3
"""Run existing tests and retain actual output in screenshot-friendly local pages."""
import argparse
from datetime import datetime
import hashlib
import html
import json
import os
from pathlib import Path
import re
import shlex
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
CSS = """
*{box-sizing:border-box}body{margin:0;background:#f2f5f8;color:#182333;
font:16px/1.5 system-ui,sans-serif}main{max-width:1260px;margin:36px auto;padding:0 28px}
h1{font-size:30px;line-height:1.2;margin:8px 0 16px}h2{font-size:21px}
a{color:#155bab}.eyebrow{font-weight:700;color:#425c76;letter-spacing:.12em}
.meta{color:#4a5b6b;font-size:14px;overflow-wrap:anywhere}.card{background:white;
border:1px solid #d6dfe7;border-radius:12px;padding:24px;margin:22px 0}
.pass{color:#087345}.fail{color:#b02828}table{width:100%;border-collapse:collapse}
td,th{text-align:left;padding:11px 12px;border-bottom:1px solid #dde4ea}
pre{background:#152334;color:#f4f7fb;padding:22px;border-radius:8px;
font:14px/1.65 ui-monospace,'DejaVu Sans Mono',monospace;white-space:pre-wrap;
overflow-wrap:anywhere}.note{border-left:4px solid #3a719e;padding:10px 18px;
background:#e9f1f8}code{font-family:ui-monospace,monospace}
@media print{body{background:white}main{margin:0}.card{break-inside:avoid}}
"""


def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT, text=True).strip()


def page(title, body, metadata):
    return (f'<!doctype html><html lang="en"><meta charset="utf-8">'
            f'<meta name="viewport" content="width=device-width,initial-scale=1">'
            f'<title>{html.escape(title)} — FreshLens test evidence</title>'
            f'<style>{CSS}</style><main><div class="eyebrow">FRESHLENS · GROUP 21 · PID 5</div>'
            f'<h1>{html.escape(title)}</h1><p class="meta">'
            f'Branch: {html.escape(metadata["branch"])} · Commit: {metadata["commit"][:12]}<br>'
            f'Run: {html.escape(metadata["started"])} · Python {metadata["python"]}'
            f' · Node {metadata["node"]}</p>{body}</main></html>')


def execute(name, cwd, command, out, env, metadata):
    started = time.monotonic()
    display = shlex.join(command)
    print(f"\n{'=' * 72}\n{name}\n$ cd {cwd}\n$ {display}", flush=True)
    try:
        result = subprocess.run(command, cwd=ROOT / cwd, env=env, text=True,
                                stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                timeout=600)
        output, code = result.stdout, result.returncode
    except (OSError, subprocess.TimeoutExpired) as error:
        output, code = f"Unable to complete command: {error}\n", 1
    output = re.sub(r"\x1b\[[0-9;]*m", "", output)
    print(output, end="", flush=True)
    elapsed = round(time.monotonic() - started, 2)
    log = (f'FreshLens | {name}\nBranch: {metadata["branch"]}\n'
           f'Commit: {metadata["commit"]}\nRun: {metadata["started"]}\n'
           f'$ cd {cwd}\n$ {display}\n\n{output}\n'
           f'Exit code: {code} | Elapsed: {elapsed}s\n')
    (out / f"{name}.log").write_text(log)
    return dict(name=name, cwd=cwd, command=display, exit_code=code,
                elapsed_seconds=elapsed, log_sha256=hashlib.sha256(log.encode()).hexdigest(),
                output=output)


def render(out, results, metadata):
    rows = []
    for result in results:
        name = result["name"]
        status = "PASS" if result["exit_code"] == 0 else "FAIL"
        result["status"] = status
        xml = out / f"{name}.xml"
        if xml.exists():
            suites = ET.parse(xml).getroot().findall("testsuite")
            counts = {key: sum(int(s.get(key, 0)) for s in suites)
                      for key in ("tests", "failures", "errors", "skipped")}
            result["counts"] = counts
            summary = (f'{counts["tests"]} tests · {counts["failures"]} failures · '
                       f'{counts["errors"]} errors · {counts["skipped"]} skipped')
        else:
            tests = re.search(r"(?:ℹ|#) tests (\d+)", result["output"])
            summary = f"{tests[1]} tests" if tests else "SQL assertions" if name == "database" else "Static check"
        result["summary"] = summary
        rows.append(f'<tr><td><a href="{name}.html">{name}</a></td>'
                    f'<td class="{status.lower()}"><b>{status}</b></td>'
                    f'<td>{summary}</td><td>{result["elapsed_seconds"]}s</td></tr>')
        body = (f'<p><a href="index.html">All results</a> · <a href="{name}.log">Raw log</a></p>'
                f'<h2 class="{status.lower()}">{status} · {summary}</h2>'
                f'<pre>{html.escape((out / (name + ".log")).read_text())}</pre>')
        (out / f"{name}.html").write_text(page(name, body, metadata))

    # These are excerpts of the full run, not additional executions or test counts.
    figures = [
        ("API-01", "Scan upload workflow", "api", "tests/test_scans.py::",
         "FastAPI tests use fake storage, database and task publisher dependencies; this is not a phone/camera or live R2 test."),
        ("API-02", "Sales and idempotency", "api", "tests/test_sales.py::",
         "Service tests use a fake database. Same key and payload replays without stock deduction; a changed payload conflicts. Concurrent database requests are not exercised."),
        ("ML-01", "Identity confidence threshold", "ml", "tests/test_identity.py::",
         "Controlled fake model predictions test the confidence gates; these results do not measure trained-model accuracy."),
    ]
    links = []
    for case, title, name, prefix, note in figures:
        result = next(r for r in results if r["name"] == name)
        lines = [line for line in result["output"].splitlines() if line.startswith(prefix)]
        excerpt = "\n".join(lines) or "No test result lines available. Open the full log for the failure."
        body = (f'<p><a href="index.html">All results</a> · '
                f'<a href="{name}.log">Full source log</a> · <a href="{name}.xml">JUnit XML</a></p>'
                f'<p class="note">{note}</p><div class="card"><b>Actual output excerpt</b>'
                f'<p class="meta">Working directory: {result["cwd"]}<br>'
                f'Full suite command: {html.escape(result["command"])}</p>'
                f'<pre>{html.escape(excerpt)}</pre><p>Full {name} suite: '
                f'<b class="{result["status"].lower()}">{result["status"]}</b> · '
                f'{result["summary"]} · exit code {result["exit_code"]}</p></div>')
        (out / f"{case}.html").write_text(page(f"{case} · {title}", body, metadata))
        links.append(f'<li><a href="{case}.html">{case} — {title}</a></li>')
    database = next(r for r in results if r["name"] == "database")
    lines = database["output"].splitlines()
    start = next((i - 2 for i, line in enumerate(lines) if "RLS isolation and auth-hook checks passed" in line), 0)
    excerpt = "\n".join(lines[max(0, start):])
    body = ('<p><a href="index.html">All results</a> · <a href="database.log">Full source log</a></p>'
            '<p class="note">Both repository SQL suites executed against a new PostgreSQL 16 database. '
            'The runtime check connects as freshlens_api_local over TCP. All SQL uses ON_ERROR_STOP=1.</p>'
            '<div class="card"><b>Actual final output excerpt</b>'
            '<p class="meta">Command: bash scripts/test-evidence-db.sh<br>'
            'Includes migrations 0001–0003; temporary database removed after the run.</p>'
            f'<pre>{html.escape(excerpt)}</pre><p>Database run: '
            f'<b class="{database["status"].lower()}">{database["status"]}</b> · '
            f'exit code {database["exit_code"]}</p></div>')
    (out / "SEC-01.html").write_text(page("SEC-01 · Tenant isolation and runtime role", body, metadata))
    links.extend(['<li><a href="SEC-01.html">SEC-01 — Database tenant isolation and restricted runtime login</a></li>',
                  '<li><a href="web.html">UI-01 — Admin data mapping and web auth logic (no rendered UI)</a></li>',
                  '<li><a href="mobile.html">Mobile auth claims and chunked session storage</a></li>'])
    body = ('<p>Recorded local executions of the existing repository tests. Open a result or a report figure below to capture it.</p>'
            '<div class="card"><table><thead><tr><th>Suite / check</th><th>Result</th>'
            '<th>Scope</th><th>Elapsed</th></tr></thead><tbody>' + "".join(rows) + '</tbody></table></div>'
            '<div class="card"><h2>Figures for the report</h2><ul>' + "".join(links) + '</ul></div>'
            '<p class="note">Evidence covers automated API/service, ML logic, frontend utility, and PostgreSQL security tests. '
            'It does not establish browser rendering, mobile camera behaviour, load performance, model accuracy, or a live end-to-end workflow. '
            'Frontend tests use Node’s test runner through tsx, not Jest.</p>'
            '<p><a href="results.json">Run metadata and log hashes</a></p>')
    (out / "index.html").write_text(page("Automated test results", body, metadata))
    (out / "results.json").write_text(json.dumps({"metadata": metadata, "results": [
        {key: value for key, value in r.items() if key != "output"} for r in results]}, indent=2) + "\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, help="New output directory (default: runs/test-evidence/<timestamp>)")
    args = parser.parse_args()
    now = datetime.now().astimezone()
    out = (args.output or ROOT / "runs/test-evidence" / now.strftime("%Y%m%d-%H%M%S")).resolve()
    out.mkdir(parents=True, exist_ok=False)
    metadata = dict(started=now.isoformat(timespec="seconds"), branch=git("branch", "--show-current"),
                    commit=git("rev-parse", "HEAD"), worktree=git("status", "--short"),
                    python=sys.version.split()[0], node=subprocess.check_output(["node", "--version"], text=True).strip())
    # Override settings consumed by API tests; never copy local secrets into evidence.
    env = dict(os.environ, NO_COLOR="1", PYTHONUNBUFFERED="1", APP_ENV="test",
               SUPABASE_URL="https://example.supabase.co", DATABASE_SSL_MODE="prefer",
               DATABASE_URL="postgresql://freshlens_api_local:freshlens_api_local@localhost:5432/freshlens",
               CORS_ORIGINS="http://localhost:3000,http://localhost:3001,http://localhost:3002",
               CELERY_BROKER_URL="redis://localhost:6379/0", CELERY_RESULT_BACKEND="redis://localhost:6379/1",
               REDIS_URL="redis://localhost:6379/0", SCAN_STORAGE_DIR=str(out / "scan-storage"))
    env.pop("FORCE_COLOR", None)
    jobs = []
    for name, cwd in (("api", "apps/api"), ("ml", "packages/ml")):
        jobs.append((name, cwd, [sys.executable, "-m", "pytest", "-v", "--tb=short", "--color=no",
                                 "-o", "console_output_style=classic", "-o", f"cache_dir={out / ('cache-' + name)}",
                                 f"--junitxml={out / (name + '.xml')}"]))
    for name in ("web", "mobile"):
        cwd = f"apps/{name}"
        files = sorted(str(p.relative_to(ROOT / cwd)) for p in (ROOT / cwd / "src/lib").rglob("*.test.ts"))
        jobs.append((name, cwd, ["./node_modules/.bin/tsx", "--test", "--test-reporter=spec", *files]))
    jobs.extend([
        ("database", ".", ["bash", "scripts/test-evidence-db.sh"]),
        ("web-lint", "apps/web", ["npm", "run", "lint"]),
        ("web-typecheck", "apps/web", ["npm", "run", "typecheck"]),
        ("mobile-typecheck", "apps/mobile", ["npm", "run", "typecheck"]),
    ])
    results = [execute(name, cwd, command, out, env, metadata) for name, cwd, command in jobs]
    render(out, results, metadata)
    print(f"\nOpen in a browser: {out / 'index.html'}", flush=True)
    return int(any(result["exit_code"] != 0 for result in results))


if __name__ == "__main__":
    sys.exit(main())
