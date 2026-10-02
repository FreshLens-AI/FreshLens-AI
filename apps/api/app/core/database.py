from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import asyncpg
from fastapi import Depends, HTTPException, status

from app.core.config import get_settings
from app.dependencies.auth import require_platform_admin, require_tenant_member
from app.schemas.auth import AppRole, AuthPrincipal

FRESHLENS_API_ROLE = "freshlens_api"

_pool: asyncpg.Pool | None = None
_role_verified = False


class UnsafeDatabaseRoleError(RuntimeError):
    """The configured database login can bypass FreshLens tenant isolation."""


async def connect_database() -> asyncpg.Connection:
    """Open a one-off connection (tests / fallback without a pool)."""

    settings = get_settings()
    return await asyncpg.connect(
        settings.database_url,
        ssl=settings.database_ssl_mode,
        statement_cache_size=0,
    )


async def init_pool() -> None:
    """Create the shared pool and verify the login role once at startup."""

    global _pool, _role_verified
    if _pool is not None:
        return
    settings = get_settings()
    pool = await asyncpg.create_pool(
        settings.database_url,
        ssl=settings.database_ssl_mode,
        statement_cache_size=0,
        min_size=settings.database_pool_min_size,
        max_size=settings.database_pool_max_size,
    )
    try:
        async with pool.acquire() as connection:
            await assert_safe_database_role(connection)
    except Exception:
        await pool.close()
        raise
    _pool = pool
    _role_verified = True


async def close_pool() -> None:
    """Close the shared pool (FastAPI shutdown)."""

    global _pool, _role_verified
    if _pool is not None:
        await _pool.close()
        _pool = None
    _role_verified = False


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


async def ensure_safe_database_role(connection: asyncpg.Connection) -> None:
    """Run the role guard once per process after a successful pool check."""

    global _role_verified
    if _role_verified:
        return
    await assert_safe_database_role(connection)
    _role_verified = True


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


async def apply_admin_context(
    connection: asyncpg.Connection,
    principal: AuthPrincipal,
) -> None:
    """Set transaction-local platform-admin identity for admin RLS policies."""

    if principal.role != AppRole.PLATFORM_ADMIN:
        raise ValueError("Admin database access requires a platform admin.")
    await connection.execute(
        "select set_config('app.user_id', $1, true)",
        str(principal.user_id),
    )
    await connection.execute(
        "select set_config('app.user_role', $1, true)",
        principal.role.value,
    )


@asynccontextmanager
async def acquired_connection() -> AsyncIterator[asyncpg.Connection]:
    """Borrow from the pool, or open a one-off connection when none exists."""

    pool = _pool
    if pool is None:
        connection = await connect_database()
        try:
            yield connection
        finally:
            await connection.close()
        return

    async with pool.acquire() as connection:
        yield connection


async def get_auth_hook_connection() -> AsyncIterator[asyncpg.Connection]:
    """Yield a connection with no identity context for the access-token hook."""

    async with acquired_connection() as connection:
        await ensure_safe_database_role(connection)
        yield connection


async def get_public_connection() -> AsyncIterator[asyncpg.Connection]:
    """Yield a restricted transaction with no identity context."""

    async with acquired_connection() as connection:
        await ensure_safe_database_role(connection)
        async with connection.transaction():
            yield connection


@asynccontextmanager
async def tenant_transaction(
    principal: AuthPrincipal,
) -> AsyncIterator[asyncpg.Connection]:
    """One transaction whose RLS tenant came only from the verified JWT."""

    async with acquired_connection() as connection:
        await ensure_safe_database_role(connection)
        transaction = connection.transaction()
        await transaction.start()
        try:
            await apply_tenant_context(connection, principal)
            has_access = await connection.fetchval(
                "select public.current_vendor_has_access()"
            )
            if not has_access:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access to this tenant has been revoked.",
                )
            yield connection
        except BaseException:
            await transaction.rollback()
            raise
        else:
            await transaction.commit()


async def get_tenant_connection(
    principal: AuthPrincipal = Depends(require_tenant_member),
) -> AsyncIterator[asyncpg.Connection]:
    """Yield a tenant transaction that lasts for the whole request."""

    async with tenant_transaction(principal) as connection:
        yield connection


async def get_admin_connection(
    principal: AuthPrincipal = Depends(require_platform_admin),
) -> AsyncIterator[asyncpg.Connection]:
    """Yield one transaction whose RLS role came only from the verified JWT."""

    async with acquired_connection() as connection:
        await ensure_safe_database_role(connection)
        transaction = connection.transaction()
        await transaction.start()
        try:
            await apply_admin_context(connection, principal)
            yield connection
        except BaseException:
            await transaction.rollback()
            raise
        else:
            await transaction.commit()
