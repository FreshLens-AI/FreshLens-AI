from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class AppRole(StrEnum):
    VENDOR = "vendor"
    PLATFORM_ADMIN = "platform_admin"


class AuthPrincipal(BaseModel):
    model_config = ConfigDict(frozen=True)

    user_id: UUID
    role: AppRole
    tenant_id: UUID | None = None
    email: str | None = None
    session_id: UUID | None = None


class CurrentUserResponse(BaseModel):
    user_id: UUID
    role: AppRole
    tenant_id: UUID | None
    email: str | None
