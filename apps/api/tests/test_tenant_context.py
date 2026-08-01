import asyncio
from uuid import uuid4

import pytest

from app.core import database
from app.core.config import Settings
from app.core.database import (
    UnsafeDatabaseRoleError,
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
