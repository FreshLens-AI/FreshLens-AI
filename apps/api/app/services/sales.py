from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import asyncpg

from app.schemas.sales import CreateSaleRequest, Sale, SaleItem, SaleItemInput, SaleSource


class InsufficientStockError(Exception):
    """A locked batch cannot cover the requested quantity."""


class IdempotencyConflictError(Exception):
    """The idempotency key was reused with a different payload."""


class SaleValidationError(Exception):
    def __init__(self, detail: str) -> None:
        super().__init__(detail)
        self.detail = detail


class SalesService:
    """Only component allowed to deduct `batches.quantity_remaining`."""

    def __init__(self, connection: asyncpg.Connection) -> None:
        self.connection = connection

    async def create(
        self,
        *,
        tenant_id: UUID,
        user_id: UUID,
        idempotency_key: str,
        request: CreateSaleRequest,
    ) -> Sale:
        existing = await self._load_by_idempotency_key(idempotency_key)
        if existing is not None:
            if self._payload_matches(existing, request):
                return existing
            raise IdempotencyConflictError()

        locked = await self._lock_batches(request.items)
        remaining = {
            batch_id: int(row["quantity_remaining"]) for batch_id, row in locked.items()
        }
        lines: list[tuple[SaleItemInput, dict[str, object], int]] = []
        for item in request.items:
            batch = locked[item.batch_id]
            if batch["product_id"] != item.product_id:
                raise SaleValidationError(
                    "Each item's product_id must match the selected batch."
                )
            if remaining[item.batch_id] < item.quantity_sold:
                raise InsufficientStockError()
            remaining[item.batch_id] -= item.quantity_sold
            lines.append((item, batch, remaining[item.batch_id]))

        try:
            sale_row = await self._insert_sale(
                tenant_id=tenant_id,
                user_id=user_id,
                source=request.source,
                idempotency_key=idempotency_key,
            )
        except asyncpg.UniqueViolationError:
            raced = await self._load_by_idempotency_key(idempotency_key)
            if raced is not None and self._payload_matches(raced, request):
                return raced
            raise IdempotencyConflictError() from None
        except asyncpg.ForeignKeyViolationError as exc:
            raise SaleValidationError(
                "Vendor user is not provisioned in the application database."
            ) from exc

        sale_items: list[SaleItem] = []
        for item, batch, quantity_remaining in lines:
            item_row = await self.connection.fetchrow(
                """
                insert into public.sale_items (
                  id, tenant_id, sale_id, product_id, batch_id, quantity_sold
                )
                values ($1, $2, $3, $4, $5, $6)
                returning id
                """,
                uuid4(),
                tenant_id,
                sale_row["id"],
                item.product_id,
                item.batch_id,
                item.quantity_sold,
            )
            await self.connection.execute(
                """
                update public.batches
                set quantity_remaining = $2, updated_at = now()
                where id = $1
                """,
                item.batch_id,
                quantity_remaining,
            )
            await self._evaluate_alerts(
                tenant_id=tenant_id,
                batch=batch,
                quantity_remaining=quantity_remaining,
            )
            sale_items.append(
                SaleItem(
                    id=item_row["id"],
                    product_id=item.product_id,
                    batch_id=item.batch_id,
                    quantity_sold=item.quantity_sold,
                    quantity_remaining=quantity_remaining,
                )
            )

        return Sale(
            id=sale_row["id"],
            source=request.source,
            items=sale_items,
            created_at=sale_row["created_at"],
        )

    async def _load_by_idempotency_key(self, idempotency_key: str) -> Sale | None:
        sale_row = await self.connection.fetchrow(
            """
            select id, source::text as source, created_at
            from public.sales
            where idempotency_key = $1
            """,
            idempotency_key,
        )
        if sale_row is None:
            return None
        item_rows = await self.connection.fetch(
            """
            select
              si.id,
              si.product_id,
              si.batch_id,
              si.quantity_sold,
              b.quantity_remaining
            from public.sale_items as si
            join public.batches as b on b.id = si.batch_id
            where si.sale_id = $1
            order by si.created_at
            """,
            sale_row["id"],
        )
        return Sale(
            id=sale_row["id"],
            source=SaleSource(sale_row["source"]),
            created_at=sale_row["created_at"],
            items=[SaleItem.model_validate(dict(row)) for row in item_rows],
        )

    async def _lock_batches(
        self, items: list[SaleItemInput]
    ) -> dict[UUID, dict[str, object]]:
        locked: dict[UUID, dict[str, object]] = {}
        for batch_id in sorted({item.batch_id for item in items}):
            row = await self.connection.fetchrow(
                """
                select
                  b.id,
                  b.product_id,
                  b.quantity_remaining,
                  b.intake_date,
                  p.name,
                  p.low_stock_threshold,
                  p.shelf_life_days
                from public.batches as b
                join public.products as p
                  on p.id = b.product_id
                 and p.tenant_id = b.tenant_id
                where b.id = $1
                for update of b
                """,
                batch_id,
            )
            if row is None:
                raise SaleValidationError("Selected batch was not found for this tenant.")
            locked[batch_id] = dict(row)
        return locked

    async def _insert_sale(
        self,
        *,
        tenant_id: UUID,
        user_id: UUID,
        source: SaleSource,
        idempotency_key: str,
    ) -> dict[str, object]:
        row = await self.connection.fetchrow(
            """
            insert into public.sales (
              id, tenant_id, created_by, source, idempotency_key
            )
            values ($1, $2, $3, $4::public.sale_source, $5)
            returning id, created_at
            """,
            uuid4(),
            tenant_id,
            user_id,
            source.value,
            idempotency_key,
        )
        return dict(row)

    async def _evaluate_alerts(
        self,
        *,
        tenant_id: UUID,
        batch: dict[str, object],
        quantity_remaining: int,
    ) -> None:
        product_id = batch["product_id"]
        batch_id = batch["id"]
        name = str(batch["name"])
        threshold = int(batch["low_stock_threshold"])
        if quantity_remaining <= threshold:
            severity = "critical" if quantity_remaining == 0 else "warning"
            await self._insert_alert_once(
                tenant_id=tenant_id,
                alert_type="low_stock",
                severity=severity,
                message=(
                    f"{name} is at or below the low-stock threshold "
                    f"({quantity_remaining} remaining, threshold {threshold})."
                ),
                product_id=product_id,
                batch_id=batch_id,
            )

        intake = batch["intake_date"]
        shelf_life_days = int(batch["shelf_life_days"])
        if isinstance(intake, datetime):
            expiry = intake + timedelta(days=shelf_life_days)
            now = datetime.now(UTC) if intake.tzinfo else datetime.now()
            if expiry <= now:
                await self._insert_alert_once(
                    tenant_id=tenant_id,
                    alert_type="aging",
                    severity="warning",
                    message=(
                        f"{name} has passed its {shelf_life_days}-day shelf life."
                    ),
                    product_id=product_id,
                    batch_id=batch_id,
                )

    async def _insert_alert_once(
        self,
        *,
        tenant_id: UUID,
        alert_type: str,
        severity: str,
        message: str,
        product_id: UUID,
        batch_id: UUID,
    ) -> None:
        exists = await self.connection.fetchrow(
            """
            select 1
            from public.alerts
            where type = $1::public.alert_type
              and product_id = $2
              and batch_id = $3
            limit 1
            """,
            alert_type,
            product_id,
            batch_id,
        )
        if exists is not None:
            return
        await self.connection.execute(
            """
            insert into public.alerts (
              tenant_id, type, severity, message, product_id, batch_id
            )
            values (
              $1,
              $2::public.alert_type,
              $3::public.alert_severity,
              $4,
              $5,
              $6
            )
            """,
            tenant_id,
            alert_type,
            severity,
            message,
            product_id,
            batch_id,
        )

    @staticmethod
    def _payload_matches(existing: Sale, request: CreateSaleRequest) -> bool:
        if existing.source != request.source:
            return False
        existing_lines = [
            (item.product_id, item.batch_id, item.quantity_sold)
            for item in existing.items
        ]
        requested_lines = [
            (item.product_id, item.batch_id, item.quantity_sold)
            for item in request.items
        ]
        return existing_lines == requested_lines
