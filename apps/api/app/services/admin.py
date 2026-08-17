from uuid import UUID

import asyncpg

from app.schemas.admin import (
    AdminAlert,
    AdminAlertList,
    AdminAnalytics,
    AdminPipelineTotal,
    AdminProduct,
    AdminProductList,
    AdminTrendPoint,
)
from app.schemas.scans import ScanStatus


class AdminProductService:
    def __init__(self, connection: asyncpg.Connection) -> None:
        self.connection = connection

    async def list(self, *, limit: int, offset: int) -> AdminProductList:
        rows = await self.connection.fetch(
            """
            select
              products.id,
              products.tenant_id,
              tenants.name as tenant_name,
              products.name,
              products.shelf_life_days,
              products.low_stock_threshold,
              products.created_at,
              products.updated_at,
              (
                select count(*)::int
                from public.scans
                where scans.product_id = products.id
                  and scans.created_at >= date_trunc('month', now())
              ) as scans_this_month,
              count(*) over()::int as total
            from public.products
            join public.tenants on tenants.id = products.tenant_id
            order by products.updated_at desc, products.name
            limit $1 offset $2
            """,
            limit,
            offset,
        )
        return AdminProductList(
            items=[AdminProduct.model_validate(dict(row)) for row in rows],
            total=int(rows[0]["total"]) if rows else 0,
            limit=limit,
            offset=offset,
        )


class AdminAlertService:
    def __init__(self, connection: asyncpg.Connection) -> None:
        self.connection = connection

    async def list(self, *, limit: int, offset: int) -> AdminAlertList:
        rows = await self.connection.fetch(
            """
            select
              alerts.id,
              alerts.tenant_id,
              tenants.name as tenant_name,
              alerts.type::text as type,
              alerts.severity::text as severity,
              alerts.message,
              alerts.product_id,
              products.name as product_name,
              alerts.created_at,
              count(*) over()::int as total
            from public.alerts
            join public.tenants on tenants.id = alerts.tenant_id
            left join public.products on products.id = alerts.product_id
            order by alerts.created_at desc
            limit $1 offset $2
            """,
            limit,
            offset,
        )
        return AdminAlertList(
            items=[AdminAlert.model_validate(dict(row)) for row in rows],
            total=int(rows[0]["total"]) if rows else 0,
            limit=limit,
            offset=offset,
        )


class AdminAnalyticsService:
    def __init__(self, connection: asyncpg.Connection) -> None:
        self.connection = connection

    async def get(self, *, days: int, tenant_id: UUID | None) -> AdminAnalytics:
        trend_rows = await self.connection.fetch(
            """
            with date_range as (
              select generate_series(
                current_date - (($1::int - 1) * interval '1 day'),
                current_date,
                interval '1 day'
              )::date as date
            )
            select
              date_range.date,
              count(scans.id)::int as scans,
              count(scans.id) filter (where scans.classification = 'fresh')::int as fresh,
              count(scans.id) filter (where scans.classification = 'medium')::int as medium,
              count(scans.id) filter (where scans.classification = 'spoiled')::int as spoiled
            from date_range
            left join public.scans
              on scans.created_at >= date_range.date
             and scans.created_at < date_range.date + interval '1 day'
             and ($2::uuid is null or scans.tenant_id = $2)
            group by date_range.date
            order by date_range.date
            """,
            days,
            tenant_id,
        )
        pipeline_rows = await self.connection.fetch(
            """
            select status::text as status, count(*)::int as count
            from public.scans
            where ($1::uuid is null or tenant_id = $1)
            group by status
            """,
            tenant_id,
        )
        totals = {str(row["status"]): int(row["count"]) for row in pipeline_rows}
        pipeline = [
            AdminPipelineTotal(status=status, count=totals.get(status.value, 0))
            for status in ScanStatus
        ]
        return AdminAnalytics(
            days=days,
            tenant_id=tenant_id,
            trend=[AdminTrendPoint.model_validate(dict(row)) for row in trend_rows],
            pipeline=pipeline,
        )
