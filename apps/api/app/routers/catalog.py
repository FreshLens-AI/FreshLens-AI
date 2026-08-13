from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends

from app.core.database import get_tenant_connection
from app.dependencies.auth import require_vendor
from app.schemas.auth import AuthPrincipal
from app.schemas.catalog import BatchList, ProductList
from app.services.catalog import CatalogService

router = APIRouter(prefix="/api/v1", tags=["Products"])


@router.get("/products", response_model=ProductList)
async def list_products(
    _principal: AuthPrincipal = Depends(require_vendor),
    connection: asyncpg.Connection = Depends(get_tenant_connection),
) -> ProductList:
    return await CatalogService(connection).list_products()


@router.get("/batches", response_model=BatchList, tags=["Batches"])
async def list_batches(
    _principal: AuthPrincipal = Depends(require_vendor),
    connection: asyncpg.Connection = Depends(get_tenant_connection),
    product_id: UUID | None = None,
    active_only: bool = True,
) -> BatchList:
    return await CatalogService(connection).list_batches(
        product_id=product_id, active_only=active_only
    )
