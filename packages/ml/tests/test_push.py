import json

import pytest

from worker import db, push, tasks
from worker.classifier import ClassificationResult


class FakeResponse:
    def __init__(self, payload):
        self.payload = payload

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self):
        return json.dumps(self.payload).encode()


@pytest.fixture
def expo(monkeypatch):
    """Capture Expo requests; reply `ok` unless a token is marked stale."""
    state = {"requests": [], "stale": set(), "deactivated": [], "tokens": []}

    def fake_urlopen(request, timeout):
        assert request.full_url == push.EXPO_PUSH_URL
        assert timeout == push.TIMEOUT_SECONDS
        messages = json.loads(request.data)
        state["requests"].append({"headers": dict(request.headers), "messages": messages})
        return FakeResponse(
            {
                "data": [
                    {
                        "status": "error",
                        "message": "not registered",
                        "details": {"error": "DeviceNotRegistered"},
                    }
                    if m["to"] in state["stale"]
                    else {"status": "ok", "id": "ticket"}
                    for m in messages
                ]
            }
        )

    monkeypatch.setenv("PUSH_ENABLED", "true")
    monkeypatch.delenv("EXPO_ACCESS_TOKEN", raising=False)
    monkeypatch.setattr(push.urllib.request, "urlopen", fake_urlopen)
    monkeypatch.setattr(
        db, "active_push_tokens", lambda _tenant, _user: list(state["tokens"])
    )
    monkeypatch.setattr(
        db,
        "deactivate_push_tokens",
        lambda tenant, _user, tokens: state["deactivated"].append((tenant, tokens)),
    )
    return state


def test_scan_push_payload_targets_tenant_devices(expo) -> None:
    expo["tokens"] = ["ExponentPushToken[a]", "ExponentPushToken[b]"]
    result = ClassificationResult(label="fresh", score=0.9, identity_label="Banana")

    assert push.notify_scan(
        "tenant-1", "user-1", "scan-1", "completed", result
    ) == 2

    [request] = expo["requests"]
    first = request["messages"][0]
    assert first["to"] == "ExponentPushToken[a]"
    assert first["title"] == "Scan complete"
    assert first["body"] == "Banana: fresh"
    assert first["data"] == {"type": "scan", "scan_id": "scan-1", "status": "completed"}
    assert first["channelId"] == "default"
    assert "Authorization" not in request["headers"]


def test_messages_are_chunked_by_100(expo) -> None:
    expo["tokens"] = [f"ExponentPushToken[{i}]" for i in range(205)]

    assert push.notify_alert(
        "tenant-1", "user-1", "alert-1", "Spoilage risk", "Banana spoiled"
    ) == 205
    assert [len(r["messages"]) for r in expo["requests"]] == [100, 100, 5]
    assert expo["requests"][0]["messages"][0]["data"] == {
        "type": "alert",
        "alert_id": "alert-1",
    }


def test_unregistered_tokens_are_deactivated(expo) -> None:
    expo["tokens"] = ["ExponentPushToken[ok]", "ExponentPushToken[gone]"]
    expo["stale"] = {"ExponentPushToken[gone]"}

    assert push.notify_scan("tenant-1", "user-1", "scan-1", "failed") == 1
    assert expo["deactivated"] == [("tenant-1", ["ExponentPushToken[gone]"])]


def test_access_token_is_sent_when_configured(expo, monkeypatch) -> None:
    monkeypatch.setenv("EXPO_ACCESS_TOKEN", "secret")
    expo["tokens"] = ["ExponentPushToken[a]"]

    push.notify_scan("tenant-1", "user-1", "scan-1", "failed")

    assert expo["requests"][0]["headers"]["Authorization"] == "Bearer secret"


def test_network_errors_are_swallowed(expo, monkeypatch) -> None:
    expo["tokens"] = ["ExponentPushToken[a]"]

    def boom(*_args, **_kwargs):
        raise OSError("network down")

    monkeypatch.setattr(push.urllib.request, "urlopen", boom)

    assert push.notify_scan("tenant-1", "user-1", "scan-1", "failed") == 0


def test_push_disabled_sends_nothing(expo, monkeypatch) -> None:
    monkeypatch.setenv("PUSH_ENABLED", "false")
    expo["tokens"] = ["ExponentPushToken[a]"]

    assert push.notify_scan("tenant-1", "user-1", "scan-1", "failed") == 0
    assert expo["requests"] == []


def test_classify_scan_pushes_after_completion(monkeypatch) -> None:
    calls = []
    result = ClassificationResult(label="spoiled", score=0.8, identity_label="Tomato")

    class Classifier:
        def classify(self, _image):
            return result

    monkeypatch.setattr(tasks, "set_status", lambda *a: calls.append(("status", a[3])))
    monkeypatch.setattr(tasks, "read_image", lambda _path: b"img")
    monkeypatch.setattr(tasks, "get_classifier", lambda: Classifier())
    monkeypatch.setattr(
        tasks, "complete", lambda *_a: calls.append(("complete",)) or "alert-9"
    )
    monkeypatch.setattr(
        tasks,
        "notify_scan",
        lambda _t, _u, _s, status, *_r: calls.append(("push", status)),
    )
    monkeypatch.setattr(
        tasks,
        "notify_alert",
        lambda _t, _u, alert_id, _title, _message: calls.append(("alert", alert_id))
        or 1,
    )
    monkeypatch.setattr(
        tasks,
        "mark_alert_notification_sent",
        lambda _tenant, _user, alert_id: calls.append(("sent", alert_id)),
    )

    assert tasks.classify_scan("tenant-1", "user-1", "scan-1", "k.jpg") == "spoiled"
    assert calls == [
        ("status", "processing"),
        ("complete",),
        ("push", "completed"),
        ("alert", "alert-9"),
        ("sent", "alert-9"),
    ]


def test_classify_scan_pushes_failure_and_reraises(monkeypatch) -> None:
    calls = []

    def fail(_path):
        raise FileNotFoundError("missing")

    monkeypatch.setattr(tasks, "set_status", lambda *a: calls.append(("status", a[3])))
    monkeypatch.setattr(tasks, "read_image", fail)
    monkeypatch.setattr(
        tasks,
        "notify_scan",
        lambda _t, _u, _s, status, *_r: calls.append(("push", status)),
    )

    with pytest.raises(FileNotFoundError):
        tasks.classify_scan("tenant-1", "user-1", "scan-1", "k.jpg")
    assert calls == [("status", "processing"), ("status", "failed"), ("push", "failed")]
