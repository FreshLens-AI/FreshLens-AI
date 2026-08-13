import asyncpg
from fastapi import APIRouter, Depends, Query

from app.core.database import get_tenant_connection
from app.dependencies.auth import require_vendor
from app.schemas.alerts import AlertList
from app.schemas.auth import AuthPrincipal
from app.services.catalog import AlertService

router = APIRouter(prefix="/api/v1/alerts", tags=["Alerts"])


@router.get("", response_model=AlertList)
async def list_alerts(
    _principal: AuthPrincipal = Depends(require_vendor),
    connection: asyncpg.Connection = Depends(get_tenant_connection),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> AlertList:
    return await AlertService(connection).list(limit=limit, offset=offset)
