from fastapi import APIRouter
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = Field(pattern="^ok$")


router = APIRouter(tags=["Health"])


@router.get("/health", response_model=HealthResponse)
async def get_health() -> HealthResponse:
    """Liveness probe — public, no auth (see docs/api/v1/openapi.yaml)."""
    return HealthResponse(status="ok")
