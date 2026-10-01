from uuid import UUID

import asyncpg

from app.schemas.alerts import Alert, AlertList
from app.schemas.catalog import BatchList, BatchSummary, ProductList, ProductSummary


class CatalogService:
    def __init__(self, connection: asyncpg.Connection) -> None:
        self.connection = connection

    async def list_products(self) -> ProductList:
        rows = await self.connection.fetch(
            """
            select id, name, low_stock_threshold
            from public.products
            order by name
            """
        )
        return ProductList(
            items=[ProductSummary.model_validate(dict(row)) for row in rows]
        )

    async def list_batches(
        self, *, product_id: UUID | None, active_only: bool
    ) -> BatchList:
        rows = await self.connection.fetch(
            """
            select id, product_id, intake_date, quantity_remaining
            from public.batches
            where ($1::uuid is null or product_id = $1)
              and (not $2::boolean or quantity_remaining > 0)
            order by intake_date
            """,
            product_id,
            active_only,
        )
        return BatchList(items=[BatchSummary.model_validate(dict(row)) for row in rows])


class AlertService:
    def __init__(self, connection: asyncpg.Connection) -> None:
        self.connection = connection

    async def list(
        self, *, limit: int, offset: int, active_only: bool = True
    ) -> AlertList:
        rows = await self.connection.fetch(
            """
            select
              alerts.id,
              alerts.type::text as type,
              alerts.message,
              alerts.severity::text as severity,
              alerts.created_at,
              alerts.batch_id,
              alerts.product_id,
              alerts.event_key,
              products.name as product_name,
              batches.quantity_received,
              batches.quantity_remaining,
              alerts.transition_at,
              alerts.read_at,
              alerts.resolved_at,
              count(*) over()::int as total
            from public.alerts
            left join public.products
              on products.id = alerts.product_id
            left join public.batches
              on batches.id = alerts.batch_id
             and batches.tenant_id = alerts.tenant_id
            where (not $3::boolean or alerts.resolved_at is null)
            order by alerts.created_at desc
            limit $1 offset $2
            """,
            limit,
            offset,
            active_only,
        )
        items = [Alert.model_validate(dict(row)) for row in rows]
        total = int(rows[0]["total"]) if rows else 0
        return AlertList(items=items, total=total, limit=limit, offset=offset)

    async def mark_read(self, alert_id: UUID) -> Alert | None:
        row = await self.connection.fetchrow(
            """
            with updated as (
              update public.alerts
              set read_at = coalesce(read_at, now())
              where id = $1
              returning *
            )
            select
              updated.id,
              updated.type::text as type,
              updated.message,
              updated.severity::text as severity,
              updated.created_at,
              updated.batch_id,
              updated.product_id,
              updated.event_key,
              products.name as product_name,
              batches.quantity_received,
              batches.quantity_remaining,
              updated.transition_at,
              updated.read_at,
              updated.resolved_at
            from updated
            left join public.products
              on products.id = updated.product_id
            left join public.batches
              on batches.id = updated.batch_id
             and batches.tenant_id = updated.tenant_id
            """,
            alert_id,
        )
        return Alert.model_validate(dict(row)) if row is not None else None

    async def dismiss(self, alert_id: UUID) -> Alert | None:
        row = await self.connection.fetchrow(
            """
            with updated as (
              update public.alerts
              set read_at = coalesce(read_at, now()),
                  resolved_at = coalesce(resolved_at, now())
              where id = $1
              returning *
            )
            select
              updated.id,
              updated.type::text as type,
              updated.message,
              updated.severity::text as severity,
              updated.created_at,
              updated.batch_id,
              updated.product_id,
              updated.event_key,
              products.name as product_name,
              batches.quantity_received,
              batches.quantity_remaining,
              updated.transition_at,
              updated.read_at,
              updated.resolved_at
            from updated
            left join public.products
              on products.id = updated.product_id
            left join public.batches
              on batches.id = updated.batch_id
             and batches.tenant_id = updated.tenant_id
            """,
            alert_id,
        )
        return Alert.model_validate(dict(row)) if row is not None else None
