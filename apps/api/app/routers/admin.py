from uuid import UUID
from typing import Literal

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.database import get_admin_connection
from app.dependencies.auth import require_platform_admin
from app.schemas.admin import (
    AdminAlertList,
    AdminAnalytics,
    AdminOverview,
    AdminProductList,
    AccessStatusUpdate,
    CategoryShelfLife,
    CategoryShelfLifeUpdate,
    ProductCategory,
    TenantCreate,
    TenantCreated,
    TenantList,
    TenantStatusUpdateResult,
    TenantUser,
    TenantUserCreate,
    TenantUserCreated,
    TenantUserList,
)
from app.schemas.auth import AuthPrincipal
from app.schemas.alerts import AlertSeverity, AlertType
from app.services.admin import (
    AdminAlertService,
    AdminAnalyticsService,
    AdminProductService,
    CategoryShelfLifeService,
    AdminOverviewService,
)
from app.services.tenants import (
    TenantNotFoundError,
    TenantService,
    TenantUserNotFoundError,
)
from app.services.tenant_invites import InviteError, SupabaseInviter, get_inviter

router = APIRouter(prefix="/api/v1/admin", tags=["Admin"])


@router.get("/shelf-life-rules", response_model=list[CategoryShelfLife])
async def list_shelf_life_rules(
    _principal: AuthPrincipal = Depends(require_platform_admin),
    connection: asyncpg.Connection = Depends(get_admin_connection),
) -> list[CategoryShelfLife]:
    return await CategoryShelfLifeService(connection).list()


@router.put("/shelf-life-rules/{category}", response_model=CategoryShelfLife)
async def update_shelf_life_rule(
    category: ProductCategory,
    values: CategoryShelfLifeUpdate,
    _principal: AuthPrincipal = Depends(require_platform_admin),
    connection: asyncpg.Connection = Depends(get_admin_connection),
) -> CategoryShelfLife:
    return await CategoryShelfLifeService(connection).update(category, values)


@router.post("/tenants", response_model=TenantCreated, status_code=status.HTTP_201_CREATED)
async def create_tenant(
    values: TenantCreate,
    _principal: AuthPrincipal = Depends(require_platform_admin),
    connection: asyncpg.Connection = Depends(get_admin_connection),
    inviter: SupabaseInviter = Depends(get_inviter),
) -> TenantCreated:
    try:
        return await TenantService(connection).create(values, inviter)
    except InviteError as exc:
        raise HTTPException(exc.status_code, str(exc)) from exc


@router.get("/tenants", response_model=TenantList)
async def list_tenants(
    _principal: AuthPrincipal = Depends(require_platform_admin),
    connection: asyncpg.Connection = Depends(get_admin_connection),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    search: str = Query("", max_length=100),
    status: Literal["active", "inactive"] | None = None,
    tenant_id: UUID | None = None,
) -> TenantList:
    return await TenantService(connection).list(
        limit=limit, offset=offset, search=search.strip(),
        status=status, tenant_id=tenant_id,
    )


@router.post(
    "/tenants/{tenant_id}/users",
    response_model=TenantUserCreated,
    status_code=status.HTTP_201_CREATED,
)
async def create_tenant_user(
    tenant_id: UUID,
    values: TenantUserCreate,
    _principal: AuthPrincipal = Depends(require_platform_admin),
    connection: asyncpg.Connection = Depends(get_admin_connection),
    inviter: SupabaseInviter = Depends(get_inviter),
) -> TenantUserCreated:
    try:
        return await TenantService(connection).create_user(tenant_id, values, inviter)
    except TenantNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tenant not found.") from exc
    except InviteError as exc:
        raise HTTPException(exc.status_code, str(exc)) from exc


@router.get("/tenants/{tenant_id}/users", response_model=TenantUserList)
async def list_tenant_users(
    tenant_id: UUID,
    _principal: AuthPrincipal = Depends(require_platform_admin),
    connection: asyncpg.Connection = Depends(get_admin_connection),
) -> TenantUserList:
    try:
        return await TenantService(connection).list_users(tenant_id)
    except TenantNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tenant not found.") from exc


@router.patch(
    "/tenants/{tenant_id}/status", response_model=TenantStatusUpdateResult,
)
async def update_tenant_status(
    tenant_id: UUID,
    values: AccessStatusUpdate,
    _principal: AuthPrincipal = Depends(require_platform_admin),
    connection: asyncpg.Connection = Depends(get_admin_connection),
) -> TenantStatusUpdateResult:
    try:
        return await TenantService(connection).update_status(tenant_id, values.status)
    except TenantNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tenant not found.") from exc


@router.patch(
    "/tenants/{tenant_id}/users/{user_id}/status", response_model=TenantUser,
)
async def update_tenant_user_status(
    tenant_id: UUID,
    user_id: UUID,
    values: AccessStatusUpdate,
    _principal: AuthPrincipal = Depends(require_platform_admin),
    connection: asyncpg.Connection = Depends(get_admin_connection),
) -> TenantUser:
    try:
        return await TenantService(connection).update_user_status(
            tenant_id, user_id, values.status,
        )
    except TenantUserNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tenant user not found.") from exc


@router.get("/products", response_model=AdminProductList)
async def list_products(
    _principal: AuthPrincipal = Depends(require_platform_admin),
    connection: asyncpg.Connection = Depends(get_admin_connection),
    limit: int = Query(100, ge=1, le=100),
    offset: int = Query(0, ge=0),
    search: str = Query("", max_length=100),
    tenant_id: UUID | None = None,
    product_id: UUID | None = None,
) -> AdminProductList:
    return await AdminProductService(connection).list(
        limit=limit, offset=offset, search=search.strip(),
        tenant_id=tenant_id, product_id=product_id,
    )


@router.get("/alerts", response_model=AdminAlertList)
async def list_alerts(
    _principal: AuthPrincipal = Depends(require_platform_admin),
    connection: asyncpg.Connection = Depends(get_admin_connection),
    limit: int = Query(100, ge=1, le=100),
    offset: int = Query(0, ge=0),
    search: str = Query("", max_length=100),
    alert_type: AlertType | None = None,
    severity: AlertSeverity | None = None,
) -> AdminAlertList:
    return await AdminAlertService(connection).list(
        limit=limit, offset=offset, search=search.strip(),
        alert_type=alert_type.value if alert_type else None,
        severity=severity.value if severity else None,
    )


@router.get("/overview", response_model=AdminOverview)
async def get_overview(
    _principal: AuthPrincipal = Depends(require_platform_admin),
    connection: asyncpg.Connection = Depends(get_admin_connection),
) -> AdminOverview:
    return await AdminOverviewService(connection).get()


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
