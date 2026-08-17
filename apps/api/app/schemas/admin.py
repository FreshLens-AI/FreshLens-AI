from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.alerts import AlertSeverity, AlertType
from app.schemas.scans import ScanStatus


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


class AdminProduct(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    tenant_name: str
    name: str
    shelf_life_days: int
    low_stock_threshold: int
    created_at: datetime
    updated_at: datetime
    scans_this_month: int = 0


class AdminProductList(BaseModel):
    items: list[AdminProduct]
    total: int
    limit: int
    offset: int


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
