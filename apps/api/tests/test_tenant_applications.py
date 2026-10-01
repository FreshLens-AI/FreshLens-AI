from datetime import UTC, datetime
from uuid import UUID, uuid4

from fastapi.testclient import TestClient

from app.core.database import get_admin_connection, get_public_connection
from app.main import app
from app.services.tenant_invites import get_inviter
from tests.conftest import StaticVerifier
from tests.test_auth import admin_claims

NOW = datetime(2026, 10, 1, tzinfo=UTC)


class ApplicationConnection:
    def __init__(self) -> None:
        self.id = uuid4()
        self.row: dict[str, object] = {
            "id": self.id,
            "organization_name": "Example Grocer",
            "applicant_name": "Shop Owner",
            "applicant_email": "owner@example.com",
            "phone": "+94 77 123 4567",
            "status": "pending",
            "review_note": None,
            "reviewed_by": None,
            "approved_tenant_id": None,
            "approved_user_id": None,
            "submitted_at": NOW,
            "reviewed_at": None,
            "updated_at": NOW,
        }
        self.inserted_user_query = ""

    async def fetchval(self, query: str, *values: object):
        if "submit_tenant_application" in query:
            assert values[2] == "owner@example.com"
            return self.id
        return True

    async def fetch(self, query: str, *values: object):
        return [{**self.row, "total": 1}]

    async def fetchrow(self, query: str, *values: object):
        if "for update" in query:
            return self.row
        if "update public.tenant_applications" in query:
            self.row.update(
                status="approved" if "'approved'" in query else "rejected",
                reviewed_by=values[1], review_note=values[2],
                reviewed_at=NOW, updated_at=NOW,
            )
            if self.row["status"] == "approved":
                self.row.update(
                    approved_tenant_id=values[3], approved_user_id=values[4],
                )
            return self.row
        raise AssertionError(query)

    async def execute(self, query: str, *values: object) -> None:
        if "insert into public.users" in query:
            self.inserted_user_query = query


class FakeInviter:
    def __init__(self) -> None:
        self.user_id = uuid4()
        self.redirect_url: str | None = None

    async def invite(
        self, email: str, name: str, *, redirect_url: str | None = None,
    ) -> UUID:
        self.redirect_url = redirect_url
        return self.user_id

    async def delete(self, user_id: UUID) -> None:
        pass


def test_public_can_submit_but_cannot_list_applications(client: TestClient) -> None:
    connection = ApplicationConnection()

    async def public_connection():
        yield connection

    app.dependency_overrides[get_public_connection] = public_connection
    try:
        response = client.post(
            "/api/v1/tenant-applications",
            json={
                "organization_name": " Example Grocer ",
                "applicant_name": " Shop Owner ",
                "applicant_email": "OWNER@EXAMPLE.COM",
                "phone": "+94 77 123 4567",
            },
        )
        assert response.status_code == 202
        assert response.json()["id"] == str(connection.id)
        assert client.get("/api/v1/admin/tenant-applications").status_code == 401
    finally:
        app.dependency_overrides.clear()


def test_platform_admin_approves_application_and_invites_tenant_owner(
    client: TestClient, verifier: StaticVerifier,
) -> None:
    verifier.claims = admin_claims()
    connection = ApplicationConnection()
    inviter = FakeInviter()

    async def admin_connection():
        yield connection

    app.dependency_overrides[get_admin_connection] = admin_connection
    app.dependency_overrides[get_inviter] = lambda: inviter
    try:
        listed = client.get(
            "/api/v1/admin/tenant-applications",
            headers={"Authorization": "Bearer valid"},
        )
        assert listed.status_code == 200
        assert listed.json()["total"] == 1

        approved = client.post(
            f"/api/v1/admin/tenant-applications/{connection.id}/approve",
            headers={"Authorization": "Bearer valid"},
            json={"note": "Approved"},
        )
        assert approved.status_code == 200
        assert approved.json()["status"] == "approved"
        assert "'tenant_admin'" in connection.inserted_user_query
        assert inviter.redirect_url == "http://localhost:3000/set-password"
    finally:
        app.dependency_overrides.clear()
