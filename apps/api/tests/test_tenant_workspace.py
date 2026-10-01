from datetime import date

from fastapi.testclient import TestClient

from app.core.database import get_tenant_connection
from app.main import app
from app.services.tenant_invites import get_inviter
from tests.conftest import StaticVerifier
from tests.test_auth import tenant_admin_claims, vendor_claims
from tests.test_tenant_onboarding import FakeInviter, TenantUserConnection

class WorkspaceConnection:
    def __init__(self) -> None:
        self.fetch_count = 0

    async def fetchrow(self, query: str):
        return {
            "tenant_name": "Example Grocer",
            "tenant_status": "active",
            "team_members": 3,
            "catalogue_products": 4,
            "active_batches": 2,
            "units_in_stock": 14,
            "active_alerts": 1,
            "scans_this_month": 6,
            "fresh_scans_this_month": 3,
            "medium_scans_this_month": 2,
            "spoiled_scans_this_month": 1,
        }

    async def fetch(self, query: str, *values: object):
        self.fetch_count += 1
        if self.fetch_count == 1:
            return [{
                "date": date(2026, 10, 1), "scans": 6,
                "fresh": 3, "medium": 2, "spoiled": 1,
            }]
        return [{"status": "completed", "count": 6}]


def test_tenant_admin_reads_only_tenant_workspace_aggregates(
    client: TestClient, verifier: StaticVerifier,
) -> None:
    verifier.claims = tenant_admin_claims()
    connection = WorkspaceConnection()

    async def tenant_connection():
        yield connection

    app.dependency_overrides[get_tenant_connection] = tenant_connection
    try:
        overview = client.get(
            "/api/v1/tenant/overview",
            headers={"Authorization": "Bearer valid"},
        )
        assert overview.status_code == 200
        assert overview.json()["tenant_name"] == "Example Grocer"
        assert overview.json()["units_in_stock"] == 14

        analytics = client.get(
            "/api/v1/tenant/analytics?days=30",
            headers={"Authorization": "Bearer valid"},
        )
        assert analytics.status_code == 200
        assert analytics.json()["tenant_id"] == verifier.claims["tenant_id"]
        assert analytics.json()["trend"][0]["scans"] == 6
    finally:
        app.dependency_overrides.clear()


def test_vendor_cannot_manage_tenant_workspace(
    client: TestClient, verifier: StaticVerifier,
) -> None:
    verifier.claims = vendor_claims()

    async def tenant_connection():
        yield WorkspaceConnection()

    app.dependency_overrides[get_tenant_connection] = tenant_connection
    try:
        response = client.get(
            "/api/v1/tenant/overview",
            headers={"Authorization": "Bearer valid"},
        )
        assert response.status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_tenant_admin_invites_vendor_into_claimed_tenant(
    client: TestClient, verifier: StaticVerifier,
) -> None:
    connection = TenantUserConnection()
    claims = tenant_admin_claims()
    claims["tenant_id"] = str(connection.tenant_id)
    verifier.claims = claims
    inviter = FakeInviter()

    async def tenant_connection():
        yield connection

    app.dependency_overrides[get_tenant_connection] = tenant_connection
    app.dependency_overrides[get_inviter] = lambda: inviter
    try:
        response = client.post(
            "/api/v1/tenant/users",
            headers={"Authorization": "Bearer valid"},
            json={"display_name": "Team Member", "email": "member@example.com"},
        )
        assert response.status_code == 201
        assert response.json()["tenant_id"] == str(connection.tenant_id)
        assert inviter.invited == ("member@example.com", "Team Member", None)
    finally:
        app.dependency_overrides.clear()
