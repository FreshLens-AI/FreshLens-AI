from dataclasses import dataclass

LABELS = ("fresh", "medium", "spoiled")
SCORES = (0.91, 0.64, 0.22)
MODEL_VERSION = "stub-v0"


@dataclass(frozen=True)
class ClassificationResult:
    label: str
    score: float
    model_version: str = MODEL_VERSION


class StubClassifier:
    """Deterministic Fresh/Medium/Spoiled stand-in. Replace with FL-2TC in M4."""

    def classify(self, image: bytes) -> ClassificationResult:
        idx = sum(image[:64]) % 3 if image else 0
        return ClassificationResult(label=LABELS[idx], score=SCORES[idx])
