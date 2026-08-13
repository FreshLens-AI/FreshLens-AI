from datetime import datetime
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ScanStatus(StrEnum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class Classification(StrEnum):
    FRESH = "fresh"
    MEDIUM = "medium"
    SPOILED = "spoiled"


class ScanAccepted(BaseModel):
    id: UUID
    status: ScanStatus
    created_at: datetime


class Scan(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    status: ScanStatus
    image_path: str
    quantity: int
    classification: Classification | None = None
    freshness_score: float | None = None
    model_version: str | None = None
    product_id: UUID | None = None
    batch_id: UUID | None = None
    created_at: datetime
    updated_at: datetime


class ScanList(BaseModel):
    items: list[Scan]
    total: int
    limit: int
    offset: int
