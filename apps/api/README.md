# FreshLens API

FastAPI backend for FreshLens. Async scan inference only — CNN runs in Celery (`packages/ml`), never in request handlers.

Contract: [`docs/api/v1/openapi.yaml`](../../docs/api/v1/openapi.yaml).

## Local run (without Docker)

```bash
cp .env.example .env        # from the repository root; fill in SUPABASE_URL
cd apps/api
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- Health: [http://localhost:8000/health](http://localhost:8000/health)
- Swagger: [http://localhost:8000/docs](http://localhost:8000/docs)

Every `/api/v1/*` route requires a Supabase access token. Verify a configured
session with:

```bash
curl http://localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

The middleware verifies the JWT against Supabase JWKS and exposes only the
signed `app_role` and `tenant_id` as request context. Vendor database work must
use `get_tenant_connection`, which opens the query transaction and sets its
transaction-local PostgreSQL RLS context on that same connection.

## Docker Compose

From repo root (starts Postgres, Redis, and API):

```bash
cp .env.example .env   # once
docker compose -f infra/docker/docker-compose.yml up --build api
```

API listens on **http://localhost:8000**.

On a fresh local database volume, Compose applies the auth migration and creates
the RLS-constrained `freshlens_api_local` login used by the API. To point the API
container at hosted Supabase instead, set `COMPOSE_DATABASE_URL` to a restricted
session-pooler URI and `COMPOSE_DATABASE_SSL_MODE=require`. Never use the
Supabase `postgres` owner or service-role identity for business queries. See the
database and account setup guide below.

## Tests

```bash
cd apps/api
pip install -r requirements.txt
pytest
```

## Layout

```
app/
  main.py           FastAPI app
  core/             Settings, JWT validation, and tenant DB transaction
  middleware/       Bearer authentication for versioned routes
  dependencies/     Current-user and exact-role guards
  routers/          Health and authenticated identity routes
tests/
```

Supabase project setup and account provisioning are documented in
[`../../docs/authentication.md`](../../docs/authentication.md).
