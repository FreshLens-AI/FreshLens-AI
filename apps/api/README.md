# FreshLens API

FastAPI backend for FreshLens. Async scan inference only — CNN runs in Celery (`packages/ml`), never in request handlers.

Contract: [`docs/api/v1/openapi.yaml`](../../docs/api/v1/openapi.yaml).

## Local run (without Docker)

```bash
cd apps/api
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- Health: [http://localhost:8000/health](http://localhost:8000/health)
- Swagger: [http://localhost:8000/docs](http://localhost:8000/docs)

## Docker Compose

From repo root (starts Postgres, Redis, and API):

```bash
cp .env.example .env   # once
docker compose -f infra/docker/docker-compose.yml up --build api
```

API listens on **http://localhost:8000**.

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
  core/config.py    Settings from env
  routers/          Route modules (health first; scans/auth later)
tests/
```
