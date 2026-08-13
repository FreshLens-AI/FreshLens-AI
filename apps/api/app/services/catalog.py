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

    async def list(self, *, limit: int, offset: int) -> AlertList:
        rows = await self.connection.fetch(
            """
            select
              id,
              type::text as type,
              message,
              severity::text as severity,
              created_at,
              batch_id,
              product_id,
              count(*) over()::int as total
            from public.alerts
            order by created_at desc
            limit $1 offset $2
            """,
            limit,
            offset,
        )
        items = [
            Alert.model_validate({key: row[key] for key in Alert.model_fields})
            for row in rows
        ]
        total = int(rows[0]["total"]) if rows else 0
        return AlertList(items=items, total=total, limit=limit, offset=offset)
