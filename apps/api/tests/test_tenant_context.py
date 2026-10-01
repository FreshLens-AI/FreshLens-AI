import asyncio
from uuid import uuid4

import pytest

from app.core import database
from app.core.config import Settings
from app.core.database import (
    UnsafeDatabaseRoleError,
    apply_admin_context,
    apply_tenant_context,
    assert_safe_database_role,
    connect_database,
)
from app.schemas.auth import AppRole, AuthPrincipal


class RecordingConnection:
    def __init__(self) -> None:
        self.calls: list[tuple[str, str]] = []

    async def execute(self, query: str, value: str) -> None:
        self.calls.append((query, value))


class RoleConnection:
    def __init__(self, role: dict[str, object] | None) -> None:
        self.role = role
        self.required_role: str | None = None

    async def fetchrow(
        self,
        query: str,
        required_role: str,
    ) -> dict[str, object] | None:
        self.required_role = required_role
        return self.role


def test_database_context_uses_verified_principal_only() -> None:
    tenant_id = uuid4()
    user_id = uuid4()
    principal = AuthPrincipal(
        user_id=user_id,
        role=AppRole.VENDOR,
        tenant_id=tenant_id,
    )
    connection = RecordingConnection()

    asyncio.run(apply_tenant_context(connection, principal))  # type: ignore[arg-type]

    assert connection.calls == [
        ("select set_config('app.tenant_id', $1, true)", str(tenant_id)),
        ("select set_config('app.user_id', $1, true)", str(user_id)),
        ("select set_config('app.user_role', $1, true)", "vendor"),
    ]


def test_admin_context_sets_role_without_tenant() -> None:
    user_id = uuid4()
    principal = AuthPrincipal(
        user_id=user_id,
        role=AppRole.PLATFORM_ADMIN,
        tenant_id=None,
    )
    connection = RecordingConnection()
    asyncio.run(apply_admin_context(connection, principal))  # type: ignore[arg-type]
    assert connection.calls == [
        ("select set_config('app.user_id', $1, true)", str(user_id)),
        ("select set_config('app.user_role', $1, true)", "platform_admin"),
    ]


def test_admin_cannot_receive_vendor_database_context() -> None:
    principal = AuthPrincipal(
        user_id=uuid4(),
        role=AppRole.PLATFORM_ADMIN,
        tenant_id=None,
    )
    try:
        asyncio.run(
            apply_tenant_context(
                RecordingConnection(),
                principal,
            )  # type: ignore[arg-type]
        )
    except ValueError:
        pass
    else:
        raise AssertionError("Admin received a vendor database context")


def test_database_role_accepts_restricted_freshlens_member() -> None:
    connection = RoleConnection(
        {
            "role_name": "freshlens_api_local",
            "is_superuser": False,
            "bypasses_rls": False,
            "is_freshlens_api": True,
        }
    )
    asyncio.run(assert_safe_database_role(connection))  # type: ignore[arg-type]
    assert connection.required_role == "freshlens_api"


@pytest.mark.parametrize(
    "role",
    [
        {
            "role_name": "postgres",
            "is_superuser": True,
            "bypasses_rls": True,
            "is_freshlens_api": True,
        },
        {
            "role_name": "service_role",
            "is_superuser": False,
            "bypasses_rls": True,
            "is_freshlens_api": True,
        },
        {
            "role_name": "untrusted_login",
            "is_superuser": False,
            "bypasses_rls": False,
            "is_freshlens_api": False,
        },
        None,
    ],
)
def test_database_role_rejects_unsafe_logins(
    role: dict[str, object] | None,
) -> None:
    with pytest.raises(UnsafeDatabaseRoleError):
        asyncio.run(
            assert_safe_database_role(RoleConnection(role))  # type: ignore[arg-type]
        )


def test_database_connection_disables_statement_cache_and_configures_ssl(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, object] = {}
    sentinel = object()

    async def fake_connect(url: str, **kwargs: object) -> object:
        captured["url"] = url
        captured.update(kwargs)
        return sentinel

    settings = Settings(
        database_url="postgresql://freshlens_api_local:test@localhost/freshlens",
        database_ssl_mode="require",
    )
    monkeypatch.setattr(database, "get_settings", lambda: settings)
    monkeypatch.setattr(database.asyncpg, "connect", fake_connect)

    connection = asyncio.run(connect_database())

    assert connection is sentinel
    assert captured == {
        "url": settings.database_url,
        "ssl": "require",
        "statement_cache_size": 0,
    }


def test_init_pool_creates_pool_and_caches_role_check(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, object] = {}
    role_checks = {"count": 0}

    class FakePoolConnection:
        async def fetchrow(self, query: str, required_role: str) -> dict[str, object]:
            role_checks["count"] += 1
            return {
                "role_name": "freshlens_api_local",
                "is_superuser": False,
                "bypasses_rls": False,
                "is_freshlens_api": True,
            }

    class FakePoolAcquire:
        async def __aenter__(self) -> FakePoolConnection:
            return FakePoolConnection()

        async def __aexit__(self, *args: object) -> None:
            return None

    class FakePool:
        def acquire(self) -> FakePoolAcquire:
            return FakePoolAcquire()

        async def close(self) -> None:
            captured["closed"] = True

    async def fake_create_pool(url: str, **kwargs: object) -> FakePool:
        captured["url"] = url
        captured.update(kwargs)
        return FakePool()

    settings = Settings(
        database_url="postgresql://freshlens_api_local:test@localhost/freshlens",
        database_ssl_mode="require",
        database_pool_min_size=2,
        database_pool_max_size=8,
    )
    monkeypatch.setattr(database, "get_settings", lambda: settings)
    monkeypatch.setattr(database.asyncpg, "create_pool", fake_create_pool)
    monkeypatch.setattr(database, "_pool", None)
    monkeypatch.setattr(database, "_role_verified", False)

    async def run() -> None:
        await database.init_pool()
        assert database._pool is not None
        assert database._role_verified is True
        assert role_checks["count"] == 1
        await database.ensure_safe_database_role(FakePoolConnection())  # type: ignore[arg-type]
        assert role_checks["count"] == 1
        await database.close_pool()
        assert database._pool is None
        assert database._role_verified is False
        assert captured["closed"] is True

    asyncio.run(run())

    assert captured["url"] == settings.database_url
    assert captured["ssl"] == "require"
    assert captured["statement_cache_size"] == 0
    assert captured["min_size"] == 2
    assert captured["max_size"] == 8
