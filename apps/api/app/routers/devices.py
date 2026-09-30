import asyncpg
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.database import get_tenant_connection
from app.dependencies.auth import require_vendor
from app.schemas.auth import AuthPrincipal
from app.schemas.devices import Device, RegisterDeviceRequest
from app.services.devices import DeviceService

router = APIRouter(prefix="/api/v1/devices", tags=["Devices"])


@router.post("", response_model=Device)
async def register_device(
    request: RegisterDeviceRequest,
    principal: AuthPrincipal = Depends(require_vendor),
    connection: asyncpg.Connection = Depends(get_tenant_connection),
) -> Device:
    if principal.tenant_id is None:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Vendor account has no tenant context."
        )
    return await DeviceService(connection).register(
        tenant_id=principal.tenant_id,
        user_id=principal.user_id,
        token=request.token,
        platform=request.platform,
    )
