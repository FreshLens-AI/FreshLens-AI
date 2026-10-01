from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.database import get_admin_connection, get_public_connection
from app.dependencies.auth import require_platform_admin
from app.schemas.applications import (
    TenantApplication,
    TenantApplicationCreate,
    TenantApplicationList,
    TenantApplicationReview,
    TenantApplicationStatus,
    TenantApplicationSubmitted,
)
from app.schemas.auth import AuthPrincipal
from app.services.applications import (
    ApplicationNotFoundError,
    ApplicationStateError,
    TenantApplicationService,
)
from app.services.tenant_invites import InviteError, SupabaseInviter, get_inviter

router = APIRouter(prefix="/api/v1", tags=["Tenant applications"])


@router.post(
    "/tenant-applications",
    response_model=TenantApplicationSubmitted,
    status_code=status.HTTP_202_ACCEPTED,
)
async def submit_tenant_application(
    values: TenantApplicationCreate,
    connection: asyncpg.Connection = Depends(get_public_connection),
) -> TenantApplicationSubmitted:
    return await TenantApplicationService(connection).submit(values)


@router.get(
    "/admin/tenant-applications", response_model=TenantApplicationList,
)
async def list_tenant_applications(
    _principal: AuthPrincipal = Depends(require_platform_admin),
    connection: asyncpg.Connection = Depends(get_admin_connection),
    application_status: TenantApplicationStatus | None = Query(None, alias="status"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> TenantApplicationList:
    return await TenantApplicationService(connection).list(
        status=application_status.value if application_status else None,
        limit=limit, offset=offset,
    )


@router.post(
    "/admin/tenant-applications/{application_id}/approve",
    response_model=TenantApplication,
)
async def approve_tenant_application(
    application_id: UUID,
    review: TenantApplicationReview,
    principal: AuthPrincipal = Depends(require_platform_admin),
    connection: asyncpg.Connection = Depends(get_admin_connection),
    inviter: SupabaseInviter = Depends(get_inviter),
) -> TenantApplication:
    try:
        return await TenantApplicationService(connection).approve(
            application_id, principal.user_id, review, inviter,
        )
    except ApplicationNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Application not found.") from exc
    except ApplicationStateError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    except InviteError as exc:
        raise HTTPException(exc.status_code, str(exc)) from exc


@router.post(
    "/admin/tenant-applications/{application_id}/reject",
    response_model=TenantApplication,
)
async def reject_tenant_application(
    application_id: UUID,
    review: TenantApplicationReview,
    principal: AuthPrincipal = Depends(require_platform_admin),
    connection: asyncpg.Connection = Depends(get_admin_connection),
) -> TenantApplication:
    try:
        return await TenantApplicationService(connection).reject(
            application_id, principal.user_id, review,
        )
    except ApplicationNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Application not found.") from exc
    except ApplicationStateError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
