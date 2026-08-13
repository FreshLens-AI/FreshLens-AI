from worker.classifier import MODEL_VERSION, StubClassifier


def test_stub_is_deterministic_and_versioned() -> None:
    classifier = StubClassifier()
    first = classifier.classify(b"tomato-scan")
    second = classifier.classify(b"tomato-scan")
    assert first == second
    assert first.model_version == MODEL_VERSION
    assert first.label in {"fresh", "medium", "spoiled"}
    assert 0 <= first.score <= 1


def test_stub_varies_by_image_bytes() -> None:
    classifier = StubClassifier()
    labels = {classifier.classify(bytes([i])).label for i in range(3)}
    assert labels == {"fresh", "medium", "spoiled"}
