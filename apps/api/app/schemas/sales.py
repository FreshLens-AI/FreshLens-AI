from datetime import datetime
from enum import StrEnum
from typing import Literal
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


class VoiceSaleDraftRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    transcript: str = Field(min_length=1, max_length=2000)


class VoiceSaleDraftItem(BaseModel):
    spoken_product: str = Field(min_length=1)
    quantity_sold: int = Field(ge=1)
    matched_product_id: UUID | None = None
    confidence: float | None = Field(default=None, ge=0, le=1)
    ambiguity: str | None = None


class VoiceSaleDraft(BaseModel):
    """Untrusted draft. Never changes stock; the vendor confirms via POST /sales."""

    items: list[VoiceSaleDraftItem]
    requires_confirmation: Literal[True] = True
    warnings: list[str] = Field(default_factory=list)
