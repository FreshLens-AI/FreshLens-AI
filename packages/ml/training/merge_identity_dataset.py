from __future__ import annotations

import argparse
import csv
import hashlib
import json
from collections import Counter
from pathlib import Path

from training.prepare_identity_dataset import ALL_CLASSES, IMAGE_SUFFIXES, _link_or_copy


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Merge identity-v1 with independent training-only images."
    )
    parser.add_argument("--base", type=Path, required=True)
    parser.add_argument("--external-train", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--external-unknown-limit", type=int, default=500)
    return parser.parse_args()


def _images(root: Path, split: str, label: str) -> list[Path]:
    class_root = root / split / label
    if not class_root.is_dir():
        return []
    return sorted(
        path for path in class_root.iterdir() if path.suffix.casefold() in IMAGE_SUFFIXES
    )


def main() -> None:
    args = parse_args()
    if args.output.exists() and any(args.output.iterdir()):
        raise FileExistsError(f"Output directory is not empty: {args.output}")
    args.output.mkdir(parents=True, exist_ok=True)

    rows: list[dict[str, str]] = []
    counts: Counter[tuple[str, str]] = Counter()
    sources = (("base", args.base), ("external", args.external_train))
    for split in ("train", "val", "test"):
        for label in ALL_CLASSES:
            for source_name, source_root in sources:
                if source_name == "external" and split == "test":
                    continue
                images = _images(source_root, split, label)
                if source_name == "external" and label == "unknown":
                    images.sort(
                        key=lambda path: hashlib.sha256(path.name.encode()).digest()
                    )
                    images = images[: args.external_unknown_limit]
                for index, source in enumerate(images):
                    destination = (
                        args.output
                        / split
                        / label
                        / f"{source_name}-{index:05d}-{source.name}"
                    )
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    _link_or_copy(source, destination)
                    counts[(split, label)] += 1
                    rows.append(
                        {
                            "split": split,
                            "class": label,
                            "source_dataset": source_name,
                            "source_path": str(source),
                            "destination": str(destination.relative_to(args.output)),
                        }
                    )

    with (args.output / "manifest.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    summary = {
        "classes": list(ALL_CLASSES),
        "counts": {
            split: {label: counts[(split, label)] for label in ALL_CLASSES}
            for split in ("train", "val", "test")
        },
        "base_summary": json.loads(
            (args.base / "dataset-summary.json").read_text(encoding="utf-8")
        ),
        "external_train_summary": json.loads(
            (args.external_train / "dataset-summary.json").read_text(encoding="utf-8")
        ),
    }
    (args.output / "dataset-summary.json").write_text(
        json.dumps(summary, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(summary["counts"], indent=2))


if __name__ == "__main__":
    main()
