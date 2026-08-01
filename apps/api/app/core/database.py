from collections.abc import AsyncIterator

import asyncpg
from fastapi import Depends

from app.core.config import get_settings
from app.dependencies.auth import require_vendor
from app.schemas.auth import AuthPrincipal

FRESHLENS_API_ROLE = "freshlens_api"


class UnsafeDatabaseRoleError(RuntimeError):
    """The configured database login can bypass FreshLens tenant isolation."""


async def connect_database() -> asyncpg.Connection:
    """Open a connection compatible with direct and Supavisor transaction modes."""

    settings = get_settings()
    return await asyncpg.connect(
        settings.database_url,
        ssl=settings.database_ssl_mode,
        statement_cache_size=0,
    )


async def assert_safe_database_role(connection: asyncpg.Connection) -> None:
    """Require a non-privileged login in the FreshLens API role group."""

    role = await connection.fetchrow(
        """
        select
          actor.rolname as role_name,
          actor.rolsuper as is_superuser,
          actor.rolbypassrls as bypasses_rls,
          exists (
            select 1
            from pg_roles required_role
            where required_role.rolname = $1
              and pg_has_role(actor.oid, required_role.oid, 'member')
          ) as is_freshlens_api
        from pg_roles actor
        where actor.rolname = current_user
        """,
        FRESHLENS_API_ROLE,
    )
    if role is None:
        raise UnsafeDatabaseRoleError("Could not inspect the database login role.")
    if role["is_superuser"] or role["bypasses_rls"]:
        raise UnsafeDatabaseRoleError(
            "DATABASE_URL must not use a superuser or BYPASSRLS role."
        )
    if not role["is_freshlens_api"]:
        raise UnsafeDatabaseRoleError(
            f"Database role {role['role_name']!r} is not a member of "
            f"{FRESHLENS_API_ROLE!r}."
        )


async def apply_tenant_context(
    connection: asyncpg.Connection,
    principal: AuthPrincipal,
) -> None:
    """Set transaction-local identity values used by PostgreSQL RLS policies."""

    if principal.tenant_id is None:
        raise ValueError("Tenant database access requires a vendor tenant.")
    await connection.execute(
        "select set_config('app.tenant_id', $1, true)",
        str(principal.tenant_id),
    )
    await connection.execute(
        "select set_config('app.user_id', $1, true)",
        str(principal.user_id),
    )
    await connection.execute(
        "select set_config('app.user_role', $1, true)",
        principal.role.value,
    )


async def get_tenant_connection(
    principal: AuthPrincipal = Depends(require_vendor),
) -> AsyncIterator[asyncpg.Connection]:
    """Yield one transaction whose RLS tenant came only from the verified JWT."""

    connection = await connect_database()
    try:
        await assert_safe_database_role(connection)
        transaction = connection.transaction()
        await transaction.start()
        try:
            await apply_tenant_context(connection, principal)
            yield connection
        except BaseException:
            await transaction.rollback()
            raise
        else:
            await transaction.commit()
    finally:
        await connection.close()
