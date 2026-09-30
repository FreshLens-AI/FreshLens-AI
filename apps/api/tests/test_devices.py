from datetime import UTC, datetime
from uuid import UUID, uuid4

from fastapi.testclient import TestClient

from app.core.database import get_tenant_connection
from app.main import app
from tests.conftest import StaticVerifier
from tests.test_auth import admin_claims, vendor_claims

NOW = datetime(2026, 9, 30, tzinfo=UTC)


class DevicesDb:
    def __init__(self) -> None:
        self.upserts: list[tuple[object, ...]] = []

    async def fetchrow(self, query: str, *args: object) -> dict[str, object] | None:
        compact = " ".join(query.lower().split())
        if "insert into public.device_tokens" in compact:
            assert "on conflict (tenant_id, token) do update" in compact
            self.upserts.append(args)
            return {
                "id": uuid4(),
                "platform": args[3],
                "active": True,
                "updated_at": NOW,
            }
        return None


def _post(client: TestClient, json: dict[str, object]):
    return client.post(
        "/api/v1/devices", headers={"Authorization": "Bearer valid"}, json=json
    )


def test_vendor_registers_device_with_jwt_tenant(
    client: TestClient, verifier: StaticVerifier
) -> None:
    db = DevicesDb()

    async def override_connection():
        yield db

    app.dependency_overrides[get_tenant_connection] = override_connection
    try:
        claims = vendor_claims()
        verifier.claims = claims
        response = _post(
            client,
            {
                "token": "  ExponentPushToken[abc]  ",
                "platform": "android",
                "tenant_id": str(uuid4()),
            },
        )
        assert response.status_code == 200
        assert response.json()["platform"] == "android"
        assert response.json()["active"] is True
        tenant_id, user_id, token, platform = db.upserts[0]
        assert tenant_id == UUID(str(claims["tenant_id"]))
        assert user_id == UUID(str(claims["sub"]))
        assert token == "ExponentPushToken[abc]"
        assert platform == "android"
    finally:
        app.dependency_overrides.clear()


def test_device_registration_validates_payload(
    client: TestClient, verifier: StaticVerifier
) -> None:
    async def override_connection():
        yield DevicesDb()

    app.dependency_overrides[get_tenant_connection] = override_connection
    try:
        verifier.claims = vendor_claims()
        assert _post(client, {"token": "t", "platform": "web"}).status_code == 422
        assert _post(client, {"token": "   ", "platform": "ios"}).status_code == 422
        assert _post(client, {"platform": "ios"}).status_code == 422
    finally:
        app.dependency_overrides.clear()


def test_device_registration_requires_auth(client: TestClient) -> None:
    response = client.post(
        "/api/v1/devices", json={"token": "t", "platform": "android"}
    )
    assert response.status_code == 401


def test_admin_cannot_register_device(
    client: TestClient, verifier: StaticVerifier
) -> None:
    verifier.claims = admin_claims()
    response = _post(client, {"token": "t", "platform": "android"})
    assert response.status_code == 403
