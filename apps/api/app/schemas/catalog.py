from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.scans import Classification


class ProductSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    low_stock_threshold: int


class ProductList(BaseModel):
    items: list[ProductSummary]


class BatchSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    product_id: UUID
    intake_date: datetime
    quantity_remaining: int
    product_name: str
    quantity_received: int
    current_freshness: Classification | None = None
    fresh_to_medium_at: datetime | None = None
    medium_to_spoiled_at: datetime | None = None


class BatchList(BaseModel):
    items: list[BatchSummary]
