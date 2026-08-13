import asyncpg
from fastapi import APIRouter, Depends, Query

from app.core.database import get_admin_connection
from app.dependencies.auth import require_platform_admin
from app.schemas.admin import TenantList
from app.schemas.auth import AuthPrincipal
from app.services.tenants import TenantService

router = APIRouter(prefix="/api/v1/admin", tags=["Admin"])


@router.get("/tenants", response_model=TenantList)
async def list_tenants(
    _principal: AuthPrincipal = Depends(require_platform_admin),
    connection: asyncpg.Connection = Depends(get_admin_connection),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> TenantList:
    return await TenantService(connection).list(limit=limit, offset=offset)
