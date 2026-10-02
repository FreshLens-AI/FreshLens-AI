from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.database import get_tenant_connection
from app.dependencies.auth import require_tenant_admin
from app.schemas.admin import (
    AccessStatusUpdate,
    AdminAnalytics,
    TenantUser,
    TenantUserCreate,
    TenantUserCreated,
    TenantUserList,
)
from app.schemas.auth import AuthPrincipal
from app.schemas.tenant import SalesHistory, TenantOverview
from app.services.admin import AdminAnalyticsService
from app.services.tenant_invites import InviteError, SupabaseInviter, get_inviter
from app.services.tenants import TenantService, TenantUserNotFoundError
from app.services.tenant_workspace import TenantWorkspaceService

router = APIRouter(prefix="/api/v1/tenant", tags=["Tenant workspace"])


@router.get("/overview", response_model=TenantOverview)
async def get_tenant_overview(
    _principal: AuthPrincipal = Depends(require_tenant_admin),
    connection: asyncpg.Connection = Depends(get_tenant_connection),
) -> TenantOverview:
    return await TenantWorkspaceService(connection).overview()


@router.get("/analytics", response_model=AdminAnalytics)
async def get_tenant_analytics(
    principal: AuthPrincipal = Depends(require_tenant_admin),
    connection: asyncpg.Connection = Depends(get_tenant_connection),
    days: int = Query(30, ge=1, le=90),
) -> AdminAnalytics:
    return await AdminAnalyticsService(connection).get(
        days=days, tenant_id=principal.tenant_id,
    )


@router.get("/users", response_model=TenantUserList)
async def list_tenant_users(
    principal: AuthPrincipal = Depends(require_tenant_admin),
    connection: asyncpg.Connection = Depends(get_tenant_connection),
) -> TenantUserList:
    return await TenantService(connection).list_users(principal.tenant_id)


@router.post(
    "/users", response_model=TenantUserCreated,
    status_code=status.HTTP_201_CREATED,
)
async def create_tenant_user(
    values: TenantUserCreate,
    principal: AuthPrincipal = Depends(require_tenant_admin),
    connection: asyncpg.Connection = Depends(get_tenant_connection),
    inviter: SupabaseInviter = Depends(get_inviter),
) -> TenantUserCreated:
    try:
        return await TenantService(connection).create_user(
            principal.tenant_id, values, inviter,
        )
    except InviteError as exc:
        raise HTTPException(exc.status_code, str(exc)) from exc


@router.patch("/users/{user_id}/status", response_model=TenantUser)
async def update_tenant_user_status(
    user_id: UUID,
    values: AccessStatusUpdate,
    principal: AuthPrincipal = Depends(require_tenant_admin),
    connection: asyncpg.Connection = Depends(get_tenant_connection),
) -> TenantUser:
    try:
        return await TenantService(connection).update_user_status(
            principal.tenant_id, user_id, values.status,
        )
    except TenantUserNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tenant user not found.") from exc


@router.get("/sales", response_model=SalesHistory)
async def get_tenant_sales(
    _principal: AuthPrincipal = Depends(require_tenant_admin),
    connection: asyncpg.Connection = Depends(get_tenant_connection),
    days: int = Query(30, ge=1, le=90),
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> SalesHistory:
    return await TenantWorkspaceService(connection).sales(days=days, limit=limit, offset=offset)
