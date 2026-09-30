import json
from typing import Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.core.auth_hook import (
    HookConfigurationError,
    HookSignatureError,
    verify_hook_signature,
)
from app.core.config import get_settings
from app.core.database import get_auth_hook_connection

router = APIRouter(prefix="/api/v1/auth/hooks", tags=["Auth"])


async def verified_hook_event(request: Request) -> dict[str, Any]:
    """Return the Supabase hook payload only after its signature checks out."""

    body = await request.body()
    try:
        verify_hook_signature(
            secret=get_settings().supabase_auth_hook_secret,
            webhook_id=request.headers.get("webhook-id"),
            timestamp=request.headers.get("webhook-timestamp"),
            signature_header=request.headers.get("webhook-signature"),
            body=body,
        )
    except HookConfigurationError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc
    except HookSignatureError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, str(exc)) from exc

    try:
        event = json.loads(body)
        claims = event["claims"]
        user_id = UUID(str(event["user_id"]))
    except (ValueError, KeyError, TypeError) as exc:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Invalid access-token hook payload."
        ) from exc
    if not isinstance(claims, dict) or str(claims.get("sub")) != str(user_id):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Hook claims do not match the user."
        )
    return {"user_id": str(user_id), "claims": claims}


@router.post("/access-token")
async def access_token_hook(
    # Declared first so the signature is checked before a DB connection opens.
    event: dict[str, Any] = Depends(verified_hook_event),
    connection: asyncpg.Connection = Depends(get_auth_hook_connection),
) -> dict[str, Any]:
    """Supabase custom access-token hook: FreshLens claims from the app DB."""

    resolved = await connection.fetchval(
        "select public.resolve_access_token_claims($1::jsonb)",
        json.dumps(event),
    )
    return {"claims": json.loads(resolved)["claims"]}
