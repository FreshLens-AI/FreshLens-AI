from __future__ import annotations

import argparse
import hashlib
import json
from datetime import UTC, datetime
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train FreshLens FL-2TC Identity Classifier (Model 1).")
    parser.add_argument("--data", type=Path, required=True, help="Path to identity dataset directory (with train/val/test).")
    parser.add_argument("--model", default="yolo11s-cls.pt", help="Base model checkpoint (e.g. yolo11s-cls.pt, yolo11n-cls.pt).")
    parser.add_argument("--epochs", type=int, default=80)
    parser.add_argument("--imgsz", type=int, default=224)
    parser.add_argument("--batch", type=int, default=64)
    parser.add_argument("--lr0", type=float, default=0.01, help="Initial learning rate.")
    parser.add_argument("--patience", type=int, default=15)
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--device", default="0")
    parser.add_argument("--seed", type=int, default=21)
    parser.add_argument("--project", type=Path, default=Path("runs/identity"))
    parser.add_argument("--name", default="identity-yolo11s-cls-v2")
    return parser.parse_args()


def main() -> None:
    import torch
    from ultralytics import YOLO, __version__ as ultralytics_version

    args = parse_args()
    for split in ("train", "val", "test"):
        if not (args.data / split).is_dir():
            raise FileNotFoundError(f"Missing dataset split: {args.data / split}")

    model = YOLO(args.model)
    model.train(
        data=str(args.data.resolve()),
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        lr0=args.lr0,
        lrf=0.01,
        cos_lr=True,
        label_smoothing=0.05,
        patience=args.patience,
        workers=args.workers,
        device=args.device,
        seed=args.seed,
        project=str(args.project.resolve()),
        name=args.name,
        exist_ok=False,
        plots=True,
        # Produce-adapted augmentations
        degrees=15,
        translate=0.1,
        scale=0.15,
        fliplr=0.5,
        flipud=0.0,
    )
    run_dir = Path(model.trainer.save_dir)
    best_weights = run_dir / "weights" / "best.pt"
    summary_path = args.data / "dataset-summary.json"
    summary_data = json.loads(summary_path.read_text(encoding="utf-8")) if summary_path.exists() else {}

    metadata = {
        "model_version": args.name,
        "base_model": args.model,
        "dataset": str(args.data.resolve()),
        "dataset_summary": summary_data,
        "ultralytics_version": ultralytics_version,
        "torch_version": torch.__version__,
        "checkpoint": {
            "filename": best_weights.name,
            "size_bytes": best_weights.stat().st_size if best_weights.exists() else 0,
            "sha256": hashlib.sha256(best_weights.read_bytes()).hexdigest() if best_weights.exists() else "",
        },
        "completed_at": datetime.now(UTC).isoformat(),
        "arguments": vars(args) | {"data": str(args.data), "project": str(args.project)},
    }
    (run_dir / "freshlens-model.json").write_text(
        json.dumps(metadata, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Identity training complete. Best weights: {best_weights}")


if __name__ == "__main__":
    main()
