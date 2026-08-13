from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


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


class BatchList(BaseModel):
    items: list[BatchSummary]
