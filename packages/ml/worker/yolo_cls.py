import os
from functools import lru_cache
from io import BytesIO
from pathlib import Path

from worker.classifier import ClassificationResult, StubClassifier
from worker.identity import DEFAULT_IDENTITY_MODEL_VERSION, display_identity


@lru_cache(maxsize=1)
def _model():
    from ultralytics import YOLO

    weights = os.environ.get(
        "IDENTITY_WEIGHTS",
        os.environ.get("YOLO_CLS_WEIGHTS", "yolo26n-cls.pt"),
    )
    parent = Path(weights).expanduser().parent
    if str(parent) not in {"", "."}:
        parent.mkdir(parents=True, exist_ok=True)
    return YOLO(weights)


def _pil_image(image: bytes):
    from PIL import Image

    return Image.open(BytesIO(image)).convert("RGB")


class Yolo26ClsClassifier:
    """FreshLens identity-v1 classifier. Freshness remains explicit stub data."""

    def classify(self, image: bytes) -> ClassificationResult:
        image_size = int(os.environ.get("IDENTITY_IMAGE_SIZE", "160"))
        result = _model().predict(_pil_image(image), imgsz=image_size, verbose=False)[0]
        if result.probs is None:
            raise RuntimeError("YOLO26-cls returned no class probabilities.")
        raw = str(result.names[int(result.probs.top1)])
        identity_score = float(result.probs.top1conf)
        minimum_confidence = float(os.environ.get("IDENTITY_MIN_CONFIDENCE", "0.75"))
        identity_label = (
            display_identity(raw) if identity_score >= minimum_confidence else None
        )
        identity_version = os.environ.get(
            "IDENTITY_MODEL_VERSION", DEFAULT_IDENTITY_MODEL_VERSION
        )
        stub = StubClassifier().classify(image)
        return ClassificationResult(
            label=stub.label,
            score=stub.score,
            model_version=f"{identity_version}+{stub.model_version}",
            identity_label=identity_label,
            identity_score=identity_score,
            identity_model_version=identity_version,
        )
