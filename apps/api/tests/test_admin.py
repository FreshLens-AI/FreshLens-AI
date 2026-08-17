from datetime import UTC, date, datetime
from uuid import uuid4

import pytest
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


class SequenceConnection:
    def __init__(self, responses: list[list[dict[str, object]]]) -> None:
        self.responses = responses

    async def fetch(self, query: str, *args: object) -> list[dict[str, object]]:
        return self.responses.pop(0)


@pytest.mark.parametrize(
    "path",
    [
        "/api/v1/admin/tenants",
        "/api/v1/admin/products",
        "/api/v1/admin/alerts",
        "/api/v1/admin/analytics",
    ],
)
def test_vendor_cannot_read_admin_data(
    client: TestClient,
    verifier: StaticVerifier,
    path: str,
) -> None:
    verifier.claims = vendor_claims()
    response = client.get(
        path,
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


def test_admin_lists_product_metadata_without_inventory(
    client: TestClient,
    verifier: StaticVerifier,
) -> None:
    connection = FakeConnection()
    connection.rows = [
        {
            "id": uuid4(),
            "tenant_id": uuid4(),
            "tenant_name": "Example Grocer",
            "name": "Tomato",
            "shelf_life_days": 5,
            "low_stock_threshold": 3,
            "created_at": NOW,
            "updated_at": NOW,
            "scans_this_month": 8,
            "total": 1,
        }
    ]

    async def override_connection():
        yield connection

    app.dependency_overrides[get_admin_connection] = override_connection
    try:
        verifier.claims = admin_claims()
        response = client.get(
            "/api/v1/admin/products",
            headers={"Authorization": "Bearer valid"},
        )
        item = response.json()["items"][0]
        assert response.status_code == 200
        assert item["tenant_name"] == "Example Grocer"
        assert item["scans_this_month"] == 8
        assert "quantity_remaining" not in item
        assert "batches" not in item
    finally:
        app.dependency_overrides.clear()


def test_admin_lists_alert_signals_without_batch_identifiers(
    client: TestClient,
    verifier: StaticVerifier,
) -> None:
    connection = FakeConnection()
    connection.rows = [
        {
            "id": uuid4(),
            "tenant_id": uuid4(),
            "tenant_name": "Example Grocer",
            "type": "aging",
            "severity": "warning",
            "message": "Tomato passed its shelf-life value.",
            "product_id": uuid4(),
            "product_name": "Tomato",
            "created_at": NOW,
            "total": 1,
        }
    ]

    async def override_connection():
        yield connection

    app.dependency_overrides[get_admin_connection] = override_connection
    try:
        verifier.claims = admin_claims()
        response = client.get(
            "/api/v1/admin/alerts",
            headers={"Authorization": "Bearer valid"},
        )
        item = response.json()["items"][0]
        assert response.status_code == 200
        assert item["product_name"] == "Tomato"
        assert "batch_id" not in item
    finally:
        app.dependency_overrides.clear()


def test_admin_reads_aggregate_scan_analytics(
    client: TestClient,
    verifier: StaticVerifier,
) -> None:
    connection = SequenceConnection(
        [
            [
                {
                    "date": date(2026, 8, 13),
                    "scans": 5,
                    "fresh": 3,
                    "medium": 1,
                    "spoiled": 1,
                }
            ],
            [
                {"status": "completed", "count": 5},
            ],
        ]
    )

    async def override_connection():
        yield connection

    app.dependency_overrides[get_admin_connection] = override_connection
    try:
        verifier.claims = admin_claims()
        response = client.get(
            "/api/v1/admin/analytics?days=30",
            headers={"Authorization": "Bearer valid"},
        )
        body = response.json()
        assert response.status_code == 200
        assert body["days"] == 30
        assert body["trend"][0] == {
            "date": "2026-08-13",
            "scans": 5,
            "fresh": 3,
            "medium": 1,
            "spoiled": 1,
        }
        assert body["pipeline"] == [
            {"status": "pending", "count": 0},
            {"status": "processing", "count": 0},
            {"status": "completed", "count": 5},
            {"status": "failed", "count": 0},
        ]
    finally:
        app.dependency_overrides.clear()
