from typing import Annotated
from uuid import UUID, uuid4

import asyncpg
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status

from app.core.database import get_tenant_connection
from app.core.jobs import ClassificationJobPublisher, get_publisher
from app.core.storage import ObjectStorageClient, get_storage
from app.dependencies.auth import require_vendor
from app.schemas.auth import AuthPrincipal
from app.schemas.scans import Scan, ScanAccepted, ScanList
from app.services.scans import ScanService

router = APIRouter(prefix="/api/v1/scans", tags=["Scans"])

_LIMIT = Query(20, ge=1, le=100)
_OFFSET = Query(0, ge=0)


def _suffix(filename: str | None) -> str:
    if filename and filename.lower().endswith(".png"):
        return ".png"
    return ".jpg"


@router.post("", status_code=status.HTTP_202_ACCEPTED, response_model=ScanAccepted)
async def create_scan(
    image: Annotated[UploadFile, File()],
    quantity: Annotated[int, Form(ge=1)],
    principal: AuthPrincipal = Depends(require_vendor),
    connection: asyncpg.Connection = Depends(get_tenant_connection),
    storage: ObjectStorageClient = Depends(get_storage),
    jobs: ClassificationJobPublisher = Depends(get_publisher),
    product_id: Annotated[UUID | None, Form()] = None,
    batch_id: Annotated[UUID | None, Form()] = None,
) -> ScanAccepted:
    if principal.tenant_id is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Vendor account has no tenant context.")
    tenant_id = principal.tenant_id
    data = await image.read()
    scan_id = uuid4()
    try:
        image_path = storage.put(
            tenant_id,
            scan_id,
            data,
            _suffix(image.filename),
        )
    except ValueError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc

    service = ScanService(connection)
    try:
        scan = await service.create_pending(
            scan_id=scan_id,
            tenant_id=tenant_id,
            image_path=image_path,
            quantity=quantity,
            product_id=product_id,
            batch_id=batch_id,
        )
    except asyncpg.ForeignKeyViolationError as exc:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Referenced product, batch, or tenant was not found.",
        ) from exc

    try:
        jobs.publish(tenant_id, scan.id, scan.image_path)
    except Exception as exc:
        await service.mark_failed(scan.id)
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Failed to enqueue classification job.",
        ) from exc

    return ScanAccepted(id=scan.id, status=scan.status, created_at=scan.created_at)


@router.get("", response_model=ScanList)
async def list_scans(
    _principal: AuthPrincipal = Depends(require_vendor),
    connection: asyncpg.Connection = Depends(get_tenant_connection),
    limit: int = _LIMIT,
    offset: int = _OFFSET,
) -> ScanList:
    return await ScanService(connection).list(limit=limit, offset=offset)


@router.get("/{scan_id}", response_model=Scan)
async def get_scan(
    scan_id: UUID,
    _principal: AuthPrincipal = Depends(require_vendor),
    connection: asyncpg.Connection = Depends(get_tenant_connection),
) -> Scan:
    scan = await ScanService(connection).get(scan_id)
    if scan is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Scan not found.")
    return scan
