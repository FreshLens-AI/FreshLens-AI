from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Header, HTTPException, status

from app.core.config import get_settings
from app.core.database import get_tenant_connection, tenant_transaction
from app.core.rate_limit import TenantRateLimiter, get_rate_limiter
from app.dependencies.auth import require_tenant_member
from app.schemas.auth import AuthPrincipal
from app.schemas.sales import (
    CreateSaleRequest,
    Sale,
    VoiceSaleDraft,
    VoiceSaleDraftRequest,
)
from app.services.sales import (
    IdempotencyConflictError,
    InsufficientStockError,
    SalesService,
    SaleValidationError,
)
from app.services.voice_draft import (
    ProductCandidate,
    SaleDraftParser,
    VoiceParserUnavailableError,
    create_voice_draft,
    get_voice_parser,
    list_sellable_products,
)

router = APIRouter(prefix="/api/v1/sales", tags=["Sales"])


@router.post("", status_code=status.HTTP_201_CREATED, response_model=Sale)
async def create_sale(
    request: CreateSaleRequest,
    idempotency_key: Annotated[
        str, Header(alias="Idempotency-Key", min_length=1, max_length=255)
    ],
    principal: AuthPrincipal = Depends(require_tenant_member),
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


async def get_sellable_products(
    principal: AuthPrincipal = Depends(require_tenant_member),
) -> list[ProductCandidate]:
    # Short transaction: the pool connection is released before the LLM call.
    async with tenant_transaction(principal) as connection:
        return await list_sellable_products(connection)


@router.post("/voice-draft", response_model=VoiceSaleDraft)
async def create_voice_sale_draft(
    request: VoiceSaleDraftRequest,
    principal: AuthPrincipal = Depends(require_tenant_member),
    limiter: TenantRateLimiter = Depends(get_rate_limiter),
    parser: SaleDraftParser | None = Depends(get_voice_parser),
    products: list[ProductCandidate] = Depends(get_sellable_products),
) -> VoiceSaleDraft:
    """Untrusted, non-mutating draft; stock only changes via POST /sales."""

    if principal.tenant_id is None:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Vendor account has no tenant context."
        )
    limit = get_settings().voice_draft_rate_limit_per_minute
    if not await limiter.allow(principal.tenant_id, "voice-draft", limit):
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Too many voice drafts. Try again in a minute.",
            headers={"Retry-After": "60"},
        )
    try:
        return await create_voice_draft(parser, request.transcript, products)
    except VoiceParserUnavailableError as exc:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Voice parsing is unavailable. Enter the sale manually.",
        ) from exc
