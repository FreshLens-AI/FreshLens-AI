from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class Tenant(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    created_at: datetime


class TenantList(BaseModel):
    items: list[Tenant]
    total: int
    limit: int
    offset: int
