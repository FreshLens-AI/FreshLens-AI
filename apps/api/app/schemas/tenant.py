from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel
from app.schemas.sales import SaleSource


class TenantOverview(BaseModel):
    tenant_name: str
    tenant_status: str
    team_members: int
    catalogue_products: int
    active_batches: int
    units_in_stock: int
    active_alerts: int
    scans_this_month: int
    fresh_scans_this_month: int
    medium_scans_this_month: int
    spoiled_scans_this_month: int


class SalesDay(BaseModel):
    date: date
    transactions: int
    units: int


class SalesHistoryItem(BaseModel):
    id: UUID
    sale_id: UUID
    batch_id: UUID
    product_name: str
    seller: str
    source: SaleSource
    quantity_sold: int
    created_at: datetime


class SalesHistory(BaseModel):
    items: list[SalesHistoryItem]
    trend: list[SalesDay]
    total: int
    days: int
    limit: int
    offset: int
