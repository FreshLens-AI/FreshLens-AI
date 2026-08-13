from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Header, HTTPException, status

from app.core.database import get_tenant_connection
from app.dependencies.auth import require_vendor
from app.schemas.auth import AuthPrincipal
from app.schemas.sales import CreateSaleRequest, Sale
from app.services.sales import (
    IdempotencyConflictError,
    InsufficientStockError,
    SalesService,
    SaleValidationError,
)

router = APIRouter(prefix="/api/v1/sales", tags=["Sales"])


@router.post("", status_code=status.HTTP_201_CREATED, response_model=Sale)
async def create_sale(
    request: CreateSaleRequest,
    idempotency_key: Annotated[
        str, Header(alias="Idempotency-Key", min_length=1, max_length=255)
    ],
    principal: AuthPrincipal = Depends(require_vendor),
    connection: asyncpg.Connection = Depends(get_tenant_connection),
) -> Sale:
    if principal.tenant_id is None:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Vendor account has no tenant context."
        )
    if not idempotency_key.strip():
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "Idempotency-Key is required."
        )
    try:
        return await SalesService(connection).create(
            tenant_id=principal.tenant_id,
            user_id=principal.user_id,
            idempotency_key=idempotency_key.strip(),
            request=request,
        )
    except InsufficientStockError as exc:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Sale would make batch stock negative.",
        ) from exc
    except IdempotencyConflictError as exc:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Idempotency-Key was already used with a different payload.",
        ) from exc
    except SaleValidationError as exc:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, exc.detail
        ) from exc
