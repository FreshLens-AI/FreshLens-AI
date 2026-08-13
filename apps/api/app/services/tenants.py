import asyncpg

from app.schemas.admin import Tenant, TenantList


class TenantService:
    def __init__(self, connection: asyncpg.Connection) -> None:
        self.connection = connection

    async def list(self, *, limit: int, offset: int) -> TenantList:
        rows = await self.connection.fetch(
            """
            select id, name, created_at, count(*) over()::int as total
            from public.tenants
            order by created_at desc
            limit $1 offset $2
            """,
            limit,
            offset,
        )
        items = [
            Tenant.model_validate({k: row[k] for k in Tenant.model_fields}) for row in rows
        ]
        total = int(rows[0]["total"]) if rows else 0
        return TenantList(items=items, total=total, limit=limit, offset=offset)
