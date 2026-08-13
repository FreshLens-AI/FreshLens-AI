from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.auth import SupabaseJWTVerifier
from app.core.config import get_settings
from app.middleware.auth import SupabaseAuthMiddleware
from app.routers import admin, alerts, auth, catalog, health, sales, scans

settings = get_settings()

app = FastAPI(
    title="FreshLens API",
    version="0.1.0",
    description="Multi-tenant produce freshness API (CS3203 · Group 21 · PID 5)",
)

app.state.auth_verifier = SupabaseJWTVerifier(settings)
app.add_middleware(SupabaseAuthMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.allowed_cors_origins),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Idempotency-Key"],
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(scans.router)
app.include_router(catalog.router)
app.include_router(sales.router)
app.include_router(alerts.router)
app.include_router(admin.router)


@app.get("/")
async def root() -> dict[str, str]:
    return {"service": "freshlens-api", "docs": "/docs"}
