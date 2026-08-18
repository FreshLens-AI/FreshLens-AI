import os

from worker.app import app
from worker.classifier import StubClassifier
from worker.db import complete, read_image, set_status

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
def classify_scan(tenant_id: str, scan_id: str, image_path: str) -> str:
    set_status(tenant_id, scan_id, "processing")
    try:
        result = get_classifier().classify(read_image(image_path))
        complete(tenant_id, scan_id, result)
    except Exception:
        set_status(tenant_id, scan_id, "failed")
        raise
    return result.label
