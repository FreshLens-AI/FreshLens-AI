from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, Query

from app.core.database import get_admin_connection
from app.dependencies.auth import require_platform_admin
from app.schemas.admin import (
    AdminAlertList,
    AdminAnalytics,
    AdminProductList,
    TenantList,
)
from app.schemas.auth import AuthPrincipal
from app.services.admin import (
    AdminAlertService,
    AdminAnalyticsService,
    AdminProductService,
)
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


@router.get("/products", response_model=AdminProductList)
async def list_products(
    _principal: AuthPrincipal = Depends(require_platform_admin),
    connection: asyncpg.Connection = Depends(get_admin_connection),
    limit: int = Query(100, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> AdminProductList:
    return await AdminProductService(connection).list(limit=limit, offset=offset)


@router.get("/alerts", response_model=AdminAlertList)
async def list_alerts(
    _principal: AuthPrincipal = Depends(require_platform_admin),
    connection: asyncpg.Connection = Depends(get_admin_connection),
    limit: int = Query(100, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> AdminAlertList:
    return await AdminAlertService(connection).list(limit=limit, offset=offset)


@router.get("/analytics", response_model=AdminAnalytics)
async def get_analytics(
    _principal: AuthPrincipal = Depends(require_platform_admin),
    connection: asyncpg.Connection = Depends(get_admin_connection),
    days: int = Query(90, ge=1, le=90),
    tenant_id: UUID | None = None,
) -> AdminAnalytics:
    return await AdminAnalyticsService(connection).get(
        days=days,
        tenant_id=tenant_id,
    )
