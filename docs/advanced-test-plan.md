# FreshLens advanced test plan

**CS3203 · Group 21 · PID 5 · Final evaluation**

This plan is the testing strategy for the final evaluation. It covers unit, API, integration, regression, browser automation, end-to-end UI, accessibility, performance, security, and operational evidence. The suite that this document executes is the **admin GUI automation and end-to-end suite** in `tests/e2e/`, run against the deployed workspace at `https://freshlens-admin.vercel.app`.

The earlier 27 September report (`docs/test-plan-report.md`) remains the evidence pack for API, ML, SQL, k6, and the original unauthenticated Playwright smoke. This plan does not replace those results. It adds the authenticated journeys that report explicitly left open.

## 1. What “excellent” means on the rubric

Task 3 awards the top band for **many appropriate test types**, not for a single large unit suite. Each type below has a purpose, a tool, a pass rule, and a place in the demo narrative.

| Type | Purpose in FreshLens | Tool | Pass rule |
|---|---|---|---|
| Unit | Business rules with no network | pytest, `node:test` | Command exit 0 |
| API | HTTP contract, roles, validation | FastAPI TestClient | Expected status and body |
| Integration | Real Postgres, Redis, Celery, RLS | `tests/system`, `infra/db/tests` | Exit 0, stock and tenant checks hold |
| Regression | Known defects stay fixed | The same suites in CI | Advisory-lock sales case and RLS suites stay green |
| GUI / browser automation | Rendered admin UI, not just utilities | Playwright | Visible headings, URLs, and control states |
| End-to-end | A real admin session through the live app and API | Playwright + Supabase + VPS | Sign-in reaches overview; every section loads; sign-out locks the app |
| Functional | Positive, negative, and boundary behaviour | All of the above | Assertions, not screenshots alone |
| Accessibility | Basic WCAG 2.1 A/AA on key screens | axe-core in Playwright | No critical or serious violations |
| Performance / load | Accept path under concurrent reads and sales | k6 (existing profiles) | All configured thresholds, not HTTP 200 alone |
| Security | Tenant isolation, role gates, restricted DB role | SQL suites + negative UI/API cases | Cross-tenant and wrong-role access fail |
| Error logs / monitoring | Failures are visible to operators | `/health`, container logs | Health is ok; a failed request leaves a readable log line |
| Test automation | The pack can be re-run | CI jobs + `tests/e2e` | Documented commands, JUnit or terminal evidence |

## 2. System under test

| Surface | Target for this execution |
|---|---|
| Admin web | Deployed Next.js app, `https://freshlens-admin.vercel.app` |
| Identity | Hosted Supabase Auth. A disposable `platform_admin` is created for the run and deleted afterwards |
| API and data | The Azure VPS FastAPI service and Postgres that the admin app already calls |
| Not in this browser suite | Phone camera, Expo UI automation, YOLO accuracy, soak tests |

The local checkout on `feat/mobile-auth-onboarding` is behind `main` in the web app. Browser tests therefore drive the **deployed** UI, which is what the evaluation demo uses. They do not start the older local Next.js tree.

Mobile GUI remains a **manual device checklist** (sign-in, scan, sale confirmation, alerts). There is no Android emulator in this environment, so this execution does not claim native UI automation.

## 3. End-to-end design

### 3.1 Actors

| Actor | How the suite gets it | What it proves |
|---|---|---|
| Anonymous visitor | Fresh browser context | Protected routes never render admin data |
| Platform admin | Disposable Auth user inserted into `public.users` as `platform_admin` | Full workspace journey against live data |
| Signed-in user with no FreshLens role | Disposable Auth user with no `public.users` row | The web app refuses non-admin sessions |

The disposable admin password is generated at runtime and is not stored in git. Cleanup deletes the Auth user and the VPS `public.users` / `auth.users` rows even when a test fails.

### 3.2 Browser cases

Public GUI (`tests/e2e/test_public_ui.py`):

| ID | Case |
|---|---|
| GUI-01 | Login controls, title, and the apply-for-account link |
| GUI-02 | Empty submit shows both field errors and `aria-invalid` |
| GUI-03 | Enter on the empty form does the same |
| GUI-04 | Malformed email is rejected before authentication |
| GUI-05 | Show/hide password keeps the typed value |
| GUI-06 | Wrong password stays on login |
| GUI-07 | An account with no FreshLens role cannot open admin |
| GUI-08 | `/` and `/dashboard` redirect anonymous visitors to login |
| GUI-09 | Tenants, applications, catalogue, scans, alerts, and analytics redirect when signed out |
| GUI-10 | Session-expired route explains why |
| GUI-11 | Access-denied explains the workspace is unavailable and links back to sign-in |
| GUI-12 | An unknown route sends an anonymous visitor to login |
| GUI-13 | Empty tenant application shows field errors and does not claim success |
| GUI-14 | A too-short phone is rejected; Sign in returns to login |
| GUI-15 | Set-password without an invitation says the link is invalid |
| GUI-16 | 390×844 login has no horizontal overflow |
| GUI-17 | Public pages expose a heading |

Authenticated end-to-end (`tests/e2e/test_admin_e2e.py`):

| ID | Case |
|---|---|
| E2E-01 | Platform admin signs in and lands on Platform overview with their profile |
| E2E-02 | Primary navigation opens Overview, Tenants, Applications, Catalogue, Scan activity, Alerts, and Analytics, and marks the current link |
| E2E-03 | Skip link points at `#main-content` |
| E2E-04 | A tenant search with no match shows the empty state and can be cleared |
| E2E-05 | A catalogue search with no match shows zero results |
| E2E-06 | Alert type and severity filters update the URL |
| E2E-07 | Analytics date range updates to the last 7 days |
| E2E-08 | Refresh stays on the overview; the alerts shortcut opens Alerts |
| E2E-09 | The first tenant, when one exists, opens its detail route |
| E2E-10 | At 390×844 the navigation drawer opens Catalogue with no horizontal overflow |
| E2E-11 | A signed-in admin sees the workspace 404 for an unknown route |
| E2E-12 | Sign out returns to login and `/dashboard` is locked again |

Accessibility (`tests/e2e/test_a11y.py`):

| ID | Case |
|---|---|
| A11Y-01 | axe-core WCAG 2.1 A/AA on login, signup, and access-denied: no critical or serious violations |
| A11Y-02 | Login errors are tied to inputs with `aria-describedby`; autocomplete is set |
| A11Y-03 | axe-core on the signed-in overview. Two known serious findings are recorded and do not fail the run: `aria-label` on the freshness bar, and muted text contrast at about 3.72:1. Any other critical or serious violation fails |

Screenshots land in `runs/test-evidence/e2e-ui/`. axe JSON is saved next to them. Screenshots support the assertions; they are not the pass/fail record.

### 3.3 What this E2E run deliberately does not do

- It does not submit a real tenant application, approve one, or invite a user.
- It does not change catalogue, shelf-life, or tenant status.
- It does not upload a scan image or run the CNN.
- It does not measure production capacity. k6 evidence stays in the 27 September pack.

## 4. The rest of the evaluation pack

These layers are already implemented and are part of the plan. Re-run them when Docker and k6 are available; do not describe the September laptop spike as a pass.

| Layer | Command | Evidence already on file |
|---|---|---|
| API unit and component | `cd apps/api && .venv312/bin/pytest` | E01, E02, E07 |
| ML unit | `cd packages/ml && pytest` | E04, E08 |
| Web unit | `cd apps/web && npm test` | E05 |
| Mobile unit | `cd apps/mobile && npm test` | E06 |
| RLS and runtime role | `infra/db/tests/rls_isolation.sql`, `runtime_role.sql` | E03 |
| Live integration | `tests/system/test_live_api.py` | E10, including the concurrent-sale regression |
| Browser smoke (local, older UI) | `tests/ui/test_web_ui.py` | E20–E21. Superseded for the live UI by `tests/e2e/` |
| k6 smoke / load / spike | `tests/performance/api.k6.js` | E11–E19. Spike failed its latency thresholds |
| CI regression | `.github/workflows/ci.yml` | Six jobs on pull requests |

### Regression story to say out loud

1. Identical concurrent sales used to return HTTP 500. The sales service takes a tenant-and-key advisory lock first. The live integration test overlaps two requests on a real row lock and expects one deduction.
2. Low confidence does not become a label. Identity below 0.75 skips freshness; freshness below 0.50 is rejected.
3. A second tenant cannot read the first tenant’s scan. RLS SQL and the live HTTP case both check this.
4. This E2E suite adds a UI regression: a valid Supabase user with no `public.users` row still cannot open the admin workspace.

### Security cases inside the UI suite

- Missing session redirects every admin route to login.
- Wrong password does not create a workspace session.
- A confirmed Auth user without `app_role` is rejected with the vendor-app message.
- Access-denied remains a distinct page for a session that is signed in but not an administrator.
- Postgres and Redis on the VPS listen on `127.0.0.1` only (Phase 1 deploy). That is operational security evidence, not a browser test.

### Performance, logs, and monitoring

Keep the published k6 thresholds: read p95 under 500 ms, sale/replay p95 under 1,000 ms, HTTP failures under 1%, all functional checks passing. Smoke and load met them. Spike did not. Say that plainly.

For the demo, show `GET /health` and `docker compose logs` for `api` and `worker` if a scan or sale fails. A monitoring tool in this scope is container health plus the admin Alerts screen, not a new hosted APM product.

## 5. Entry and exit

**Entry.** Deployed admin URL responds. Supabase admin API can create a user. The VPS accepts the SSH database insert. Playwright Chromium or Chrome is installed.

**Exit.** Every `tests/e2e` case passes, or a failure is recorded with the screenshot and the disposable users are deleted. The report lists limitations from section 3.3.

**How to re-run.**

```bash
.venv-e2e/bin/python -m pytest tests/e2e -v \
  --junitxml=runs/test-evidence/e2e-ui/results.xml
```

The command reads `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from the gitignored `.env`, creates the disposable admin, drives the live site, and deletes the users in fixture teardown.

## 6. Execution record

**2 October 2026, 21:04 Asia/Colombo.** Playwright 1.55.0 drove Chromium 154 against `https://freshlens-admin.vercel.app`.

| Result | Detail |
|---|---|
| Cases | **36 passed** in 295.91 seconds |
| JUnit | `runs/test-evidence/e2e-ui/results.xml` |
| Screenshots | `runs/test-evidence/e2e-ui/*.png` |
| axe reports | `runs/test-evidence/e2e-ui/axe-*.json` |

The run created a disposable platform admin and an unprovisioned Auth user, used them only for this session, and deleted both during fixture teardown.

Public login, signup, access-denied, and set-password pages had no critical or serious axe violations. The signed-in overview recorded two known serious findings and no critical ones:

- `aria-prohibited-attr`: the freshness bar is a `div` with `aria-label` and no role.
- `color-contrast`: muted interface text is about 3.72:1 (`#7a877e` on `#fefefe`); WCAG 2.1 AA text needs 4.5:1.

Those two are written into `axe-dashboard.json`. A new critical or serious rule on that page fails the suite.

Re-run:

```bash
.venv-e2e/bin/python -m pytest tests/e2e -v \
  --junitxml=runs/test-evidence/e2e-ui/results.xml
```
