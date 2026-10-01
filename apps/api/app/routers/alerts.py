from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.database import get_tenant_connection
from app.dependencies.auth import require_tenant_member
from app.schemas.alerts import Alert, AlertList
from app.schemas.auth import AuthPrincipal
from app.services.catalog import AlertService

router = APIRouter(prefix="/api/v1/alerts", tags=["Alerts"])


@router.get("", response_model=AlertList)
async def list_alerts(
    _principal: AuthPrincipal = Depends(require_tenant_member),
    connection: asyncpg.Connection = Depends(get_tenant_connection),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    active_only: bool = Query(True),
) -> AlertList:
    return await AlertService(connection).list(
        limit=limit, offset=offset, active_only=active_only
    )


@router.patch("/{alert_id}/read", response_model=Alert)
async def mark_alert_read(
    alert_id: UUID,
    _principal: AuthPrincipal = Depends(require_tenant_member),
    connection: asyncpg.Connection = Depends(get_tenant_connection),
) -> Alert:
    alert = await AlertService(connection).mark_read(alert_id)
    if alert is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Alert not found.")
    return alert
