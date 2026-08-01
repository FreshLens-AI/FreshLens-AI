from __future__ import annotations

from collections.abc import Awaitable, Callable
from contextvars import ContextVar

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.auth import (
    AuthConfigurationError,
    AuthenticationError,
    AuthenticationServiceUnavailableError,
    AuthorizationContextError,
    JWTVerifier,
    principal_from_claims,
)
from app.schemas.auth import AuthPrincipal

current_principal: ContextVar[AuthPrincipal | None] = ContextVar(
    "current_principal",
    default=None,
)


def _bearer_token(request: Request) -> str | None:
    authorization = request.headers.get("Authorization", "")
    scheme, _, credentials = authorization.partition(" ")
    if scheme.lower() != "bearer" or not credentials.strip():
        return None
    return credentials.strip()


class SupabaseAuthMiddleware(BaseHTTPMiddleware):
    """Authenticate all versioned API routes and attach trusted request context."""

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        if not request.url.path.startswith("/api/v1"):
            return await call_next(request)
        if request.method == "OPTIONS":
            return await call_next(request)

        token = _bearer_token(request)
        if token is None:
            return JSONResponse(
                {"detail": "Missing Bearer access token."},
                status_code=401,
                headers={"WWW-Authenticate": "Bearer"},
            )

        verifier: JWTVerifier = request.app.state.auth_verifier
        try:
            claims = await verifier.verify(token)
            principal = principal_from_claims(claims)
        except AuthenticationError:
            return JSONResponse(
                {"detail": "Invalid or expired access token."},
                status_code=401,
                headers={"WWW-Authenticate": "Bearer"},
            )
        except AuthenticationServiceUnavailableError:
            return JSONResponse(
                {"detail": "Authentication service is temporarily unavailable."},
                status_code=503,
            )
        except AuthorizationContextError as exc:
            return JSONResponse({"detail": str(exc)}, status_code=403)
        except AuthConfigurationError:
            return JSONResponse(
                {"detail": "Authentication service is not configured."},
                status_code=503,
            )

        request.state.auth = principal
        request.state.tenant_id = principal.tenant_id
        context_token = current_principal.set(principal)
        try:
            return await call_next(request)
        finally:
            current_principal.reset(context_token)
