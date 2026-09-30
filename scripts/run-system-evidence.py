#!/usr/bin/env python3
"""Run integration or k6 tests against a fresh local service stack."""
import argparse
from datetime import datetime
import json
import os
from pathlib import Path
import shlex
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tests/system"))
from local_stack import LocalStack


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("profile", choices=("integration", "smoke", "load", "spike"))
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    out = (args.output or ROOT / "runs/test-evidence" /
           datetime.now().strftime(f"{args.profile}-%Y%m%d-%H%M%S")).resolve()
    out.mkdir(parents=True, exist_ok=False)
    print(f"FreshLens | {args.profile.upper()} | {datetime.now().astimezone():%Y-%m-%d %H:%M:%S %z}", flush=True)
    with LocalStack(out, performance=args.profile != "integration") as stack:
        env = dict(os.environ, FRESHLENS_SYSTEM_CONFIG=str(stack.config_path), PERF_PROFILE=args.profile)
        if args.profile == "integration":
            command = [sys.executable, "-m", "pytest", "tests/system/test_live_api.py", "-v", "--tb=short",
                       "-p", "no:cacheprovider", f"--junitxml={out / 'integration.xml'}"]
        else:
            command = [str(ROOT / ".venv-test-report/bin/k6"), "run", "--no-usage-report",
                       "--summary-export", str(out / "summary.json"),
                       "--out", f"json={out / 'metrics.json.gz'}", "tests/performance/api.k6.js"]
            print("Local acceptance criteria: read p95 < 500ms; write p95 < 1000ms; HTTP failures < 1%; all checks pass.", flush=True)
            print("Fixture per tenant: 1 product, 1 batch, 20 scans, 5 alerts. Two tenants; actual sale writes and replays.", flush=True)
        print("$ " + shlex.join(command), flush=True)
        result = subprocess.run(command, cwd=ROOT, env=env)
        invariant_ok = True
        if args.profile != "integration":
            import psycopg
            with psycopg.connect(stack.config["owner_dsn"]) as db:
                for label in ("a", "b"):
                    actor = stack.config["actors"][label]
                    left = db.execute("select quantity_remaining from public.batches where id=%s", (actor["batch_id"],)).fetchone()[0]
                    sold = db.execute("select coalesce(sum(quantity_sold),0) from public.sale_items where batch_id=%s", (actor["batch_id"],)).fetchone()[0]
                    good = left == 1000000 - sold and left >= 0
                    invariant_ok &= good
                    print(f"Post-load stock check, tenant {label}: {'PASS' if good else 'FAIL'} (remaining={left}, sold={sold})", flush=True)
        code = result.returncode or (0 if invariant_ok else 1)
        (out / "result.json").write_text(json.dumps(dict(profile=args.profile, exit_code=code), indent=2))
    print(f"\n{args.profile.upper()} exit code: {code}. Disposable services removed.\nEvidence: {out}", flush=True)
    return code


if __name__ == "__main__":
    sys.exit(main())
