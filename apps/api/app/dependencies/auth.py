from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, HTTPException, Request, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.schemas.auth import AppRole, AuthPrincipal

bearer_auth = HTTPBearer(
    auto_error=False,
    bearerFormat="JWT",
    description="Supabase Auth access token.",
    scheme_name="bearerAuth",
)


def _principal_from_request(request: Request) -> AuthPrincipal:
    principal = getattr(request.state, "auth", None)
    if not isinstance(principal, AuthPrincipal):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return principal


def get_current_principal(
    request: Request,
    _credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Security(bearer_auth),
    ],
) -> AuthPrincipal:
    return _principal_from_request(request)


def require_role(role: AppRole) -> Callable[..., AuthPrincipal]:
    def dependency(
        principal: Annotated[AuthPrincipal, Depends(get_current_principal)],
    ) -> AuthPrincipal:
        if principal.role != role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This endpoint requires the {role.value} role.",
            )
        return principal

    return dependency


require_vendor = require_role(AppRole.VENDOR)
require_platform_admin = require_role(AppRole.PLATFORM_ADMIN)
