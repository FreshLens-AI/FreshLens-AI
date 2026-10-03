## Completed submission report

The finished [PDF](test-plan-report.pdf) contains the supplied terminal captures,
accurate integration/k6 outcomes, and eight additional Playwright browser tests.
See [the report source](test-plan-report.md) and [build instructions](test-report-build.md).
The spike result remains a latency **FAIL**; smoke and load passed.

# Test report screenshot evidence

For the test-type classification and the **new live integration and k6 tests**,
see [Integration and performance evidence](integration-performance-tests.md).
Open their four raw terminal tabs with:

```bash
python3 scripts/test-evidence-terminal.py --system
```

For **raw terminal screenshots**, run this from the repository root:

```bash
python3 scripts/test-evidence-terminal.py
```

This opens a maximized GNOME Terminal window with separate tabs and runs the
actual commands live. Each tab stays open after completion. Capture `API-01`,
`API-02`, `SEC-01`, `ML-01`, `UI-01`, and `Mobile`; `API-all`, `ML-all`, and
`Checks` provide full-suite and static-check summaries. Switch tabs with
**Ctrl+PageDown / Ctrl+PageUp**. Press Enter in a finished tab to close it.
Raw terminal transcripts and exit codes are retained under
`runs/test-evidence/terminal-<timestamp>/`.

For the formatted browser views:

Run from the repository root on `test-plan-report`:

```bash
.venv-test-report/bin/python scripts/test-evidence.py
```

The command prints the path to `index.html`. Open that file in your browser.
Every run gets a separate folder under `runs/test-evidence/` (already ignored by
Git), containing actual command output, exit codes, timestamps, commit identity,
JUnit XML for Python tests, and HTML views. The browser views display recorded
output; they are not screenshots of the application itself.

On another machine, first install Python 3.12+, Node 22 and Docker, then:

```bash
python3 -m venv .venv-test-report
.venv-test-report/bin/python -m pip install -r apps/api/requirements.txt -r packages/ml/requirements.txt
npm --prefix apps/web ci
npm --prefix apps/mobile ci
```

The database runner creates its own isolated PostgreSQL 16 container with
temporary storage and no host ports. It applies all current migrations and runs
both SQL suites, then removes its container. Existing databases are not used.
`TEST_POSTGRES_IMAGE` can select another PostgreSQL 16 image if necessary.

## Screenshots to capture

Open each link under **Figures for the report**. Keep the heading, commit,
timestamp, test names and final result visible. Browser zoom or full-page
capture can help with the longer web/mobile output.

| Report location | Evidence page | Suggested caption |
| --- | --- | --- |
| Section 1.1 | `index.html` | Local automated test and static-check results. |
| Section 4.1, API-01 | `API-01.html` | Scan API tests verify HTTP 202, input validation, asynchronous dispatch and failure handling with fake dependencies. |
| Section 4.2, API-02 | `API-02.html` | Sales service tests verify stock deduction, oversell protection, matching-key replay and conflicting-payload rejection. |
| Section 4.3, SEC-01 | `SEC-01.html` | PostgreSQL RLS isolation, auth-hook and restricted runtime login tests pass on an isolated PostgreSQL 16 database. |
| Section 4.4, ML-01 | `ML-01.html` | Controlled model predictions verify identity and freshness confidence gates. |
| Section 4.5, UI-01 | `web.html` | Admin response mapping and web authentication claim unit tests pass using the Node test runner. |
| Section 4.6 | `mobile.html` | Mobile authentication claim and chunked session storage unit tests pass. |

The complete API and ML logs are also available through `api.html` and
`ml.html`. Static-check pages are linked from the overview. Keep the raw logs
and XML alongside the screenshots for traceability.

## Corrections applied to the completed report

The completed PDF and its sources now incorporate these corrections to the
original draft. Live integration, k6 and Playwright have their own sections.

- **API-01:** The automated test posts a multipart image through FastAPI
  TestClient and uses fake storage, database and task publishing. It does not
  operate a mobile camera or validate live Redis/R2. The current storage
  implementation writes to local disk.
- **API-02:** Same key plus same payload replays the existing sale without
  another deduction. A different payload with the same key conflicts (409).
  The service tests use a fake database and do not fire concurrent HTTP
  requests. The original draft's statement that an identical retry must return 409
  conflicts with the API contract.
- **SEC-01:** Local tests use `freshlens_api_local`; the hosted role is named
  differently. This run exercises the actual PostgreSQL policies and login.
- **ML-01:** The identity test supplies fake model predictions (including a
  score of 0.70 below the 0.75 threshold). It does not load trained YOLO
  weights or evaluate a real blurry image. Rejected identity is represented
  by an absent identity label, with no freshness inference.
- **UI-01:** `admin-map.test.ts` checks data transformation. It does not render
  React charts, navigate a browser or sign in to Supabase. Label this evidence
  as frontend logic testing. The new UI-02 section records the separate
  Playwright browser smoke tests.
- **Tools and evidence:** Web/mobile use `node:test` through `tsx`, not Jest.
  This helper retains local logs and Python JUnit XML. The current CI workflow
  does not configure coverage reports or artifact uploads. Do not claim those
  were generated by these runs.
- **Original-suite coverage limits:** No load/performance, cross-device camera, live full-flow,
  or trained-model accuracy evidence is produced by the original suites above.
  Passing utility tests do not establish those broader outcomes.

The initial run passed **68 API + 28 ML + 8 web + 9 mobile = 113 tests**, both
SQL suites, web lint and both TypeScript checks. The API run emits a third-party
Starlette/AnyIO deprecation warning; it does not fail a test.
