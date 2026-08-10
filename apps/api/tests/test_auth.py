import asyncio
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from uuid import uuid4

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient

from app.core import auth as auth_module
from app.core.auth import (
    AuthenticationError,
    AuthenticationServiceUnavailableError,
    SupabaseJWTVerifier,
)
from app.core.config import Settings
from app.main import app
from tests.conftest import StaticVerifier


def vendor_claims() -> dict[str, object]:
    return {
        "sub": str(uuid4()),
        "app_role": "vendor",
        "tenant_id": str(uuid4()),
        "email": "vendor@example.com",
        "session_id": str(uuid4()),
        "role": "authenticated",
        "is_anonymous": False,
    }


def admin_claims() -> dict[str, object]:
    return {
        "sub": str(uuid4()),
        "app_role": "platform_admin",
        "tenant_id": None,
        "email": "admin@example.com",
        "session_id": str(uuid4()),
        "role": "authenticated",
        "is_anonymous": False,
    }


def test_health_remains_public(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200


def test_protected_route_rejects_missing_bearer(client: TestClient) -> None:
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


def test_cors_preflight_is_not_authenticated(client: TestClient) -> None:
    response = client.options(
        "/api/v1/auth/me",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"


def test_vendor_identity_comes_from_verified_claims(
    client: TestClient,
    verifier: StaticVerifier,
) -> None:
    verifier.claims = vendor_claims()
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer verified-token"},
    )
    assert response.status_code == 200
    assert response.json()["role"] == "vendor"
    assert response.json()["tenant_id"] == verifier.claims["tenant_id"]


def test_admin_has_no_vendor_tenant(
    client: TestClient,
    verifier: StaticVerifier,
) -> None:
    verifier.claims = admin_claims()
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer verified-token"},
    )
    assert response.status_code == 200
    assert response.json()["role"] == "platform_admin"
    assert response.json()["tenant_id"] is None


def test_standard_supabase_role_is_not_an_application_role(
    client: TestClient,
    verifier: StaticVerifier,
) -> None:
    verifier.claims = {
        "sub": str(uuid4()),
        "role": "authenticated",
        "session_id": str(uuid4()),
        "is_anonymous": False,
    }
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer verified-token"},
    )
    assert response.status_code == 403


def test_vendor_without_tenant_is_forbidden(
    client: TestClient,
    verifier: StaticVerifier,
) -> None:
    verifier.claims = {
        "sub": str(uuid4()),
        "app_role": "vendor",
        "tenant_id": None,
        "role": "authenticated",
        "session_id": str(uuid4()),
        "is_anonymous": False,
    }
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer verified-token"},
    )
    assert response.status_code == 403


def test_verifier_rejects_unsupported_algorithm() -> None:
    now = datetime.now(UTC)
    token = jwt.encode(
        {
            "aud": "authenticated",
            "exp": now + timedelta(minutes=5),
            "iat": now,
            "iss": "https://example.supabase.co/auth/v1",
            "sub": str(uuid4()),
        },
        "test-secret-that-is-at-least-32-bytes-long",
        algorithm="HS256",
    )
    app.state.auth_verifier = SupabaseJWTVerifier(
        Settings(supabase_url="https://example.supabase.co")
    )
    with TestClient(app) as test_client:
        response = test_client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert response.status_code == 401


class LocalJwksClient:
    def __init__(self, public_key: object) -> None:
        self.public_key = public_key

    def get_signing_key_from_jwt(self, token: str) -> SimpleNamespace:
        return SimpleNamespace(key=self.public_key)


def _asymmetric_verifier() -> tuple[SupabaseJWTVerifier, object]:
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    verifier = SupabaseJWTVerifier(
        Settings(supabase_url="https://example.supabase.co")
    )
    verifier._jwks_client = LocalJwksClient(  # type: ignore[assignment]
        private_key.public_key()
    )
    return verifier, private_key


def _signed_claims(**overrides: object) -> dict[str, object]:
    now = datetime.now(UTC)
    claims: dict[str, object] = {
        "aud": "authenticated",
        "exp": now + timedelta(minutes=5),
        "iat": now,
        "iss": "https://example.supabase.co/auth/v1",
        "sub": str(uuid4()),
        "app_role": "platform_admin",
        "role": "authenticated",
        "session_id": str(uuid4()),
        "is_anonymous": False,
    }
    claims.update(overrides)
    return claims


def test_verifier_accepts_valid_asymmetric_supabase_token() -> None:
    verifier, private_key = _asymmetric_verifier()
    token = jwt.encode(_signed_claims(), private_key, algorithm="RS256")
    claims = asyncio.run(verifier.verify(token))
    assert claims["aud"] == "authenticated"


def test_verifier_caches_jwks_but_not_individual_keys(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, object] = {}
    sentinel = object()

    def fake_jwks_client(url: str, **kwargs: object) -> object:
        captured["url"] = url
        captured.update(kwargs)
        return sentinel

    monkeypatch.setattr(auth_module, "PyJWKClient", fake_jwks_client)
    verifier = SupabaseJWTVerifier(
        Settings(supabase_url="https://example.supabase.co")
    )

    assert verifier._client() is sentinel
    assert captured["cache_keys"] is False
    assert captured["cache_jwk_set"] is True
    assert captured["lifespan"] == 600


@pytest.mark.parametrize(
    "claim_overrides",
    [
        {"exp": datetime.now(UTC) - timedelta(minutes=5)},
        {"aud": "wrong-audience"},
        {"iss": "https://other.supabase.co/auth/v1"},
    ],
)
def test_verifier_rejects_expired_or_wrong_project_tokens(
    claim_overrides: dict[str, object],
) -> None:
    verifier, private_key = _asymmetric_verifier()
    token = jwt.encode(
        _signed_claims(**claim_overrides),
        private_key,
        algorithm="RS256",
    )
    with pytest.raises(AuthenticationError):
        asyncio.run(verifier.verify(token))


def test_verifier_rejects_invalid_signature() -> None:
    verifier, _ = _asymmetric_verifier()
    other_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    token = jwt.encode(_signed_claims(), other_key, algorithm="RS256")
    with pytest.raises(AuthenticationError):
        asyncio.run(verifier.verify(token))


@pytest.mark.parametrize(
    "claim_overrides",
    [
        {"role": "service_role"},
        {"is_anonymous": True},
        {"session_id": "not-a-uuid"},
    ],
)
def test_verifier_rejects_non_user_session_claims(
    claim_overrides: dict[str, object],
) -> None:
    verifier, private_key = _asymmetric_verifier()
    token = jwt.encode(
        _signed_claims(**claim_overrides),
        private_key,
        algorithm="RS256",
    )
    with pytest.raises(AuthenticationError):
        asyncio.run(verifier.verify(token))


def test_verifier_requires_session_claims() -> None:
    verifier, private_key = _asymmetric_verifier()
    claims = _signed_claims()
    del claims["session_id"]
    token = jwt.encode(claims, private_key, algorithm="RS256")

    with pytest.raises(AuthenticationError):
        asyncio.run(verifier.verify(token))


class UnavailableJwksClient:
    def get_signing_key_from_jwt(self, token: str) -> object:
        from jwt.exceptions import PyJWKClientConnectionError

        raise PyJWKClientConnectionError("JWKS endpoint unavailable")


def test_verifier_distinguishes_jwks_outage() -> None:
    verifier, private_key = _asymmetric_verifier()
    verifier._jwks_client = UnavailableJwksClient()  # type: ignore[assignment]
    token = jwt.encode(_signed_claims(), private_key, algorithm="RS256")

    with pytest.raises(AuthenticationServiceUnavailableError):
        asyncio.run(verifier.verify(token))


def test_jwks_outage_returns_service_unavailable(
    client: TestClient,
) -> None:
    verifier, private_key = _asymmetric_verifier()
    verifier._jwks_client = UnavailableJwksClient()  # type: ignore[assignment]
    app.state.auth_verifier = verifier
    token = jwt.encode(_signed_claims(), private_key, algorithm="RS256")

    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 503
