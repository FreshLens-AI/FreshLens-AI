from fastapi import APIRouter, Depends

from app.dependencies.auth import get_current_principal
from app.schemas.auth import AuthPrincipal, CurrentUserResponse

router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])


@router.get("/me", response_model=CurrentUserResponse)
async def get_current_user(
    principal: AuthPrincipal = Depends(get_current_principal),
) -> CurrentUserResponse:
    return CurrentUserResponse(
        user_id=principal.user_id,
        role=principal.role,
        tenant_id=principal.tenant_id,
        email=principal.email,
    )
