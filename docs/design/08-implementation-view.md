# 8. Implementation View

This view maps source organization to build and deployment artifacts and states the dependency rules that keep layers honest.

## 8.1 Monorepo layout

| Path | Artifact | Deploys to |
|---|---|---|
| `apps/api/` | FastAPI Python package / container image | `api` |
| `apps/web/` | Next.js application | Admin hosting / local Node |
| `apps/mobile/` | Expo / React Native app | Vendor devices |
| `packages/ml/` | Celery worker + classifier code | `worker` |
| `infra/db/migrations/` | SQL migrations with RLS | Applied to PostgreSQL |
| `infra/docker/` | Compose and Dockerfiles | Local and demo stacks |
| `docs/api/v1/openapi.yaml` | HTTP contract | Consumed by clients and API tests |
| `docs/design/` | SAD sources and diagrams | Documentation only |

![Figure 8.1. Implementation package dependencies](diagrams/fig-8-1-package-dependencies.png)

*Figure 8.1. Allowed package dependencies. Clients depend on the API contract. API depends on DB, Redis, and R2 adapters. Worker depends on Redis, DB, R2, and classifier code. The LLM adapter is reachable only from the API voice-draft path.*

## 8.2 Dependency rules

These rules enforce the relaxed layered style of Section 5.4: Presentation → Application → Persistence, with Inference as an async peer.

1. Clients call only the FastAPI HTTPS API (plus Supabase Auth and device OS services). They never open PostgreSQL or Redis (no layer skip from Presentation to Persistence).
2. The API never imports or invokes the CNN inline. It publishes jobs only (Application does not embed Inference).
3. `packages/ml` may write scan results and alerts but must not expose HTTP (Inference is not above Application).
4. `VoiceSaleParser` cannot call persistence services. Draft responses are ephemeral API responses.
5. Only `SalesService` in `apps/api` deducts `quantity_remaining`.
6. Redis keys are namespaced `tenant:{tenant_id}:...`.
7. Migrations that add tenant-scoped tables include RLS in the same change.
8. Application and Inference may both use Persistence/infrastructure (open layering). Inference must not call Presentation APIs for business logic; push is wake-up only.

![Figure 8.2. Source to deployment artifact mapping](diagrams/fig-8-2-artifact-mapping.png)

*Figure 8.2. Source trees map to container images, mobile binaries, web bundles, and applied migrations.*

## 8.3 Build and CI expectations

GitHub Actions runs lint and tests per area before merge. Docker Compose builds API (and later worker) images from the monorepo. Mobile and web use their own package managers under `apps/mobile` and `apps/web`. Course demos may run the full Compose target with stub ML before FL-2TC weights are available.
