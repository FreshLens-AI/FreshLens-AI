import os
from functools import lru_cache
from io import BytesIO
from pathlib import Path

from worker.classifier import ClassificationResult
from worker.identity import DEFAULT_IDENTITY_MODEL_VERSION, display_identity


@lru_cache(maxsize=1)
def _identity_model():
    from ultralytics import YOLO

    weights = os.environ.get(
        "IDENTITY_WEIGHTS",
        os.environ.get("YOLO_CLS_WEIGHTS", "/app/models/identity-v1.pt"),
    )
    parent = Path(weights).expanduser().parent
    if str(parent) not in {"", "."}:
        parent.mkdir(parents=True, exist_ok=True)
    return YOLO(weights)


@lru_cache(maxsize=1)
def _freshness_model():
    from ultralytics import YOLO

    weights = os.environ.get("FRESHNESS_WEIGHTS", "/app/models/freshness-v1.pt")
    parent = Path(weights).expanduser().parent
    if str(parent) not in {"", "."}:
        parent.mkdir(parents=True, exist_ok=True)
    return YOLO(weights)


def _pil_image(image: bytes):
    from PIL import Image

    return Image.open(BytesIO(image)).convert("RGB")


class Yolo26ClsClassifier:
    """Run the FreshLens identity model, then freshness for accepted produce."""

    def classify(self, image: bytes) -> ClassificationResult:
        pil_image = _pil_image(image)
        identity_size = int(os.environ.get("IDENTITY_IMAGE_SIZE", "160"))
        identity_result = _identity_model().predict(
            pil_image, imgsz=identity_size, verbose=False
        )[0]
        if identity_result.probs is None:
            raise RuntimeError("YOLO26-cls returned no class probabilities.")
        raw = str(identity_result.names[int(identity_result.probs.top1)])
        identity_score = float(identity_result.probs.top1conf)
        minimum_confidence = float(os.environ.get("IDENTITY_MIN_CONFIDENCE", "0.75"))
        identity_label = (
            display_identity(raw) if identity_score >= minimum_confidence else None
        )
        identity_version = os.environ.get(
            "IDENTITY_MODEL_VERSION", DEFAULT_IDENTITY_MODEL_VERSION
        )
        if identity_label is None:
            return ClassificationResult(
                label=None,
                score=None,
                model_version=identity_version,
                identity_label=None,
                identity_score=identity_score,
                identity_model_version=identity_version,
            )

        freshness_size = int(os.environ.get("FRESHNESS_IMAGE_SIZE", "224"))
        freshness_result = _freshness_model().predict(
            pil_image, imgsz=freshness_size, verbose=False
        )[0]
        if freshness_result.probs is None:
            raise RuntimeError("Freshness YOLO26-cls returned no class probabilities.")
        freshness_label = str(
            freshness_result.names[int(freshness_result.probs.top1)]
        ).strip().lower()
        if freshness_label not in {"fresh", "medium", "spoiled"}:
            raise RuntimeError(
                f"Freshness model returned unsupported class {freshness_label!r}."
            )
        freshness_score = float(freshness_result.probs.top1conf)
        freshness_minimum = float(
            os.environ.get("FRESHNESS_MIN_CONFIDENCE", "0.50")
        )
        if freshness_score < freshness_minimum:
            raise RuntimeError(
                "Freshness confidence was below the configured acceptance threshold."
            )
        freshness_version = os.environ.get(
            "FRESHNESS_MODEL_VERSION", "freshness-yolo26n-cls-v1"
        )
        return ClassificationResult(
            label=freshness_label,
            score=freshness_score,
            model_version=f"{identity_version}+{freshness_version}",
            identity_label=identity_label,
            identity_score=identity_score,
            identity_model_version=identity_version,
        )
