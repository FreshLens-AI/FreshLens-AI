from fastapi import FastAPI

from app.routers import health

app = FastAPI(
    title="FreshLens API",
    version="0.1.0",
    description="Multi-tenant produce freshness API (CS3203 · Group 21 · PID 5)",
)

app.include_router(health.router)


@app.get("/")
async def root() -> dict[str, str]:
    return {"service": "freshlens-api", "docs": "/docs"}
