import asyncio
from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest
import httpx
from fastapi.testclient import TestClient

from app.core.database import get_admin_connection
from app.main import app
from app.schemas.admin import TenantCreate
from app.services.tenant_invites import InviteError, SupabaseInviter, get_inviter
from app.services.tenants import TenantService
from tests.conftest import StaticVerifier
from tests.test_auth import admin_claims, vendor_claims

NOW = datetime(2026, 10, 1, tzinfo=UTC)


class FakeInviter:
    def __init__(self) -> None:
        self.user_id = uuid4()
        self.invited: tuple[str, str, str | None] | None = None
        self.deleted: UUID | None = None
        self.error: InviteError | None = None
        self.hosted: tuple[object, ...] | None = None
        self.hosted_deleted: tuple[UUID, UUID] | None = None
        self.hosted_user: tuple[object, ...] | None = None
        self.hosted_user_deleted: UUID | None = None

    async def invite(
        self, email: str, name: str, *, redirect_url: str | None = None,
    ) -> UUID:
        if self.error:
            raise self.error
        self.invited = (email, name, redirect_url)
        return self.user_id

    async def delete(self, user_id: UUID) -> None:
        self.deleted = user_id

    async def provision_hosted_identity(self, *values: object) -> None:
        self.hosted = values

    async def delete_hosted_identity(self, tenant_id: UUID, user_id: UUID) -> None:
        self.hosted_deleted = (tenant_id, user_id)

    async def provision_hosted_user(self, *values: object) -> None:
        self.hosted_user = values

    async def delete_hosted_user(self, user_id: UUID) -> None:
        self.hosted_user_deleted = user_id


class FakeConnection:
    def __init__(self) -> None:
        self.tenant_id: UUID | None = None
        self.inserted_user: tuple[object, ...] | None = None
        self.fail = False

    async def execute(self, query: str, *values: object) -> None:
        if self.fail:
            raise RuntimeError("database unavailable")
        if "create_local_auth_shadow" in query:
            return
        if "insert into public.tenants" in query:
            self.tenant_id = values[0]
            assert values[1] == "New Grocer"
            return
        assert "insert into public.users" in query
        self.inserted_user = values


def test_admin_creates_tenant_and_invites_tenant_admin(
    client: TestClient, verifier: StaticVerifier,
) -> None:
    verifier.claims = admin_claims()
    connection = FakeConnection()
    inviter = FakeInviter()

    async def connection_override():
        yield connection

    app.dependency_overrides[get_admin_connection] = connection_override
    app.dependency_overrides[get_inviter] = lambda: inviter
    try:
        response = client.post(
            "/api/v1/admin/tenants",
            headers={"Authorization": "Bearer valid"},
            json={"name": " New Grocer ", "vendor_name": " Shop Owner ",
                  "vendor_email": "OWNER@EXAMPLE.COM"},
        )
        assert response.status_code == 201
        assert response.json()["id"] == str(connection.tenant_id)
        assert response.json()["invitation_sent"] is True
        assert inviter.invited == (
            "owner@example.com", "Shop Owner", "freshlens://set-password",
        )
        assert connection.inserted_user == (
            inviter.user_id, connection.tenant_id, "Shop Owner", "owner@example.com",
        )
    finally:
        app.dependency_overrides.clear()


def test_vendor_cannot_create_tenant(
    client: TestClient, verifier: StaticVerifier,
) -> None:
    verifier.claims = vendor_claims()
    response = client.post(
        "/api/v1/admin/tenants",
        headers={"Authorization": "Bearer valid"},
        json={"name": "New Grocer", "vendor_name": "Owner",
              "vendor_email": "owner@example.com"},
    )
    assert response.status_code == 403


def test_existing_email_is_reported_without_creating_tenant(
    client: TestClient, verifier: StaticVerifier,
) -> None:
    verifier.claims = admin_claims()
    inviter = FakeInviter()
    inviter.error = InviteError("This email already has an account.", 409)

    async def connection_override():
        yield FakeConnection()

    app.dependency_overrides[get_admin_connection] = connection_override
    app.dependency_overrides[get_inviter] = lambda: inviter
    try:
        response = client.post(
            "/api/v1/admin/tenants", headers={"Authorization": "Bearer valid"},
            json={"name": "New Grocer", "vendor_name": "Owner",
                  "vendor_email": "owner@example.com"},
        )
        assert response.status_code == 409
    finally:
        app.dependency_overrides.clear()


def test_failed_database_provisioning_removes_invited_user() -> None:
    connection = FakeConnection()
    connection.fail = True
    inviter = FakeInviter()
    values = TenantCreate(
        name="New Grocer", vendor_name="Owner", vendor_email="owner@example.com",
    )
    with pytest.raises(RuntimeError, match="database unavailable"):
        asyncio.run(TenantService(connection).create(values, inviter))
    assert inviter.deleted == inviter.user_id


def test_local_database_provisioning_mirrors_hosted_identity(monkeypatch) -> None:
    from app.services import tenants

    monkeypatch.setattr(tenants, "get_settings", lambda: type("Settings", (), {
        "local_auth_shadow": True,
        "tenant_admin_invite_redirect_url": "https://web.test/set-password",
    })())
    connection = FakeConnection()
    inviter = FakeInviter()
    values = TenantCreate(
        name="New Grocer", vendor_name="Owner", vendor_email="owner@example.com",
    )
    result = asyncio.run(TenantService(connection).create(values, inviter))
    assert inviter.hosted == (
        result.id, "New Grocer", inviter.user_id, "Owner", "owner@example.com",
        "tenant_admin",
    )


def test_failed_local_provisioning_removes_hosted_identity(monkeypatch) -> None:
    from app.services import tenants

    monkeypatch.setattr(tenants, "get_settings", lambda: type("Settings", (), {
        "local_auth_shadow": True,
        "tenant_admin_invite_redirect_url": "https://web.test/set-password",
    })())
    connection = FakeConnection()
    connection.fail = True
    inviter = FakeInviter()
    values = TenantCreate(
        name="New Grocer", vendor_name="Owner", vendor_email="owner@example.com",
    )
    with pytest.raises(RuntimeError, match="database unavailable"):
        asyncio.run(TenantService(connection).create(values, inviter))
    assert inviter.hosted_deleted is not None
    assert inviter.hosted_deleted[1] == inviter.user_id
    assert inviter.deleted == inviter.user_id


def test_supabase_invite_uses_mobile_password_link(monkeypatch) -> None:
    from app.services import tenant_invites

    user_id = uuid4()
    requests: list[httpx.Request] = []

    def respond(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200, json={"user": {"id": str(user_id)}})

    real_client = httpx.AsyncClient
    transport = httpx.MockTransport(respond)
    monkeypatch.setattr(tenant_invites, "get_settings", lambda: type("Settings", (), {
        "supabase_url": "https://example.supabase.co",
        "supabase_service_role_key": "server-secret",
        "tenant_admin_invite_redirect_url": "https://web.test/set-password",
    })())
    monkeypatch.setattr(tenant_invites.httpx, "AsyncClient", lambda **kwargs: real_client(
        transport=transport, **kwargs,
    ))

    invited_id = asyncio.run(SupabaseInviter().invite("owner@example.com", "Owner"))
    assert invited_id == user_id
    assert requests[0].url.path == "/auth/v1/invite"
    assert requests[0].url.params["redirect_to"] == "freshlens://set-password"
    assert requests[0].headers["authorization"] == "Bearer server-secret"


class TenantUserConnection:
    def __init__(self) -> None:
        self.tenant_id = uuid4()
        self.user_id = uuid4()
        self.user_status = "active"

    def user_row(self) -> dict[str, object]:
        return {
            "id": self.user_id,
            "tenant_id": self.tenant_id,
            "display_name": "Team Member",
            "email": "member@example.com",
            "status": self.user_status,
            "created_at": NOW,
            "updated_at": NOW,
        }

    async def fetchrow(self, query: str, *values: object):
        if "select id from public.tenants" in query:
            return {"id": self.tenant_id} if values[0] == self.tenant_id else None
        if "insert into public.users" in query:
            self.user_id = values[0]
            return self.user_row()
        if "update public.tenants" in query:
            if values[0] != self.tenant_id:
                return None
            return {"id": self.tenant_id, "status": values[1], "updated_at": NOW}
        if "update public.users" in query:
            if values[0] != self.tenant_id or values[1] != self.user_id:
                return None
            self.user_status = str(values[2])
            return self.user_row()
        raise AssertionError(query)

    async def fetchval(self, query: str, *values: object) -> bool:
        assert "select exists" in query
        return values[0] == self.tenant_id

    async def fetch(self, query: str, *values: object):
        assert "from public.users" in query
        return [self.user_row()] if values[0] == self.tenant_id else []

    async def execute(self, query: str, *values: object) -> None:
        if "create_local_auth_shadow" not in query:
            raise AssertionError(query)


def test_admin_invites_and_lists_user_under_existing_tenant(
    client: TestClient, verifier: StaticVerifier,
) -> None:
    verifier.claims = admin_claims()
    connection = TenantUserConnection()
    inviter = FakeInviter()

    async def connection_override():
        yield connection

    app.dependency_overrides[get_admin_connection] = connection_override
    app.dependency_overrides[get_inviter] = lambda: inviter
    try:
        response = client.post(
            f"/api/v1/admin/tenants/{connection.tenant_id}/users",
            headers={"Authorization": "Bearer valid"},
            json={"display_name": " Team Member ", "email": "MEMBER@EXAMPLE.COM"},
        )
        assert response.status_code == 201
        assert response.json()["tenant_id"] == str(connection.tenant_id)
        assert response.json()["invitation_sent"] is True
        assert inviter.invited == ("member@example.com", "Team Member", None)

        listed = client.get(
            f"/api/v1/admin/tenants/{connection.tenant_id}/users",
            headers={"Authorization": "Bearer valid"},
        )
        assert listed.status_code == 200
        assert listed.json()["total"] == 1
        assert listed.json()["items"][0]["email"] == "member@example.com"
    finally:
        app.dependency_overrides.clear()


def test_admin_revokes_tenant_and_individual_user_access(
    client: TestClient, verifier: StaticVerifier,
) -> None:
    verifier.claims = admin_claims()
    connection = TenantUserConnection()

    async def connection_override():
        yield connection

    app.dependency_overrides[get_admin_connection] = connection_override
    try:
        tenant_response = client.patch(
            f"/api/v1/admin/tenants/{connection.tenant_id}/status",
            headers={"Authorization": "Bearer valid"},
            json={"status": "inactive"},
        )
        assert tenant_response.status_code == 200
        assert tenant_response.json()["status"] == "inactive"

        user_response = client.patch(
            f"/api/v1/admin/tenants/{connection.tenant_id}/users/"
            f"{connection.user_id}/status",
            headers={"Authorization": "Bearer valid"},
            json={"status": "inactive"},
        )
        assert user_response.status_code == 200
        assert user_response.json()["status"] == "inactive"
    finally:
        app.dependency_overrides.clear()


def test_local_user_invitation_mirrors_only_the_new_hosted_user(monkeypatch) -> None:
    from app.services import tenants

    monkeypatch.setattr(tenants, "get_settings", lambda: type("Settings", (), {
        "local_auth_shadow": True,
    })())
    connection = TenantUserConnection()
    inviter = FakeInviter()
    values = tenants.TenantUserCreate(
        display_name="Team Member", email="member@example.com",
    )

    result = asyncio.run(
        TenantService(connection).create_user(connection.tenant_id, values, inviter)
    )

    assert result.tenant_id == connection.tenant_id
    assert inviter.hosted_user == (
        connection.tenant_id, inviter.user_id, "Team Member", "member@example.com",
    )
    assert inviter.hosted is None


def test_vendor_cannot_manage_tenant_users(
    client: TestClient, verifier: StaticVerifier,
) -> None:
    verifier.claims = vendor_claims()
    tenant_id = uuid4()
    response = client.get(
        f"/api/v1/admin/tenants/{tenant_id}/users",
        headers={"Authorization": "Bearer valid"},
    )
    assert response.status_code == 403
