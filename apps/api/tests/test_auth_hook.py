import base64
import hashlib
import hmac
import json
import time
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.core.auth_hook import HookSignatureError, verify_hook_signature
from app.core.config import get_settings
from app.core.database import get_auth_hook_connection
from app.main import app

KEY = b"freshlens-test-hook-secret-bytes"
SECRET = "v1,whsec_" + base64.b64encode(KEY).decode()
PATH = "/api/v1/auth/hooks/access-token"


def _sign(body: bytes, webhook_id: str = "msg_1", timestamp: int | None = None):
    sent_at = str(int(time.time()) if timestamp is None else timestamp)
    digest = hmac.new(KEY, f"{webhook_id}.{sent_at}.".encode() + body, hashlib.sha256)
    return {
        "webhook-id": webhook_id,
        "webhook-timestamp": sent_at,
        "webhook-signature": "v1," + base64.b64encode(digest.digest()).decode(),
        "content-type": "application/json",
    }


class HookDb:
    def __init__(self, tenant_id: str) -> None:
        self.tenant_id = tenant_id
        self.events: list[dict[str, object]] = []

    async def fetchval(self, query: str, *args: object) -> str:
        assert "public.resolve_access_token_claims($1::jsonb)" in query
        event = json.loads(str(args[0]))
        self.events.append(event)
        claims = dict(event["claims"])
        claims.update(app_role="vendor", tenant_id=self.tenant_id)
        return json.dumps({**event, "claims": claims})


@pytest.fixture
def hook_db(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(get_settings(), "supabase_auth_hook_secret", SECRET)
    db = HookDb(str(uuid4()))

    async def override_connection():
        yield db

    app.dependency_overrides[get_auth_hook_connection] = override_connection
    yield db
    app.dependency_overrides.clear()


def _event(user_id: str | None = None) -> dict[str, object]:
    user_id = user_id or str(uuid4())
    return {
        "user_id": user_id,
        "claims": {"sub": user_id, "role": "authenticated", "app_role": "platform_admin"},
        "authentication_method": "password",
    }


def test_signed_hook_returns_claims_from_app_database(
    client: TestClient, hook_db: HookDb
) -> None:
    body = json.dumps(_event()).encode()
    response = client.post(PATH, content=body, headers=_sign(body))

    assert response.status_code == 200
    claims = response.json()["claims"]
    assert claims["app_role"] == "vendor"
    assert claims["tenant_id"] == hook_db.tenant_id
    assert claims["role"] == "authenticated"
    assert len(hook_db.events) == 1


def test_hook_needs_no_bearer_token_but_rejects_bad_signatures(
    client: TestClient, hook_db: HookDb
) -> None:
    body = json.dumps(_event()).encode()
    forged = _sign(body)
    forged["webhook-signature"] = "v1," + base64.b64encode(b"x" * 32).decode()

    assert client.post(PATH, content=body, headers=forged).status_code == 401
    tampered = client.post(PATH, content=body + b" ", headers=_sign(body))
    assert tampered.status_code == 401
    assert client.post(PATH, content=body).status_code == 401
    assert hook_db.events == []


def test_hook_rejects_stale_timestamps(client: TestClient, hook_db: HookDb) -> None:
    body = json.dumps(_event()).encode()
    stale = _sign(body, timestamp=int(time.time()) - 600)

    assert client.post(PATH, content=body, headers=stale).status_code == 401
    assert hook_db.events == []


def test_hook_rejects_claims_for_another_user(
    client: TestClient, hook_db: HookDb
) -> None:
    event = _event()
    event["claims"] = {"sub": str(uuid4())}
    body = json.dumps(event).encode()

    assert client.post(PATH, content=body, headers=_sign(body)).status_code == 400
    assert hook_db.events == []


def test_hook_unavailable_without_secret(
    client: TestClient, hook_db: HookDb, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(get_settings(), "supabase_auth_hook_secret", "")
    body = json.dumps(_event()).encode()

    assert client.post(PATH, content=body, headers=_sign(body)).status_code == 503


def test_signature_accepts_any_matching_v1_candidate() -> None:
    body = b'{"ok":true}'
    headers = _sign(body)
    header = "v1,bm9wZQ== " + headers["webhook-signature"]

    verify_hook_signature(
        secret=SECRET,
        webhook_id=headers["webhook-id"],
        timestamp=headers["webhook-timestamp"],
        signature_header=header,
        body=body,
    )
    with pytest.raises(HookSignatureError):
        verify_hook_signature(
            secret=SECRET,
            webhook_id="other",
            timestamp=headers["webhook-timestamp"],
            signature_header=header,
            body=body,
        )
