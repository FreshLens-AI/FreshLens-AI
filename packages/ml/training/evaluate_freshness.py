from __future__ import annotations

import argparse
import csv
import json
from collections import Counter, defaultdict
from pathlib import Path

EXPECTED_LABELS = ("fresh", "medium", "spoiled")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Evaluate freshness-v1.")
    parser.add_argument("--weights", type=Path, required=True)
    parser.add_argument("--data", type=Path, required=True)
    parser.add_argument("--split", choices=("val", "test"), default="test")
    parser.add_argument("--imgsz", type=int, default=224)
    parser.add_argument("--batch", type=int, default=64)
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--confidence-threshold", type=float, default=0.0)
    parser.add_argument(
        "--threshold-sweep",
        type=float,
        nargs="*",
        default=(0.0, 0.5, 0.6, 0.7),
        help="Additional rejection thresholds to score from the same inference pass.",
    )
    parser.add_argument("--output", type=Path, required=True)
    return parser.parse_args()


def _divide(numerator: int, denominator: int) -> float:
    return numerator / denominator if denominator else 0.0


def _metrics(truth: list[str], predicted: list[str]) -> dict[str, object]:
    confusion = Counter(zip(truth, predicted, strict=True))
    per_class: dict[str, dict[str, float | int]] = {}
    for label in EXPECTED_LABELS:
        tp = confusion[(label, label)]
        fp = sum(confusion[(actual, label)] for actual in EXPECTED_LABELS if actual != label)
        fn = sum(confusion[(label, other)] for other in (*EXPECTED_LABELS, "uncertain") if other != label)
        precision = _divide(tp, tp + fp)
        recall = _divide(tp, tp + fn)
        f1 = _divide(2 * precision * recall, precision + recall)
        per_class[label] = {
            "support": sum(actual == label for actual in truth),
            "precision": precision,
            "recall": recall,
            "f1": f1,
        }
    correct = sum(a == p for a, p in zip(truth, predicted, strict=True))
    accepted = sum(p != "uncertain" for p in predicted)
    accepted_correct = sum(
        a == p for a, p in zip(truth, predicted, strict=True) if p != "uncertain"
    )
    severe = sum(
        (a == "fresh" and p == "spoiled") or (a == "spoiled" and p == "fresh")
        for a, p in zip(truth, predicted, strict=True)
    )
    return {
        "samples": len(truth),
        "accuracy": _divide(correct, len(truth)),
        "macro_f1": sum(float(item["f1"]) for item in per_class.values()) / 3,
        "coverage": _divide(accepted, len(truth)),
        "accepted_accuracy": _divide(accepted_correct, accepted),
        "severe_error_rate": _divide(severe, len(truth)),
        "per_class": per_class,
        "confusion_matrix": {
            actual: {
                output: confusion[(actual, output)]
                for output in (*EXPECTED_LABELS, "uncertain")
            }
            for actual in EXPECTED_LABELS
        },
    }


def main() -> None:
    from ultralytics import YOLO

    args = parse_args()
    manifest_rows = list(
        csv.DictReader((args.data / "manifest.csv").open(encoding="utf-8"))
    )
    selected = [row for row in manifest_rows if row["split"] == args.split]
    if not selected:
        raise FileNotFoundError(f"No manifest rows for split {args.split}")

    paths = [args.data / row["destination"] for row in selected]
    truth = [row["class"] for row in selected]
    products = [row["product"] for row in selected]
    raw_predictions: list[str] = []
    confidences: list[float] = []
    inference_ms: list[float] = []
    results = YOLO(str(args.weights)).predict(
        source=[str(path) for path in paths],
        imgsz=args.imgsz,
        batch=args.batch,
        device=args.device,
        verbose=False,
        stream=True,
    )
    for result in results:
        if result.probs is None:
            raise RuntimeError("Freshness classifier returned no probabilities.")
        confidence = float(result.probs.top1conf)
        label = str(result.names[int(result.probs.top1)]).casefold()
        raw_predictions.append(label)
        confidences.append(confidence)
        inference_ms.append(float(result.speed.get("inference", 0.0)))

    predictions = [
        label if confidence >= args.confidence_threshold else "uncertain"
        for label, confidence in zip(raw_predictions, confidences, strict=True)
    ]
    per_product_rows: dict[str, tuple[list[str], list[str]]] = defaultdict(
        lambda: ([], [])
    )
    for product, actual, predicted in zip(products, truth, predictions, strict=True):
        per_product_rows[product][0].append(actual)
        per_product_rows[product][1].append(predicted)

    sweep: dict[str, dict[str, object]] = {}
    for threshold in sorted(set(args.threshold_sweep)):
        threshold_predictions = [
            label if confidence >= threshold else "uncertain"
            for label, confidence in zip(raw_predictions, confidences, strict=True)
        ]
        threshold_metrics = _metrics(truth, threshold_predictions)
        sweep[f"{threshold:.2f}"] = {
            key: threshold_metrics[key]
            for key in (
                "accuracy",
                "macro_f1",
                "coverage",
                "accepted_accuracy",
                "severe_error_rate",
            )
        }

    metrics = {
        "weights": str(args.weights.resolve()),
        "split": args.split,
        "confidence_threshold": args.confidence_threshold,
        "mean_top1_confidence": sum(confidences) / len(confidences),
        "mean_inference_ms": sum(inference_ms) / len(inference_ms),
        "threshold_sweep": sweep,
        **_metrics(truth, predictions),
        "per_product": {
            product: _metrics(actual, predicted)
            for product, (actual, predicted) in sorted(per_product_rows.items())
        },
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(metrics, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(metrics, indent=2))


if __name__ == "__main__":
    main()
