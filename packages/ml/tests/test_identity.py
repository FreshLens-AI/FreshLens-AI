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
    def __init__(self, label: str, confidence: float) -> None:
        self._result = SimpleNamespace(
            probs=SimpleNamespace(top1=0, top1conf=confidence),
            names={0: label},
        )

    def predict(self, _image: object, *, imgsz: int, verbose: bool) -> list[object]:
        assert imgsz == 160
        return [self._result]


def test_classifier_accepts_supported_identity_above_threshold(monkeypatch) -> None:
    monkeypatch.setattr("worker.yolo_cls._pil_image", lambda _image: object())
    monkeypatch.setattr("worker.yolo_cls._model", lambda: _FakeModel("tomato", 0.91))
    monkeypatch.setenv("IDENTITY_MIN_CONFIDENCE", "0.75")

    result = Yolo26ClsClassifier().classify(b"image")

    assert result.identity_label == "Tomato"
    assert result.identity_score == 0.91
    assert result.label == "spoiled"
    assert result.score == 0.22


def test_classifier_rejects_low_confidence_supported_identity(monkeypatch) -> None:
    monkeypatch.setattr("worker.yolo_cls._pil_image", lambda _image: object())
    monkeypatch.setattr("worker.yolo_cls._model", lambda: _FakeModel("banana", 0.7))
    monkeypatch.setenv("IDENTITY_MIN_CONFIDENCE", "0.75")

    result = Yolo26ClsClassifier().classify(b"image")

    assert result.identity_label is None
    assert result.identity_score == 0.7
