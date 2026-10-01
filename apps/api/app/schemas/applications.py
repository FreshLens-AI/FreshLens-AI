from datetime import datetime
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class TenantApplicationStatus(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class TenantApplicationCreate(BaseModel):
    organization_name: str = Field(min_length=2, max_length=120)
    applicant_name: str = Field(min_length=2, max_length=120)
    applicant_email: str = Field(
        pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$", max_length=254
    )
    phone: str | None = Field(default=None, min_length=5, max_length=40)

    @field_validator("organization_name", "applicant_name", "applicant_email", "phone")
    @classmethod
    def normalize(cls, value: str | None) -> str | None:
        return value.strip() if value is not None else None


class TenantApplicationSubmitted(BaseModel):
    id: UUID
    status: TenantApplicationStatus = TenantApplicationStatus.PENDING
    message: str = "Application received for platform review."


class TenantApplication(BaseModel):
    id: UUID
    organization_name: str
    applicant_name: str
    applicant_email: str
    phone: str | None
    status: TenantApplicationStatus
    review_note: str | None
    reviewed_by: UUID | None
    approved_tenant_id: UUID | None
    approved_user_id: UUID | None
    submitted_at: datetime
    reviewed_at: datetime | None
    updated_at: datetime


class TenantApplicationList(BaseModel):
    items: list[TenantApplication]
    total: int
    limit: int
    offset: int


class TenantApplicationReview(BaseModel):
    note: str | None = Field(default=None, max_length=1000)

    @field_validator("note")
    @classmethod
    def normalize_note(cls, value: str | None) -> str | None:
        return value.strip() or None if value is not None else None
