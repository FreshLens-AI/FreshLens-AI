from collections.abc import Iterator, Mapping
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.main import app


class StaticVerifier:
    def __init__(self, claims: Mapping[str, Any] | None = None) -> None:
        self.claims = claims or {}

    async def verify(self, token: str) -> Mapping[str, Any]:
        return self.claims


def _disable_database_pool(monkeypatch: pytest.MonkeyPatch) -> None:
    """Unit tests substitute DB deps; do not open a real pool during lifespan."""

    async def _noop() -> None:
        return None

    monkeypatch.setattr("app.core.database.init_pool", _noop)
    monkeypatch.setattr("app.core.database.close_pool", _noop)


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    _disable_database_pool(monkeypatch)
    original = app.state.auth_verifier
    with TestClient(app) as test_client:
        yield test_client
    app.state.auth_verifier = original


@pytest.fixture
def verifier() -> StaticVerifier:
    verifier = StaticVerifier()
    app.state.auth_verifier = verifier
    return verifier
