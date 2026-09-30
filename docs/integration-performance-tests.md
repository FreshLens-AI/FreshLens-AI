# Integration and performance evidence

## What the earlier tests are

| Existing evidence | Classification | What it establishes |
| --- | --- | --- |
| API-01 scans, API route/auth tests | API/component functional tests with substituted dependencies | Request validation, authentication/authorization responses and handler orchestration. Most database, storage and queue dependencies are fakes. |
| API-02 sales service tests | Unit/business-rule tests | Stock rules, retry matching and error handling with a fake database. |
| ML suite | Unit tests | Dataset preparation, label mapping, confidence gates and worker logic. These do not measure trained-model accuracy. |
| UI-01 web, Mobile | Frontend utility unit tests | Data mapping, signed-claim parsing and chunked session storage; no browser rendering or mobile UI automation. |
| SEC-01 PostgreSQL scripts | Database integration/security tests | Real RLS policies, tenant boundaries, auth-hook behaviour and restricted login privileges. |
| ESLint and TypeScript | Static analysis | Source/language correctness checks; not runtime tests. |

## Added live integration tests

`tests/system/test_live_api.py` runs 14 cases against a real Uvicorn HTTP server,
PostgreSQL 16, Redis and Celery. The API and worker use the restricted
`freshlens_api_local` database role and the normal application code. There are
no dependency overrides in this suite.

Coverage includes:

- Real JWT signature verification, malformed/tampered token rejection and roles.
- Restricted database role and tenant-scoped HTTP catalogue reads.
- Sale persistence, identical retry replay and conflicting payload rejection.
- Cross-tenant write rejection and multi-item oversell rollback.
- Concurrent sales for the last item and concurrent identical requests.
- Concurrent conflicting payloads and reuse of a key by different tenants.
- Persisted low-stock alerts visible through the API.
- Multipart scan upload → local file storage → Redis → Celery → PostgreSQL
  completion, inventory creation, and cross-tenant scan access rejection.

The concurrent retry test holds an actual PostgreSQL row lock until two HTTP
requests overlap at database locks, then verifies both return the same sale and
stock is deducted once. It originally reproduced HTTP 500 on one request.
`SalesService.create` now takes a transaction advisory lock scoped to the tenant
and idempotency key before reading the existing sale or validating stock.
This serializes duplicate requests until the first transaction commits.

The external identity provider is a temporary local JWKS fixture with freshly
generated RSA keys. The API still performs its normal signature, issuer,
audience and claim verification. The Celery worker uses **stub-v0** classification.
This is service integration evidence, not real Supabase availability, YOLO
accuracy, phone camera, browser UI, or full deployed end-user workflow evidence.

## k6 profiles and workload

All profiles use `tests/performance/api.k6.js` and a fresh isolated stack.
Each tenant starts with one product, one inventory batch, 20 completed scan
records and five alerts. Each batch starts with 1,000,000 stock units to prevent
fixture exhaustion. This is a small synthetic dataset, not production volume.

Each iteration makes authenticated reads of products, batches, alerts and scans.
Every fifth iteration creates a sale and immediately retries the same sale.
Assertions check HTTP status, nonempty response lists, tenant ownership and
matching sale IDs on replay. After each run, a direct database check verifies
remaining stock equals starting stock minus persisted sales.

| Terminal tab | Test type | Profile |
| --- | --- | --- |
| K6-Smoke | Performance smoke/baseline | 1 virtual user for 10 seconds. |
| K6-Load | Gradual load | 10s ramp to 5 users, 10s ramp to 10, hold 10 for 30s, ramp down over 10s. Total 60s. |
| K6-Spike | Short spike/recovery | 10s ramp to 2 users, rise to 25 over 2s, hold 15s, fall to 2 over 2s, hold 10s, ramp down over 5s. Total 44s. |

Each user pauses 250ms per iteration. k6 virtual users run multiple requests
sequentially; the VU count is not a fixed requests-per-second target. Graceful
completion can extend wall time slightly beyond the configured stages.

The archived 27 September runs show an `unknown field gracefulStop` warning:
the top-level setting was ignored and k6 used its default 30-second graceful
stop. All iterations completed with zero interruptions. The report preserves
this warning and records the effective configuration.

The following **local acceptance thresholds** were chosen before running:

- Read request p95 below **500ms**.
- Sale/replay request p95 below **1,000ms**.
- HTTP failure rate below **1%**.
- All functional checks pass (**100%**).

These are proposed test criteria, not an established production SLA. The p95
means 95% of observed requests took no longer than that measured value. k6
returns a failure exit code if a threshold fails. See the official
[k6 threshold documentation](https://grafana.com/docs/k6/latest/using-k6/thresholds/)
and [ramping-user documentation](https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/ramping-vus/).

The API has one Uvicorn worker. The API, load generator, database and other
applications share this development machine. These short runs establish only
behaviour at the specified local workload. They are not a capacity limit,
soak/endurance test, production benchmark, or ML inference speed measurement.
The k6 workload does not upload scan images; the integration suite checks that
workflow separately.

## Run and capture raw terminal screenshots

From the repository root:

```bash
python3 scripts/test-evidence-terminal.py --system
```

This opens **Integration**, **K6-Smoke**, **K6-Load** and **K6-Spike** tabs, runs
them sequentially and leaves the raw terminal output visible. Use
Ctrl+PageDown/Ctrl+PageUp to switch tabs. Use Ctrl+- to fit more output or
Shift+PageUp to capture the threshold block and result statistics separately.
Do not press Enter until you are ready to close a finished tab.

Suggested screenshot captions:

1. **Integration:** Live API, PostgreSQL and Redis/Celery integration tests;
   local JWKS fixture and stub classifier; 14 test cases.
2. **K6-Smoke:** Single-user performance baseline on the local API.
3. **K6-Load:** Authenticated read/write workload ramping to 10 virtual users.
4. **K6-Spike:** Short traffic spike to 25 virtual users with recovery stages.

Include test counts/threshold outcomes, HTTP request totals, p95 times and the
final exit code. Copy the observed values from your run rather than assuming
the same timings on another machine.

Run one profile directly with:

```bash
.venv-test-report/bin/python scripts/run-system-evidence.py integration
.venv-test-report/bin/python scripts/run-system-evidence.py smoke
.venv-test-report/bin/python scripts/run-system-evidence.py load
.venv-test-report/bin/python scripts/run-system-evidence.py spike
```

Prerequisites are the existing `.venv-test-report` dependencies and Docker,
with `postgres:16.14-alpine` and `redis:7.4-alpine` images. The local k6 binary
is installed at `.venv-test-report/bin/k6` (v2.3.0, Linux AMD64), from the
[official release](https://github.com/grafana/k6/releases/tag/v2.3.0). The archive
SHA-256 was verified before installation:
`39c3117b6af817592dcd0ce4242105c0a7af10948c2a425306f0be8f7a8a8ab1`.

The runner retains raw terminal transcripts and per-tab exit codes under
`runs/test-evidence/terminal-<timestamp>/`. Profile subdirectories contain
`integration.xml` or k6 `summary.json` and compressed raw metric samples
`metrics.json.gz`, along with API/worker logs and `environment.json`.
The compressed samples include request timings and status tags; no HTTP header
or request-body dump is enabled. The ignored `local-config.json` holds only
temporary local test tokens and connection details; omit it from shared evidence.
Temporary containers and processes are removed after each completed run.

## Recorded results: 27 September 2026

Final raw terminal evidence is in
`runs/test-evidence/terminal-20260927-212122/`. All profiles below use the same
populated fixture and the same thresholds. The application includes the local
sales concurrency fix described above; the change has not been committed.

The **14 integration cases passed**. The existing **68 API tests** also passed
after the sales change (one third-party Starlette/AnyIO deprecation warning).

| k6 profile | Requests | Read p95 | Write p95 | HTTP failures | Outcome |
| --- | ---: | ---: | ---: | ---: | --- |
| Smoke, 1 user | 84 | 77.50 ms | 110.91 ms | 0% | PASS |
| Load, up to 10 users | 1,754 | 308.80 ms | 499.62 ms | 0% | PASS |
| Spike, up to 25 users | 1,032 | 668.52 ms | 1,192.94 ms | 0% | FAIL: both p95 latency thresholds exceeded |

All three runs had **100% functional checks passing**, and the post-load
database stock checks passed for both tenants. The spike's exit code is **99**,
the k6 threshold-failure result. Report the latency failure explicitly; do not
describe the spike as passing just because its HTTP error rate was zero.
The short local spike indicates performance degradation at this workload;
identifying the bottleneck and improving capacity remain separate work.

Keep the earlier report corrections for the original tests. Cite these newly
added integration and performance runs separately when extending the report.
