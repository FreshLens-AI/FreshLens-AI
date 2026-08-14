import os
from functools import lru_cache
from io import BytesIO
from pathlib import Path

from worker.classifier import ClassificationResult, StubClassifier
from worker.imagenet_produce import display_produce, model_version_for


@lru_cache(maxsize=1)
def _model():
    from ultralytics import YOLO

    weights = os.environ.get("YOLO_CLS_WEIGHTS", "yolo26n-cls.pt")
    parent = Path(weights).expanduser().parent
    if str(parent) not in {"", "."}:
        parent.mkdir(parents=True, exist_ok=True)
    return YOLO(weights)


def _pil_image(image: bytes):
    from PIL import Image

    return Image.open(BytesIO(image)).convert("RGB")


class Yolo26ClsClassifier:
    """ImageNet YOLO26-cls identifier. Freshness stays on the stub."""

    def classify(self, image: bytes) -> ClassificationResult:
        result = _model().predict(_pil_image(image), verbose=False)[0]
        if result.probs is None:
            raise RuntimeError("YOLO26-cls returned no class probabilities.")
        raw = result.names[int(result.probs.top1)]
        name = display_produce(raw)
        stub = StubClassifier().classify(image)
        return ClassificationResult(
            label=stub.label,
            score=float(result.probs.top1conf),
            model_version=model_version_for(name),
        )
