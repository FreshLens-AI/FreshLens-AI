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


@pytest.fixture
def client() -> Iterator[TestClient]:
    original = app.state.auth_verifier
    with TestClient(app) as test_client:
        yield test_client
    app.state.auth_verifier = original


@pytest.fixture
def verifier() -> StaticVerifier:
    verifier = StaticVerifier()
    app.state.auth_verifier = verifier
    return verifier
