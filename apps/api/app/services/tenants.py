import asyncpg

from app.schemas.admin import Tenant, TenantList


class TenantService:
    def __init__(self, connection: asyncpg.Connection) -> None:
        self.connection = connection

    async def list(self, *, limit: int, offset: int) -> TenantList:
        rows = await self.connection.fetch(
            """
            select
              tenants.id,
              tenants.name,
              tenants.status,
              tenants.created_at,
              tenants.updated_at,
              coalesce(scan_totals.last_active_at, tenants.updated_at) as last_active_at,
              coalesce(member_totals.member_count, 0)::int as member_count,
              coalesce(product_totals.catalogue_coverage, 0)::int as catalogue_coverage,
              coalesce(scan_totals.scans_this_month, 0)::int as scans_this_month,
              coalesce(scan_totals.fresh_scans_this_month, 0)::int as fresh_scans_this_month,
              coalesce(scan_totals.medium_scans_this_month, 0)::int as medium_scans_this_month,
              coalesce(scan_totals.spoiled_scans_this_month, 0)::int as spoiled_scans_this_month,
              coalesce(alert_totals.active_alerts, 0)::int as active_alerts,
              primary_contact.display_name as primary_contact_name,
              primary_contact.email as primary_contact_email,
              count(*) over()::int as total
            from public.tenants
            left join lateral (
              select count(*)::int as member_count
              from public.users
              where users.tenant_id = tenants.id
            ) member_totals on true
            left join lateral (
              select count(*)::int as catalogue_coverage
              from public.products
              where products.tenant_id = tenants.id
            ) product_totals on true
            left join lateral (
              select
                max(scans.updated_at) as last_active_at,
                count(*) filter (
                  where scans.created_at >= date_trunc('month', now())
                )::int as scans_this_month,
                count(*) filter (
                  where scans.created_at >= date_trunc('month', now())
                    and scans.classification = 'fresh'
                )::int as fresh_scans_this_month,
                count(*) filter (
                  where scans.created_at >= date_trunc('month', now())
                    and scans.classification = 'medium'
                )::int as medium_scans_this_month,
                count(*) filter (
                  where scans.created_at >= date_trunc('month', now())
                    and scans.classification = 'spoiled'
                )::int as spoiled_scans_this_month
              from public.scans
              where scans.tenant_id = tenants.id
            ) scan_totals on true
            left join lateral (
              select count(*)::int as active_alerts
              from public.alerts
              where alerts.tenant_id = tenants.id
            ) alert_totals on true
            left join lateral (
              select users.display_name, users.email
              from public.users
              where users.tenant_id = tenants.id
                and users.role = 'vendor'
              order by users.created_at
              limit 1
            ) primary_contact on true
            order by tenants.created_at desc
            limit $1 offset $2
            """,
            limit,
            offset,
        )
        items = [Tenant.model_validate(dict(row)) for row in rows]
        total = int(rows[0]["total"]) if rows else 0
        return TenantList(items=items, total=total, limit=limit, offset=offset)
