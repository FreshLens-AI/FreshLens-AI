from uuid import UUID

import asyncpg

from app.schemas.scans import Scan, ScanList

_SCAN_COLUMNS = """
    id,
    tenant_id,
    status::text as status,
    image_path,
    quantity,
    classification::text as classification,
    freshness_score,
    model_version,
    identity_label,
    identity_score,
    identity_model_version,
    product_id,
    batch_id,
    created_at,
    updated_at
"""


class ScanService:
    def __init__(self, connection: asyncpg.Connection) -> None:
        self.connection = connection

    async def create_pending(
        self,
        *,
        scan_id: UUID,
        tenant_id: UUID,
        image_path: str,
        quantity: int,
        product_id: UUID | None,
        batch_id: UUID | None,
    ) -> Scan:
        row = await self.connection.fetchrow(
            f"""
            insert into public.scans (
              id, tenant_id, image_path, quantity, status, product_id, batch_id
            )
            values ($1, $2, $3, $4, 'pending', $5, $6)
            returning {_SCAN_COLUMNS}
            """,
            scan_id,
            tenant_id,
            image_path,
            quantity,
            product_id,
            batch_id,
        )
        return Scan.model_validate(dict(row))

    async def mark_failed(self, scan_id: UUID) -> None:
        await self.connection.execute(
            """
            update public.scans
            set status = 'failed', updated_at = now()
            where id = $1
            """,
            scan_id,
        )

    async def get(self, scan_id: UUID) -> Scan | None:
        row = await self.connection.fetchrow(
            f"select {_SCAN_COLUMNS} from public.scans where id = $1",
            scan_id,
        )
        return Scan.model_validate(dict(row)) if row else None

    async def list(self, *, limit: int, offset: int) -> ScanList:
        rows = await self.connection.fetch(
            f"""
            select {_SCAN_COLUMNS}, count(*) over()::int as total
            from public.scans
            order by created_at desc
            limit $1 offset $2
            """,
            limit,
            offset,
        )
        items = [Scan.model_validate({k: row[k] for k in Scan.model_fields}) for row in rows]
        total = int(rows[0]["total"]) if rows else 0
        return ScanList(items=items, total=total, limit=limit, offset=offset)
