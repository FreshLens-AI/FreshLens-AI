# Seed script for labels, milestones, and issues (idempotent-ish)
$ErrorActionPreference = "Stop"
$Repo = "FreshLens-AI/FreshLens-AI"

$labels = @(
  @{ name = "type: feature"; color = "1D76DB"; description = "New functionality" },
  @{ name = "type: bug"; color = "D73A4A"; description = "Broken behaviour" },
  @{ name = "type: chore"; color = "FBCA04"; description = "Tooling, CI, refactor" },
  @{ name = "type: docs"; color = "0075CA"; description = "SRS, design, proposal" },
  @{ name = "type: spike"; color = "BFD4F2"; description = "Time-boxed research" },
  @{ name = "area: api"; color = "5319E7"; description = "FastAPI backend" },
  @{ name = "area: web"; color = "0E8A16"; description = "Next.js admin" },
  @{ name = "area: mobile"; color = "006B75"; description = "React Native / Expo" },
  @{ name = "area: ml"; color = "C5DEF5"; description = "Training + inference" },
  @{ name = "area: infra"; color = "EDEDED"; description = "Docker, CI" },
  @{ name = "area: db"; color = "B60205"; description = "Schema, RLS" },
  @{ name = "priority: P0"; color = "B60205"; description = "Blocker" },
  @{ name = "priority: P1"; color = "D93F0B"; description = "Important" },
  @{ name = "priority: P2"; color = "FEF2C0"; description = "Nice to have" },
  @{ name = "status: blocked"; color = "000000"; description = "Waiting on dependency" }
)

Write-Host "Creating labels..."
foreach ($l in $labels) {
  gh label create $l.name --repo $Repo --color $l.color --description $l.description --force 2>$null
  if ($LASTEXITCODE -ne 0) { Write-Host "  label $($l.name) skipped or updated" }
}

Write-Host "Creating milestones..."
$milestones = @(
  @{ title = 'M1 - Proposal and planning'; due = '2026-07-12T23:59:59Z'; desc = 'Proposal (5 Jul), feasibility + Gantt (12 Jul). Maps to gantt M1–M2.' },
  @{ title = 'M2 - SRS and design'; due = '2026-08-09T23:59:59Z'; desc = 'SRS + architecture/design due. Maps to gantt M3 (9 Aug).' },
  @{ title = 'M3 - Iteration 1 (mid-eval)'; due = '2026-08-30T23:59:59Z'; desc = 'Iteration 1: auth, DB+RLS, UI skeleton, stub ML, Progress Review 1 + mid-eval. Maps to gantt M4 (30 Aug).' },
  @{ title = 'M4 - Iteration 2 (ML + integration)'; due = '2026-10-02T23:59:59Z'; desc = 'Iteration 2: real FL-2TC CNN, Celery, R2, alerts, analytics through Progress Review 2. Maps to gantt through M5/PR2 (~2 Oct).' },
  @{ title = 'M5 - Testing and final'; due = '2026-10-03T23:59:59Z'; desc = 'Testing doc (27 Sep), demo video, final report + zip (3 Oct). Maps to gantt M5–M6.' }
)

$milestoneIds = @{}
foreach ($m in $milestones) {
  $query = 'repos/' + $Repo + '/milestones?state=open&per_page=100'
  $existing = gh api $query --jq ".[] | select(.title==`"$($m.title)`") | .number" 2>$null
  if ($existing) {
    $num = ($existing | Select-Object -First 1).ToString().Trim()
    Write-Host "  Milestone exists: $($m.title) (#$num)"
    $milestoneIds[$m.title] = [int]$num
  } else {
    $num = gh api "repos/$Repo/milestones" -f "title=$($m.title)" -f "due_on=$($m.due)" -f "description=$($m.desc)" --jq ".number"
    Write-Host "  Created milestone: $($m.title) (#$num)"
    $milestoneIds[$m.title] = [int]$num
  }
}

Write-Host "Creating issues..."
$issues = @(
  @{
    title = "Finalize and submit project proposal"
    milestone = 'M1 - Proposal and planning'
    labels = "type: docs,priority: P1"
    assignee = "buwaneka-halpage"
    body = @"
## Description
Final review and submission of the CS3203 project proposal (PID 5).

## Acceptance criteria
- [ ] All sections complete (objectives, scope, deliverables, technology)
- [ ] Course code and team details correct (CS3203)
- [ ] ML pipeline story clarified (classification vs detection, quantity model)
- [ ] Submitted before 2026-07-05 deadline
"@
  },
  @{
    title = "Write feasibility study document"
    milestone = 'M1 - Proposal and planning'
    labels = "type: docs,priority: P1"
    assignee = "sathurshna"
    body = @"
## Description
Technology comparison and feasibility analysis referenced by the proposal.

## Acceptance criteria
- [ ] Alternatives considered for backend, DB, mobile, ML, queue
- [ ] Chosen stack justified (FastAPI, Postgres RLS, Celery, etc.)
- [ ] Risks and mitigations documented
- [ ] Stored in ``docs/feasibility/``
"@
  },
  @{
    title = "Publish project schedule and Gantt chart"
    milestone = 'M1 - Proposal and planning'
    labels = "type: docs,priority: P2"
    assignee = "buwaneka-halpage"
    body = @"
## Acceptance criteria
- [ ] Schedule aligned with CS3203 batch-23 deadlines
- [ ] Gantt chart or timeline view in ``docs/``
- [ ] GitHub milestones M1–M5 match schedule
"@
  },
  @{
    title = "Write System Requirements Specification (SRS)"
    milestone = 'M2 - SRS and design'
    labels = "type: docs,area: api,priority: P1"
    assignee = "buwaneka-halpage"
    body = @"
## Acceptance criteria
- [ ] Functional requirements for vendor and admin roles
- [ ] Non-functional requirements (security, multi-tenancy, performance)
- [ ] Scan flow and alert rules defined
- [ ] Stored in ``docs/srs/``
"@
  },
  @{
    title = "Write system architecture and design document"
    milestone = 'M2 - SRS and design'
    labels = "type: docs,area: infra,priority: P1"
    assignee = "SMS123456789"
    body = @"
## Acceptance criteria
- [ ] Component diagram (mobile, web, API, worker, DB, R2, Redis)
- [ ] Multi-tenant RLS design documented
- [ ] Async scan pipeline sequence documented
- [ ] Data model (tenants, users, products, scans, alerts)
- [ ] Stored in ``docs/design/``
"@
  },
  @{
    title = "Scaffold FastAPI application"
    milestone = 'M3 - Iteration 1 (mid-eval)'
    labels = "type: feature,area: api,priority: P1"
    assignee = "buwaneka-halpage"
    body = @"
## Acceptance criteria
- [ ] ``apps/api`` with FastAPI project structure
- [ ] Health check endpoint
- [ ] Docker service wired in compose
- [ ] README with local run instructions
"@
  },
  @{
    title = "Database schema and Row-Level Security policies"
    milestone = 'M3 - Iteration 1 (mid-eval)'
    labels = "type: feature,area: db,priority: P0"
    assignee = "buwaneka-halpage"
    body = @"
## Acceptance criteria
- [ ] Tables: tenants, users, products, scans, alerts
- [ ] Every business table has ``tenant_id``
- [ ] RLS policies use ``current_setting('app.tenant_id')``
- [ ] Migration(s) in ``infra/db/migrations/``
- [ ] RLS isolation test stub in CI
"@
  },
  @{
    title = "Integrate Supabase Auth and tenant middleware"
    milestone = 'M3 - Iteration 1 (mid-eval)'
    labels = "type: feature,area: api,priority: P1"
    assignee = "buwaneka-halpage"
    body = @"
## Acceptance criteria
- [ ] JWT validation on protected routes
- [ ] Middleware sets ``app.tenant_id`` per request
- [ ] Vendor vs admin role distinction
"@
  },
  @{
    title = "Scaffold Next.js admin dashboard"
    milestone = 'M3 - Iteration 1 (mid-eval)'
    labels = "type: feature,area: web,priority: P1"
    assignee = "SMS123456789"
    body = @"
## Acceptance criteria
- [ ] ``apps/web`` Next.js App Router + TypeScript
- [ ] Login page (Supabase Auth)
- [ ] Empty admin layout with nav shell
- [ ] Vendor list placeholder page
"@
  },
  @{
    title = "Scaffold Expo mobile app with camera screen"
    milestone = 'M3 - Iteration 1 (mid-eval)'
    labels = "type: feature,area: mobile,priority: P1"
    assignee = "sathurshna"
    body = @"
## Acceptance criteria
- [ ] ``apps/mobile`` Expo project initialized
- [ ] Camera capture screen (permissions handled)
- [ ] Vendor dashboard shell
- [ ] API client stub for scan upload
"@
  },
  @{
    title = "Implement POST /scan async endpoint (202 + queue)"
    milestone = 'M3 - Iteration 1 (mid-eval)'
    labels = "type: feature,area: api,priority: P1"
    assignee = "buwaneka-halpage"
    body = @"
## Acceptance criteria
- [ ] ``POST /scan`` accepts image upload
- [ ] Image stored (local or R2 stub)
- [ ] Celery job enqueued; returns ``202`` with job/scan id
- [ ] **No synchronous CNN in request handler**
- [ ] Stub worker writes placeholder classification for mid-eval
"@
  },
  @{
    title = "Connect web and mobile clients to API"
    milestone = 'M3 - Iteration 1 (mid-eval)'
    labels = "type: feature,area: api,priority: P1"
    assignee = "SMS123456789"
    body = @"
## Acceptance criteria
- [ ] Web admin can authenticate and fetch tenant-scoped data
- [ ] Mobile can upload scan and poll/view result
- [ ] End-to-end demo path documented
"@
  },
  @{
    title = "Prepare mid-evaluation demo script"
    milestone = 'M3 - Iteration 1 (mid-eval)'
    labels = "type: docs,priority: P1"
    assignee = "sathurshna"
    body = @"
## Acceptance criteria
- [ ] Demo script: vendor scan → dashboard update (stub ML OK)
- [ ] Admin view of vendor data
- [ ] Known limitations listed (real ML in M4)
"@
  },
  @{
    title = "Train CNN for produce classification"
    milestone = 'M4 - Iteration 2 (ML + integration)'
    labels = "type: feature,area: ml,priority: P1"
    assignee = "SMS123456789"
    body = @"
## Acceptance criteria
- [ ] Train on Fruits-360 + Kaggle fresh/rotten datasets
- [ ] Fresh / Medium / Spoiled classes defined and documented
- [ ] Model artifacts versioned in ``packages/ml``
- [ ] Precision/recall metrics recorded
"@
  },
  @{
    title = "Build Celery ML inference worker"
    milestone = 'M4 - Iteration 2 (ML + integration)'
    labels = "type: feature,area: ml,priority: P1"
    assignee = "buwaneka-halpage"
    body = @"
## Acceptance criteria
- [ ] Worker consumes scan jobs from Redis
- [ ] Runs CNN inference; writes classification to DB
- [ ] Redis keys namespaced ``tenant:{tenant_id}:...``
- [ ] ``model_version`` stored on scan record
"@
  },
  @{
    title = "Integrate Cloudflare R2 image storage"
    milestone = 'M4 - Iteration 2 (ML + integration)'
    labels = "type: feature,area: infra,priority: P2"
    assignee = "buwaneka-halpage"
    body = @"
## Acceptance criteria
- [ ] Scan images uploaded to R2
- [ ] ``image_path`` on scan records
- [ ] Credentials via env vars only
"@
  },
  @{
    title = "Implement low-stock and spoilage alerts"
    milestone = 'M4 - Iteration 2 (ML + integration)'
    labels = "type: feature,area: api,priority: P1"
    assignee = "SMS123456789"
    body = @"
## Acceptance criteria
- [ ] Alert rules defined (thresholds from SRS)
- [ ] Alerts created on scan results / stock levels
- [ ] Visible on vendor mobile and admin web dashboards
"@
  },
  @{
    title = "Build admin analytics dashboard"
    milestone = 'M4 - Iteration 2 (ML + integration)'
    labels = "type: feature,area: web,priority: P1"
    assignee = "SMS123456789"
    body = @"
## Acceptance criteria
- [ ] Aggregated spoilage/waste trends across tenants
- [ ] Tenant-scoped vendor analytics
- [ ] Charts for freshness distribution over time
"@
  },
  @{
    title = "Expand CI: lint, test, RLS isolation, Docker build"
    milestone = 'M3 - Iteration 1 (mid-eval)'
    labels = "type: chore,area: infra,priority: P1"
    assignee = "buwaneka-halpage"
    body = @"
## Acceptance criteria
- [ ] Lint jobs for api/web when scaffolded
- [ ] RLS tenant isolation integration test
- [ ] Docker build on every PR
"@
  },
  @{
    title = "Implement stub Celery classifier for mid-evaluation"
    milestone = 'M3 - Iteration 1 (mid-eval)'
    labels = "type: feature,area: ml,priority: P0"
    assignee = "buwaneka-halpage"
    body = @"
## Context
Mid-evaluation allows stubbed classification. Real FL-2TC stays on the M4 Celery/CNN issues.

## Acceptance criteria
- [ ] Celery worker runs in Docker Compose alongside API + Redis
- [ ] Job accepts scan id / image path and writes a deterministic stub result (Fresh / Medium / Spoiled)
- [ ] Redis keys are tenant-namespaced: ``tenant:{tenant_id}:...``
- [ ] No CNN loaded in the API process; inference only in the worker
- [ ] Compatible with ``POST /scan`` → 202 flow

## Out of scope
Real Tier-1 / Tier-2 models — replace stub in M4.
"@
  },
  @{
    title = "System testing and RLS isolation test suite"
    milestone = 'M5 - Testing and final'
    labels = "type: chore,area: db,priority: P1"
    assignee = "buwaneka-halpage"
    body = @"
## Acceptance criteria
- [ ] Unit tests for critical API paths
- [ ] Integration tests for scan pipeline
- [ ] RLS proves vendor A cannot read vendor B data
"@
  },
  @{
    title = "Write testing document"
    milestone = 'M5 - Testing and final'
    labels = "type: docs,priority: P1"
    assignee = "sathurshna"
    body = @"
## Acceptance criteria
- [ ] Test plan, cases, results
- [ ] CS3203 format requirements met
- [ ] Stored in ``docs/testing/``
"@
  },
  @{
    title = "Record and upload demo video"
    milestone = 'M5 - Testing and final'
    labels = "type: docs,priority: P1"
    assignee = "sathurshna"
    body = @"
## Acceptance criteria
- [ ] Full scenario: scan → classify → dashboard → alert
- [ ] Uploaded to YouTube; link in README
"@
  },
  @{
    title = "Compile final report and submission zip"
    milestone = 'M5 - Testing and final'
    labels = "type: docs,priority: P0"
    assignee = "buwaneka-halpage"
    body = @"
## Acceptance criteria
- [ ] Final report complete
- [ ] Product resources zip per department checklist
- [ ] All deliverables linked from README
"@
  }
)

foreach ($issue in $issues) {
  $mNum = $milestoneIds[$issue.milestone]
  $existing = gh issue list --repo $Repo --search "in:title `"$($issue.title)`"" --json number --jq ".[0].number" 2>$null
  if ($existing) {
    Write-Host "  Issue exists: $($issue.title) (#$existing)"
    continue
  }
  $url = gh issue create --repo $Repo `
    --title $issue.title `
    --body $issue.body `
    --label $issue.labels `
    --milestone $issue.milestone `
    --assignee $issue.assignee
  Write-Host "  Created: $url"
}

Write-Host "Done."
