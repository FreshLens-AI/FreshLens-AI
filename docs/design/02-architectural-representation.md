# 2. Architectural representation

FreshLens uses Kruchten's 4+1 view model plus an explicit Data View. Multiple views are required because the same system must answer different questions: what functions matter architecturally, how code is packaged, how processes run concurrently, where artifacts deploy, how source maps to images, and how tenant data is stored under RLS.

## 2.1 Views used

| View | SAD section | Shows for FreshLens |
|---|---|---|
| Use-Case (+1) | Section 4 | Architecturally significant vendor and admin scenarios, including scan and sale flows |
| Logical | Section 5 | Layers, packages, significant classes, provided/required interfaces |
| Process | Section 6 | API vs Celery concurrency, scan lifecycle, alert push, sale transactions |
| Deployment / Physical | Section 7 | Current Compose scaffold and target V1 nodes |
| Implementation / Development | Section 8 | Monorepo paths, dependency rules, build artifacts |
| Data | Section 9 | Entities, keys, cardinalities, RLS, sale invariants |

Process View is required because inference and notification run outside the API request. Data View is required because tenant isolation is a database policy, not only an application filter.

## 2.2 Current versus target baseline

Baseline: `main` commit `a460540`.

| Area | Current scaffold | Target V1 |
|---|---|---|
| `apps/api` | Health endpoints only | Auth, scans, sales, products/batches list, admin tenants |
| `apps/mobile` | Default Expo screen | Camera, scan, manual sale, later voice sale, alerts |
| `apps/web` | Empty path | Admin catalogue, tenants, analytics |
| `packages/ml` | Empty path | Celery worker, stub then FL-2TC |
| `infra/db` | Empty migrations | Tenant tables + RLS, including sales |
| Compose | `api`, `postgres`, `redis`; worker commented | Adds worker; API uses DB/Redis/R2 |

## 2.3 Cross-view mapping

| Logical package | Process | Deploy node (target) | Source path | Key requirements |
|---|---|---|---|---|
| Vendor mobile | Expo app process | Vendor phone | `apps/mobile` | FR-V-*, IR-UI-001 |
| Admin web | Browser / Next.js | Admin workstation | `apps/web` | FR-A-* |
| FastAPI application | API process | `api` container | `apps/api` | FR-S-001, FR-S-014, NFR-SEC-* |
| Celery worker / FL-2TC | Worker process | `worker` container | `packages/ml` | FR-S-007, FR-S-008 |
| PostgreSQL + RLS | Database process | `postgres` | `infra/db` | DR-*, NFR-SEC-003 |
| Redis | Broker process | `redis` | Compose | IR-SW-005, NFR-SEC-006 |
| Object storage | External service | Cloudflare R2 | config | IR-SW-003 |
| LLM sale parser | External call from API | Provider endpoint | API adapter | FR-S-015, NFR-SEC-007 |

## 2.4 High-level architecture figure

Figure 2.1 shows the target V1 component topology: clients, IdP, API, async worker path, persistence, push delivery, and the draft-only LLM path used for final voice sales.

![Figure 2.1. FreshLens V1 high-level architecture (target)](diagrams/fig-2-1-high-level-architecture.png)

*Figure 2.1. Target V1 high-level architecture. Dotted IdP edges: (1) client sign-in to Supabase Auth, (2) JWT issued back to the client. Solid green: clients present `Authorization: Bearer` to FastAPI (IdP is not on the business request path). FastAPI owns route dispatch after JWT validation; no API gateway product in V1. Dashed edges are Celery/Redis queue or push delivery. The LLM is called only by the API adapter (voice-draft) and has no client or database edge.*

## 2.5 Architectural styles (summary)

Figure 2.1 realizes a **layered multi-tenant SaaS**: client–server HTTPS to a **modular monolith** (FastAPI), with a **brokered async worker** (Redis + Celery) for inference, and **externalized identity** (Supabase Auth as IdP). The synchronous path is Presentation → Application → Persistence; Inference is an async peer of Application, not a strict interlayer. Sales and reads stay request–response; classification and push are asynchronous. Section 5.4 evaluates layered-style constraints and lists patterns. V1 does not use a microservice mesh, a dedicated API-gateway product, event sourcing, or CQRS.
