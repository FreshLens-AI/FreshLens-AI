from pydantic import BaseModel


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
