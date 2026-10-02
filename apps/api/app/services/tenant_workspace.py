import asyncpg

from app.schemas.tenant import SalesDay, SalesHistory, SalesHistoryItem, TenantOverview


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


    async def sales(self, *, days: int, limit: int, offset: int) -> SalesHistory:
        total = await self.connection.fetchval("select count(*) from public.sale_items")
        rows = await self.connection.fetch(
            """select i.id, s.id as sale_id, i.batch_id, p.name as product_name,
                u.display_name as seller, s.source, i.quantity_sold, s.created_at
              from public.sale_items i
              join public.sales s on s.id = i.sale_id and s.tenant_id = i.tenant_id
              join public.products p on p.id = i.product_id
              join public.users u on u.id = s.created_by and u.tenant_id = s.tenant_id
              order by s.created_at desc, s.id, i.id limit $1 offset $2""",
            limit, offset,
        )
        trend = await self.connection.fetch(
            """with dates as (
                select (now() at time zone 'Asia/Colombo')::date - $1::int + 1 + i as date
                from generate_series(0, $1::int - 1) i
              ) select d.date, count(distinct s.id)::int as transactions,
                coalesce(sum(i.quantity_sold), 0)::bigint as units
              from dates d left join public.sales s
                on s.created_at >= (d.date::timestamp at time zone 'Asia/Colombo')
                and s.created_at < ((d.date + 1)::timestamp at time zone 'Asia/Colombo')
              left join public.sale_items i on i.sale_id = s.id and i.tenant_id = s.tenant_id
              group by d.date order by d.date""",
            days,
        )
        return SalesHistory(
            items=[SalesHistoryItem.model_validate(dict(row)) for row in rows],
            trend=[SalesDay.model_validate(dict(row)) for row in trend],
            total=total, days=days, limit=limit, offset=offset,
        )
