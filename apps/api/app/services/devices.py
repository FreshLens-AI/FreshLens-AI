from uuid import UUID

import asyncpg

from app.schemas.devices import Device, DevicePlatform


class DeviceService:
    """Push-token registration (FR-V-001); rows are tenant-scoped by RLS."""

    def __init__(self, connection: asyncpg.Connection) -> None:
        self.connection = connection

    async def register(
        self,
        *,
        tenant_id: UUID,
        user_id: UUID,
        token: str,
        platform: DevicePlatform,
    ) -> Device:
        row = await self.connection.fetchrow(
            """
            insert into public.device_tokens (tenant_id, user_id, token, platform)
            values ($1, $2, $3, $4)
            on conflict (tenant_id, token) do update
              set user_id = excluded.user_id,
                  platform = excluded.platform,
                  active = true,
                  updated_at = now()
            returning id, platform, active, updated_at
            """,
            tenant_id,
            user_id,
            token,
            platform.value,
        )
        return Device.model_validate(dict(row))
