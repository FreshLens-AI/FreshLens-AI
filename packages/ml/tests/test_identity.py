from types import SimpleNamespace

from worker.identity import display_identity
from worker.yolo_cls import Yolo26ClsClassifier


def test_maps_supported_model_labels_to_catalogue_names() -> None:
    assert display_identity("banana") == "Banana"
    assert display_identity("CUCUMBER") == "Cucumber"
    assert display_identity("eggplant") == "Eggplant"
    assert display_identity("tomato") == "Tomato"


def test_rejects_unknown_or_unexpected_model_labels() -> None:
    assert display_identity("unknown") is None
    assert display_identity("pineapple") is None


class _FakeModel:
    def __init__(self, label: str, confidence: float, image_size: int) -> None:
        self._result = SimpleNamespace(
            probs=SimpleNamespace(top1=0, top1conf=confidence),
            names={0: label},
        )
        self.image_size = image_size
        self.calls = 0

    def predict(self, _image: object, *, imgsz: int, verbose: bool) -> list[object]:
        assert imgsz == self.image_size
        self.calls += 1
        return [self._result]


def test_classifier_accepts_supported_identity_above_threshold(monkeypatch) -> None:
    identity = _FakeModel("tomato", 0.91, 160)
    freshness = _FakeModel("medium", 0.84, 224)
    monkeypatch.setattr("worker.yolo_cls._pil_image", lambda _image: object())
    monkeypatch.setattr("worker.yolo_cls._identity_model", lambda: identity)
    monkeypatch.setattr("worker.yolo_cls._freshness_model", lambda: freshness)
    monkeypatch.setenv("IDENTITY_MIN_CONFIDENCE", "0.75")
    monkeypatch.setenv("FRESHNESS_MIN_CONFIDENCE", "0.50")

    result = Yolo26ClsClassifier().classify(b"image")

    assert result.identity_label == "Tomato"
    assert result.identity_score == 0.91
    assert result.label == "medium"
    assert result.score == 0.84
    assert result.model_version == (
        "identity-yolo26n-cls-v1+freshness-yolo26n-cls-v1"
    )
    assert identity.calls == 1
    assert freshness.calls == 1


def test_classifier_rejects_low_confidence_supported_identity(monkeypatch) -> None:
    identity = _FakeModel("banana", 0.7, 160)
    freshness = _FakeModel("fresh", 0.99, 224)
    monkeypatch.setattr("worker.yolo_cls._pil_image", lambda _image: object())
    monkeypatch.setattr("worker.yolo_cls._identity_model", lambda: identity)
    monkeypatch.setattr("worker.yolo_cls._freshness_model", lambda: freshness)
    monkeypatch.setenv("IDENTITY_MIN_CONFIDENCE", "0.75")

    result = Yolo26ClsClassifier().classify(b"image")

    assert result.identity_label is None
    assert result.identity_score == 0.7
    assert result.label is None
    assert result.score is None
    assert freshness.calls == 0


def test_classifier_rejects_low_confidence_freshness(monkeypatch) -> None:
    import pytest

    monkeypatch.setattr("worker.yolo_cls._pil_image", lambda _image: object())
    monkeypatch.setattr(
        "worker.yolo_cls._identity_model", lambda: _FakeModel("cucumber", 0.92, 160)
    )
    monkeypatch.setattr(
        "worker.yolo_cls._freshness_model", lambda: _FakeModel("fresh", 0.49, 224)
    )
    monkeypatch.setenv("FRESHNESS_MIN_CONFIDENCE", "0.50")

    with pytest.raises(RuntimeError, match="Freshness confidence"):
        Yolo26ClsClassifier().classify(b"image")
