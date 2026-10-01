from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Literal

from app.schemas.alerts import AlertSeverity, AlertType
from app.schemas.scans import ScanStatus

AccessStatus = Literal["active", "inactive"]


class Tenant(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    status: str = "active"
    created_at: datetime
    updated_at: datetime | None = None
    last_active_at: datetime | None = None
    primary_contact_name: str | None = None
    primary_contact_email: str | None = None
    member_count: int = 0
    catalogue_coverage: int = 0
    scans_this_month: int = 0
    fresh_scans_this_month: int = 0
    medium_scans_this_month: int = 0
    spoiled_scans_this_month: int = 0
    active_alerts: int = 0


class TenantList(BaseModel):
    items: list[Tenant]
    total: int
    limit: int
    offset: int


class TenantCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    vendor_name: str = Field(min_length=1, max_length=120)
    vendor_email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$", max_length=254)

    @field_validator("name", "vendor_name", "vendor_email")
    @classmethod
    def normalize(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Value must not be blank")
        return normalized


class TenantCreated(BaseModel):
    id: UUID
    name: str
    vendor_email: str
    invitation_sent: bool


class TenantUserCreate(BaseModel):
    display_name: str = Field(min_length=1, max_length=120)
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$", max_length=254)

    @field_validator("display_name", "email")
    @classmethod
    def normalize(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Value must not be blank")
        return normalized


class TenantUser(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    display_name: str
    email: str
    status: AccessStatus
    created_at: datetime
    updated_at: datetime


class TenantUserCreated(TenantUser):
    invitation_sent: bool


class TenantUserList(BaseModel):
    items: list[TenantUser]
    total: int


class AccessStatusUpdate(BaseModel):
    status: AccessStatus


class TenantStatusUpdateResult(BaseModel):
    id: UUID
    status: AccessStatus
    updated_at: datetime


class AdminProduct(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    shelf_life_days: int
    fresh_to_medium_days: int | None = None
    medium_to_spoiled_days: int | None = None
    low_stock_threshold: int
    created_at: datetime
    updated_at: datetime
    scans_this_month: int = 0


class AdminProductList(BaseModel):
    items: list[AdminProduct]
    total: int
    limit: int
    offset: int


ProductCategory = Literal["banana", "cucumber", "eggplant", "tomato"]


class CategoryShelfLife(BaseModel):
    category: ProductCategory
    fresh_to_medium_days: int | None
    medium_to_spoiled_days: int | None
    updated_at: datetime


class CategoryShelfLifeUpdate(BaseModel):
    fresh_to_medium_days: int = Field(ge=1, le=3650)
    medium_to_spoiled_days: int = Field(ge=1, le=3650)


class AdminAlert(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    tenant_name: str
    type: AlertType
    severity: AlertSeverity
    message: str
    product_id: UUID | None = None
    product_name: str | None = None
    created_at: datetime


class AdminAlertList(BaseModel):
    items: list[AdminAlert]
    total: int
    limit: int
    offset: int


class AdminTrendPoint(BaseModel):
    date: date
    scans: int
    fresh: int
    medium: int
    spoiled: int


class AdminPipelineTotal(BaseModel):
    status: ScanStatus
    count: int


class AdminAnalytics(BaseModel):
    days: int
    tenant_id: UUID | None = None
    trend: list[AdminTrendPoint]
    pipeline: list[AdminPipelineTotal]


class AdminOverview(BaseModel):
    total_tenants: int
    active_tenants: int
    total_products: int
    active_alerts: int
    critical_alerts: int
    affected_tenants: int
    monthly_scans: int
    monthly_fresh: int
    monthly_medium: int
    monthly_spoiled: int
