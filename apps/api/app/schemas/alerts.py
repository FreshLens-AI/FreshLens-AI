from datetime import datetime
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class AlertType(StrEnum):
    SPOILAGE = "spoilage"
    LOW_STOCK = "low_stock"
    AGING = "aging"
    OTHER = "other"


class AlertSeverity(StrEnum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class Alert(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    type: AlertType
    message: str
    severity: AlertSeverity
    created_at: datetime
    batch_id: UUID | None = None
    product_id: UUID | None = None


class AlertList(BaseModel):
    items: list[Alert]
    total: int
    limit: int
    offset: int
