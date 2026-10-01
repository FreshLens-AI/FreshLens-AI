import os

from worker.app import app
from worker.classifier import StubClassifier
from worker.db import complete, mark_alert_notification_sent, read_image, set_status
from worker.lifecycle import (
    active_tenant_contexts,
    evaluate_due_lifecycle_alerts,
    pending_alert_notifications,
)
from worker.push import notify_alert, notify_scan

_classifier = None


def _build_classifier():
    if os.environ.get("CLASSIFIER", "stub") in {"identity-v1", "yolo26-cls"}:
        from worker.yolo_cls import Yolo26ClsClassifier

        return Yolo26ClsClassifier()
    return StubClassifier()


def get_classifier():
    global _classifier
    if _classifier is None:
        _classifier = _build_classifier()
    return _classifier


@app.task(name="classify_scan")
def classify_scan(
    tenant_id: str, user_id: str, scan_id: str, image_path: str
) -> str | None:
    set_status(tenant_id, user_id, scan_id, "processing")
    try:
        result = get_classifier().classify(read_image(image_path))
        alert_id = complete(tenant_id, user_id, scan_id, result)
    except Exception:
        set_status(tenant_id, user_id, scan_id, "failed")
        notify_scan(tenant_id, user_id, scan_id, "failed")
        raise
    # Pushes run after the DB transactions above have committed.
    notify_scan(tenant_id, user_id, scan_id, "completed", result)
    if alert_id is not None:
        produce = result.identity_label or "Produce"
        accepted = notify_alert(
            tenant_id,
            user_id,
            alert_id,
            "Spoiled batch detected",
            f"{produce} batch was classified as spoiled. Remove it from sale.",
        )
        if accepted:
            mark_alert_notification_sent(tenant_id, user_id, alert_id)
    return result.label


def _notification_title(alert: dict[str, object]) -> str:
    event_key = alert.get("event_key")
    if event_key == "fresh_to_medium_warning":
        return "Freshness warning"
    if event_key == "medium_to_spoiled_warning":
        return "Spoilage risk"
    if event_key == "low_stock":
        return "Low stock"
    if alert.get("severity") == "critical":
        return "Inventory alert"
    return "FreshLens alert"


@app.task(name="evaluate_tenant_batch_lifecycle")
def evaluate_tenant_batch_lifecycle(
    tenant_id: str, user_id: str
) -> dict[str, int]:
    created = evaluate_due_lifecycle_alerts(tenant_id, user_id)
    delivered = 0
    for alert in pending_alert_notifications(tenant_id, user_id):
        alert_id = str(alert["id"])
        accepted = notify_alert(
            tenant_id,
            user_id,
            alert_id,
            _notification_title(alert),
            str(alert["message"]),
        )
        if accepted:
            mark_alert_notification_sent(tenant_id, user_id, alert_id)
            delivered += 1
    return {"created": created, "delivered": delivered}


@app.task(name="enqueue_batch_lifecycle_checks")
def enqueue_batch_lifecycle_checks() -> int:
    tenant_contexts = active_tenant_contexts()
    for tenant_id, user_id in tenant_contexts:
        evaluate_tenant_batch_lifecycle.delay(tenant_id, user_id)
    return len(tenant_contexts)
