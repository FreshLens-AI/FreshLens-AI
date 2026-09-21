from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Evaluate identity-v1 on a held-out split.")
    parser.add_argument("--weights", type=Path, required=True)
    parser.add_argument("--data", type=Path, required=True)
    parser.add_argument("--split", choices=("val", "test"), default="test")
    parser.add_argument("--imgsz", type=int, default=224)
    parser.add_argument("--batch", type=int, default=64)
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--confidence-threshold", type=float, default=0.0)
    parser.add_argument("--output", type=Path, required=True)
    return parser.parse_args()


def _safe_divide(numerator: int, denominator: int) -> float:
    return numerator / denominator if denominator else 0.0


def main() -> None:
    from ultralytics import YOLO

    args = parse_args()
    split_root = args.data / args.split
    paths: list[Path] = []
    truth: list[str] = []
    for class_dir in sorted(path for path in split_root.iterdir() if path.is_dir()):
        for image_path in sorted(class_dir.iterdir()):
            paths.append(image_path)
            truth.append(class_dir.name)
    if not paths:
        raise FileNotFoundError(f"No evaluation images found in {split_root}")

    model = YOLO(str(args.weights))
    predictions: list[str] = []
    confidences: list[float] = []
    inference_ms: list[float] = []
    results = model.predict(
        source=[str(path) for path in paths],
        imgsz=args.imgsz,
        batch=args.batch,
        device=args.device,
        verbose=False,
        stream=True,
    )
    for result in results:
        if result.probs is None:
            raise RuntimeError("Classifier returned no probabilities.")
        confidence = float(result.probs.top1conf)
        label = str(result.names[int(result.probs.top1)]).casefold()
        if confidence < args.confidence_threshold:
            label = "unknown"
        predictions.append(label)
        confidences.append(confidence)
        inference_ms.append(float(result.speed.get("inference", 0.0)))

    labels = sorted(set(truth) | set(predictions))
    confusion = Counter(zip(truth, predictions, strict=True))
    per_class: dict[str, dict[str, float | int]] = {}
    for label in labels:
        tp = confusion[(label, label)]
        fp = sum(confusion[(actual, label)] for actual in labels if actual != label)
        fn = sum(confusion[(label, predicted)] for predicted in labels if predicted != label)
        precision = _safe_divide(tp, tp + fp)
        recall = _safe_divide(tp, tp + fn)
        f1 = _safe_divide(2 * precision * recall, precision + recall)
        per_class[label] = {
            "support": sum(confusion[(label, predicted)] for predicted in labels),
            "precision": precision,
            "recall": recall,
            "f1": f1,
        }

    correct = sum(actual == predicted for actual, predicted in zip(truth, predictions, strict=True))
    unknown_total = sum(actual == "unknown" for actual in truth)
    unknown_false_accepts = sum(
        actual == "unknown" and predicted != "unknown"
        for actual, predicted in zip(truth, predictions, strict=True)
    )
    metrics = {
        "weights": str(args.weights.resolve()),
        "split": args.split,
        "samples": len(truth),
        "accuracy": correct / len(truth),
        "macro_f1": sum(float(values["f1"]) for values in per_class.values())
        / len(per_class),
        "unknown_false_accept_rate": _safe_divide(unknown_false_accepts, unknown_total),
        "mean_top1_confidence": sum(confidences) / len(confidences),
        "mean_inference_ms": sum(inference_ms) / len(inference_ms),
        "confidence_threshold": args.confidence_threshold,
        "per_class": per_class,
        "confusion_matrix": {
            actual: {predicted: confusion[(actual, predicted)] for predicted in labels}
            for actual in labels
        },
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(metrics, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(metrics, indent=2))


if __name__ == "__main__":
    main()
