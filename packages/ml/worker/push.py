"""Best-effort Expo Push wake-ups (SAD PushNotifier, FR-V-006, FR-S-013).

Pushes are sent after the scan/alert transaction commits. They are never the
source of truth: the app refetches GET /api/v1/scans/{id} or /api/v1/alerts.
Every failure is logged and swallowed so a push can never fail a scan task.
"""

import json
import logging
import os
import urllib.request

from worker import db
from worker.classifier import ClassificationResult

log = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
CHUNK_SIZE = 100
TIMEOUT_SECONDS = 10


def push_enabled() -> bool:
    return os.environ.get("PUSH_ENABLED", "true").strip().lower() not in {
        "0",
        "false",
        "no",
        "off",
    }


def _post(messages: list[dict]) -> list[dict]:
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    access_token = os.environ.get("EXPO_ACCESS_TOKEN", "").strip()
    if access_token:
        headers["Authorization"] = f"Bearer {access_token}"
    request = urllib.request.Request(
        EXPO_PUSH_URL,
        data=json.dumps(messages).encode(),
        headers=headers,
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
        return json.loads(response.read()).get("data", [])


def send_expo_push(
    tenant_id: str, title: str, body: str, data: dict[str, str]
) -> int:
    """Push to every active device in the tenant; return tickets accepted."""
    if not push_enabled():
        return 0
    try:
        tokens = db.active_push_tokens(tenant_id)
    except Exception:
        log.exception("push: could not load device tokens")
        return 0

    accepted = 0
    stale: list[str] = []
    for start in range(0, len(tokens), CHUNK_SIZE):
        chunk = tokens[start : start + CHUNK_SIZE]
        messages = [
            {
                "to": token,
                "title": title,
                "body": body,
                "data": data,
                "sound": "default",
                "channelId": "default",
                "priority": "high",
            }
            for token in chunk
        ]
        try:
            tickets = _post(messages)
        except Exception:
            log.exception("push: Expo request failed")
            continue
        for token, ticket in zip(chunk, tickets):
            if ticket.get("status") == "ok":
                accepted += 1
            elif (ticket.get("details") or {}).get("error") == "DeviceNotRegistered":
                stale.append(token)
            else:
                log.warning("push: ticket error %s", ticket.get("message"))

    if stale:
        try:
            db.deactivate_push_tokens(tenant_id, stale)
        except Exception:
            log.exception("push: could not deactivate stale tokens")
    return accepted


def notify_scan(
    tenant_id: str,
    scan_id: str,
    status: str,
    result: ClassificationResult | None = None,
) -> int:
    if status == "completed" and result is not None:
        produce = result.identity_label or "Produce"
        freshness = result.label or "unclassified"
        title, body = "Scan complete", f"{produce}: {freshness}"
    else:
        title, body = "Scan failed", "We couldn't classify that scan. Try again."
    return send_expo_push(
        tenant_id, title, body, {"type": "scan", "scan_id": scan_id, "status": status}
    )


def notify_alert(tenant_id: str, alert_id: str, message: str) -> int:
    return send_expo_push(
        tenant_id, "Spoilage alert", message, {"type": "alert", "alert_id": alert_id}
    )
