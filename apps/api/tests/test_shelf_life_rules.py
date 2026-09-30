from datetime import UTC, datetime

from fastapi.testclient import TestClient

from app.core.database import get_admin_connection
from app.main import app
from tests.conftest import StaticVerifier
from tests.test_auth import admin_claims, vendor_claims


class RuleConnection:
    def __init__(self) -> None:
        self.saved: tuple[object, ...] | None = None

    async def fetch(self, _query: str) -> list[dict[str, object]]:
        return [{
            "category": "banana",
            "fresh_to_medium_days": None,
            "medium_to_spoiled_days": None,
            "updated_at": datetime(2026, 9, 30, tzinfo=UTC),
        }]

    async def fetchrow(self, _query: str, *values: object) -> dict[str, object]:
        self.saved = values
        return {
            "category": values[0],
            "fresh_to_medium_days": values[1],
            "medium_to_spoiled_days": values[2],
            "updated_at": datetime(2026, 9, 30, tzinfo=UTC),
        }


def test_admin_lists_and_updates_shared_category_rule(
    client: TestClient, verifier: StaticVerifier,
) -> None:
    connection = RuleConnection()

    async def override_connection():
        yield connection

    app.dependency_overrides[get_admin_connection] = override_connection
    try:
        verifier.claims = admin_claims()
        listed = client.get(
            "/api/v1/admin/shelf-life-rules",
            headers={"Authorization": "Bearer valid"},
        )
        assert listed.status_code == 200
        assert listed.json()[0]["fresh_to_medium_days"] is None

        updated = client.put(
            "/api/v1/admin/shelf-life-rules/banana",
            headers={"Authorization": "Bearer valid"},
            json={"fresh_to_medium_days": 2, "medium_to_spoiled_days": 3},
        )
        assert updated.status_code == 200
        assert updated.json()["category"] == "banana"
        assert connection.saved == ("banana", 2, 3)

        invalid = client.put(
            "/api/v1/admin/shelf-life-rules/banana",
            headers={"Authorization": "Bearer valid"},
            json={"fresh_to_medium_days": 0, "medium_to_spoiled_days": 3},
        )
        assert invalid.status_code == 422
        assert connection.saved == ("banana", 2, 3)
    finally:
        app.dependency_overrides.clear()


def test_vendor_cannot_change_category_rule(
    client: TestClient, verifier: StaticVerifier,
) -> None:
    verifier.claims = vendor_claims()
    response = client.put(
        "/api/v1/admin/shelf-life-rules/banana",
        headers={"Authorization": "Bearer valid"},
        json={"fresh_to_medium_days": 2, "medium_to_spoiled_days": 3},
    )
    assert response.status_code == 403
