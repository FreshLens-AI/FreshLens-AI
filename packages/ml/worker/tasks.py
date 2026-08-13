from worker.app import app
from worker.classifier import StubClassifier
from worker.db import complete, read_image, set_status


@app.task(name="classify_scan")
def classify_scan(tenant_id: str, scan_id: str, image_path: str) -> str:
    set_status(tenant_id, scan_id, "processing")
    try:
        result = StubClassifier().classify(read_image(image_path))
        complete(tenant_id, scan_id, result)
    except Exception:
        set_status(tenant_id, scan_id, "failed")
        raise
    return result.label
