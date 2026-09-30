import os

from worker.app import app
from worker.classifier import StubClassifier
from worker.db import complete, read_image, set_status
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
def classify_scan(tenant_id: str, scan_id: str, image_path: str) -> str | None:
    set_status(tenant_id, scan_id, "processing")
    try:
        result = get_classifier().classify(read_image(image_path))
        alert_id = complete(tenant_id, scan_id, result)
    except Exception:
        set_status(tenant_id, scan_id, "failed")
        notify_scan(tenant_id, scan_id, "failed")
        raise
    # Pushes run after the DB transactions above have committed.
    notify_scan(tenant_id, scan_id, "completed", result)
    if alert_id is not None:
        produce = result.identity_label or "Produce"
        notify_alert(tenant_id, alert_id, f"{produce} batch was classified as spoiled.")
    return result.label
