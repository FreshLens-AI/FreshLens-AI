from datetime import UTC, datetime
from uuid import uuid4

from fastapi.testclient import TestClient

from app.core.database import get_admin_connection
from app.main import app
from tests.conftest import StaticVerifier
from tests.test_auth import admin_claims, vendor_claims

NOW = datetime(2026, 8, 13, tzinfo=UTC)


class FakeConnection:
    def __init__(self) -> None:
        self.rows: list[dict[str, object]] = []

    async def fetch(self, query: str, *args: object) -> list[dict[str, object]]:
        return self.rows


def test_vendor_cannot_list_tenants(
    client: TestClient,
    verifier: StaticVerifier,
) -> None:
    verifier.claims = vendor_claims()
    response = client.get(
        "/api/v1/admin/tenants",
        headers={"Authorization": "Bearer valid"},
    )
    assert response.status_code == 403


def test_admin_lists_tenants(
    client: TestClient,
    verifier: StaticVerifier,
) -> None:
    connection = FakeConnection()
    tenant_id = uuid4()
    connection.rows = [
        {"id": tenant_id, "name": "Example Grocer", "created_at": NOW, "total": 1}
    ]

    async def override_connection():
        yield connection

    app.dependency_overrides[get_admin_connection] = override_connection
    try:
        verifier.claims = admin_claims()
        response = client.get(
            "/api/v1/admin/tenants",
            headers={"Authorization": "Bearer valid"},
        )
        body = response.json()
        assert response.status_code == 200
        assert body["total"] == 1
        assert body["items"][0]["name"] == "Example Grocer"
    finally:
        app.dependency_overrides.clear()
