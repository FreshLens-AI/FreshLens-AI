import asyncpg

from app.schemas.tenant import TenantOverview


class TenantWorkspaceService:
    def __init__(self, connection: asyncpg.Connection) -> None:
        self.connection = connection

    async def overview(self) -> TenantOverview:
        row = await self.connection.fetchrow(
            """select
                tenants.name as tenant_name, tenants.status as tenant_status,
                (select count(*)::int from public.users) as team_members,
                (select count(*)::int from public.products) as catalogue_products,
                (select count(*)::int from public.batches
                  where quantity_remaining > 0) as active_batches,
                (select coalesce(sum(quantity_remaining), 0)::int
                  from public.batches) as units_in_stock,
                (select count(*)::int from public.alerts
                  where read_at is null) as active_alerts,
                count(scans.id) filter (
                  where scans.created_at >= date_trunc('month', now()))::int
                  as scans_this_month,
                count(scans.id) filter (where scans.created_at >= date_trunc('month', now())
                  and scans.classification = 'fresh')::int as fresh_scans_this_month,
                count(scans.id) filter (where scans.created_at >= date_trunc('month', now())
                  and scans.classification = 'medium')::int as medium_scans_this_month,
                count(scans.id) filter (where scans.created_at >= date_trunc('month', now())
                  and scans.classification = 'spoiled')::int as spoiled_scans_this_month
              from public.tenants left join public.scans on true
              group by tenants.id"""
        )
        return TenantOverview.model_validate(dict(row))
