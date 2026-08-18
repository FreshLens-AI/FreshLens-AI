import pytest

from training.evaluate_freshness import _metrics


def test_metrics_treats_rejected_predictions_as_uncovered() -> None:
    metrics = _metrics(
        ["fresh", "medium", "spoiled"],
        ["fresh", "uncertain", "fresh"],
    )

    assert metrics["accuracy"] == pytest.approx(1 / 3)
    assert metrics["coverage"] == pytest.approx(2 / 3)
    assert metrics["accepted_accuracy"] == pytest.approx(1 / 2)
    assert metrics["severe_error_rate"] == pytest.approx(1 / 3)
    assert metrics["confusion_matrix"]["medium"]["uncertain"] == 1
