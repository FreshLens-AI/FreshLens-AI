from dataclasses import dataclass

LABELS = ("fresh", "medium", "spoiled")
SCORES = (0.91, 0.64, 0.22)
MODEL_VERSION = "stub-v0"


@dataclass(frozen=True)
class ClassificationResult:
    label: str | None
    score: float | None
    model_version: str = MODEL_VERSION
    identity_label: str | None = None
    identity_score: float | None = None
    identity_model_version: str | None = None


class StubClassifier:
    """Deterministic Fresh/Medium/Spoiled stand-in for local fallback use."""

    def classify(self, image: bytes) -> ClassificationResult:
        idx = sum(image[:64]) % 3 if image else 0
        return ClassificationResult(label=LABELS[idx], score=SCORES[idx])
