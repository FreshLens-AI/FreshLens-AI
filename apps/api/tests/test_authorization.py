from uuid import uuid4

from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.dependencies.auth import require_platform_admin, require_vendor
from app.main import app
from app.schemas.auth import AuthPrincipal
from tests.conftest import StaticVerifier


def _install_test_routes() -> None:
    route_paths = {route.path for route in app.routes}
    if "/api/v1/test/vendor" not in route_paths:

        @app.get("/api/v1/test/vendor")
        async def vendor_only(
            principal: AuthPrincipal = Depends(require_vendor),
        ) -> dict[str, str]:
            return {"role": principal.role.value}

    if "/api/v1/test/admin" not in route_paths:

        @app.get("/api/v1/test/admin")
        async def admin_only(
            principal: AuthPrincipal = Depends(require_platform_admin),
        ) -> dict[str, str]:
            return {"role": principal.role.value}


_install_test_routes()


def test_vendor_cannot_call_admin_route(
    client: TestClient,
    verifier: StaticVerifier,
) -> None:
    verifier.claims = {
        "sub": str(uuid4()),
        "app_role": "vendor",
        "tenant_id": str(uuid4()),
        "role": "authenticated",
        "session_id": str(uuid4()),
        "is_anonymous": False,
    }
    response = client.get(
        "/api/v1/test/admin",
        headers={"Authorization": "Bearer valid"},
    )
    assert response.status_code == 403


def test_admin_cannot_call_vendor_route(
    client: TestClient,
    verifier: StaticVerifier,
) -> None:
    verifier.claims = {
        "sub": str(uuid4()),
        "app_role": "platform_admin",
        "tenant_id": None,
        "role": "authenticated",
        "session_id": str(uuid4()),
        "is_anonymous": False,
    }
    response = client.get(
        "/api/v1/test/vendor",
        headers={"Authorization": "Bearer valid"},
    )
    assert response.status_code == 403


def test_role_dependencies_inherit_bearer_openapi_security() -> None:
    app.openapi_schema = None
    operation = app.openapi()["paths"]["/api/v1/test/vendor"]["get"]
    assert {"bearerAuth": []} in operation["security"]
