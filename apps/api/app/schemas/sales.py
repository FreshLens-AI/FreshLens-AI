from datetime import datetime
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class SaleSource(StrEnum):
    MANUAL = "manual"
    VOICE = "voice"


class SaleItemInput(BaseModel):
    product_id: UUID
    batch_id: UUID
    quantity_sold: int = Field(ge=1)


class CreateSaleRequest(BaseModel):
    source: SaleSource
    items: list[SaleItemInput] = Field(min_length=1)


class SaleItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    product_id: UUID
    batch_id: UUID
    quantity_sold: int
    quantity_remaining: int


class Sale(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    source: SaleSource
    items: list[SaleItem]
    created_at: datetime
