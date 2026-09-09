"""Unified FL-2TC evaluation suite for Identity (Model 1) and Freshness (Model 2).

Generates comprehensive evaluation metrics, confusion matrices, latency benchmarks,
and JSON artifacts matching the FreshLens model metadata schema.
"""

from __future__ import annotations

import argparse
import json
import statistics
import time
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

IDENTITY_CLASSES = ("banana", "cucumber", "eggplant", "tomato", "unknown")
FRESHNESS_CLASSES = ("fresh", "medium", "spoiled")


def divide(numerator: float, denominator: float) -> float:
    return numerator / denominator if denominator else 0.0


def evaluate_classifier(
    weights_path: Path,
    dataset_split_dir: Path,
    expected_classes: tuple[str, ...],
    imgsz: int = 224,
    device: str = "cpu",
    batch: int = 32,
    confidence_threshold: float = 0.0,
    is_freshness: bool = False,
) -> dict[str, Any]:
    from ultralytics import YOLO

    model = YOLO(str(weights_path))

    # Collect image paths and ground truths
    image_paths: list[Path] = []
    ground_truths: list[str] = []

    for cls_name in expected_classes:
        cls_dir = dataset_split_dir / cls_name
        if not cls_dir.is_dir():
            continue
        for img in cls_dir.iterdir():
            if img.suffix.casefold() in {".jpg", ".jpeg", ".png", ".webp", ".bmp"}:
                image_paths.append(img)
                ground_truths.append(cls_name)

    if not image_paths:
        raise FileNotFoundError(f"No images found in {dataset_split_dir}")

    total_samples = len(image_paths)
    predictions: list[str] = []
    raw_predictions: list[str] = []
    confidences: list[float] = []
    latencies_ms: list[float] = []

    print(f"Evaluating {weights_path.name} on {total_samples} samples ({dataset_split_dir})...")

    # Run batched inference and measure latency
    for i in range(0, total_samples, batch):
        batch_paths = [str(p) for p in image_paths[i : i + batch]]
        t0 = time.perf_counter()
        results = model.predict(
            source=batch_paths,
            imgsz=imgsz,
            device=device,
            verbose=False,
        )
        batch_duration_ms = (time.perf_counter() - t0) * 1000.0
        per_item_ms = batch_duration_ms / len(batch_paths)

        for res in results:
            top1_idx = int(res.probs.top1)
            raw_label = str(res.names[top1_idx]).strip().lower()
            conf = float(res.probs.top1conf)

            raw_predictions.append(raw_label)
            confidences.append(conf)
            latencies_ms.append(per_item_ms)

            # Apply confidence rejection threshold
            if conf >= confidence_threshold:
                predictions.append(raw_label)
            else:
                predictions.append("uncertain")

    # Metrics computation
    confusion = Counter(zip(ground_truths, predictions, strict=True))
    per_class: dict[str, dict[str, Any]] = {}

    for cls_name in expected_classes:
        tp = confusion[(cls_name, cls_name)]
        fp = sum(confusion[(actual, cls_name)] for actual in expected_classes if actual != cls_name)
        fn = sum(confusion[(cls_name, other)] for other in (*expected_classes, "uncertain") if other != cls_name)
        support = sum(1 for a in ground_truths if a == cls_name)

        p = divide(tp, tp + fp)
        r = divide(tp, tp + fn)
        f1 = divide(2 * p * r, p + r)

        per_class[cls_name] = {
            "support": support,
            "precision": round(p, 4),
            "recall": round(r, 4),
            "f1": round(f1, 4),
        }

    correct = sum(1 for a, p in zip(ground_truths, predictions) if a == p)
    accepted = sum(1 for p in predictions if p != "uncertain")
    accepted_correct = sum(1 for a, p in zip(ground_truths, predictions) if a == p and p != "uncertain")

    metrics: dict[str, Any] = {
        "model_file": weights_path.name,
        "split_dir": str(dataset_split_dir),
        "samples": total_samples,
        "overall_accuracy": round(divide(correct, total_samples), 4),
        "macro_f1": round(
            sum(per_class[c]["f1"] for c in expected_classes if per_class[c]["support"] > 0)
            / len([c for c in expected_classes if per_class[c]["support"] > 0]),
            4,
        ),
        "coverage": round(divide(accepted, total_samples), 4),
        "accepted_accuracy": round(divide(accepted_correct, accepted), 4),
        "mean_confidence": round(statistics.mean(confidences), 4),
        "mean_latency_ms": round(statistics.mean(latencies_ms), 2),
        "per_class": per_class,
        "confusion_matrix": {
            actual: {pred: confusion[(actual, pred)] for pred in (*expected_classes, "uncertain")}
            for actual in expected_classes
        },
    }

    if is_freshness:
        # Severe error rate: Fresh predicted as Spoiled or Spoiled predicted as Fresh
        severe_errors = sum(
            1 for a, p in zip(ground_truths, predictions)
            if (a == "fresh" and p == "spoiled") or (a == "spoiled" and p == "fresh")
        )
        metrics["severe_fresh_spoiled_error_rate"] = round(divide(severe_errors, total_samples), 4)

    return metrics


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate trained FreshLens FL-2TC models.")
    parser.add_argument("--identity-weights", type=Path, default=None)
    parser.add_argument("--freshness-weights", type=Path, default=None)
    parser.add_argument("--dataset-dir", type=Path, required=True, help="Root dir of prepared datasets.")
    parser.add_argument("--split", choices=("val", "test"), default="test")
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--output-dir", type=Path, default=Path("runs/eval"))
    args = parser.parse_args()

    args.output_dir.mkdir(parents=True, exist_ok=True)
    all_results: dict[str, Any] = {}

    if args.identity_weights and args.identity_weights.exists():
        id_split_dir = args.dataset_dir / "identity" / args.split
        id_metrics = evaluate_classifier(
            weights_path=args.identity_weights,
            dataset_split_dir=id_split_dir,
            expected_classes=IDENTITY_CLASSES,
            confidence_threshold=0.75,
            device=args.device,
            is_freshness=False,
        )
        id_out = args.output_dir / f"identity-{args.split}-metrics.json"
        id_out.write_text(json.dumps(id_metrics, indent=2) + "\n", encoding="utf-8")
        print(f"Identity metrics saved to {id_out}")
        all_results["identity"] = id_metrics

    if args.freshness_weights and args.freshness_weights.exists():
        fresh_split_dir = args.dataset_dir / "freshness" / args.split
        fresh_metrics = evaluate_classifier(
            weights_path=args.freshness_weights,
            dataset_split_dir=fresh_split_dir,
            expected_classes=FRESHNESS_CLASSES,
            confidence_threshold=0.50,
            device=args.device,
            is_freshness=True,
        )
        fresh_out = args.output_dir / f"freshness-{args.split}-metrics.json"
        fresh_out.write_text(json.dumps(fresh_metrics, indent=2) + "\n", encoding="utf-8")
        print(f"Freshness metrics saved to {fresh_out}")
        all_results["freshness"] = fresh_metrics

    summary_file = args.output_dir / f"fl2tc-{args.split}-summary.json"
    summary_file.write_text(json.dumps(all_results, indent=2) + "\n", encoding="utf-8")
    print(f"\nComprehensive FL-2TC evaluation report saved to {summary_file}")


if __name__ == "__main__":
    main()
