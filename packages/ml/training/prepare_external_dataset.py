from __future__ import annotations

import argparse
import csv
import hashlib
import json
from collections import Counter
from pathlib import Path

from training.prepare_identity_dataset import ALL_CLASSES, TARGET_CLASSES

SOURCE_LABELS = (
    "apple",
    "banana",
    "beetroot",
    "bell pepper",
    "cabbage",
    "capsicum",
    "carrot",
    "cauliflower",
    "chilli pepper",
    "corn",
    "cucumber",
    "eggplant",
    "garlic",
    "ginger",
    "grapes",
    "jalepeno",
    "kiwi",
    "lemon",
    "lettuce",
    "mango",
    "onion",
    "orange",
    "paprika",
    "pear",
    "peas",
    "pineapple",
    "pomegranate",
    "potato",
    "raddish",
    "soy beans",
    "spinach",
    "sweetcorn",
    "sweetpotato",
    "tomato",
    "turnip",
    "watermelon",
)


def canonical_label(label_index: int) -> tuple[str, str]:
    source_label = SOURCE_LABELS[label_index]
    canonical = source_label if source_label in TARGET_CLASSES else "unknown"
    return source_label, canonical


def output_split_for_digest(
    source_split: str, digest: str, validation_percent: int
) -> str:
    if source_split != "train" or validation_percent == 0:
        return source_split
    bucket = int(digest[:8], 16) % 100
    return "val" if bucket < validation_percent else "train"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Export the independent Kaggle/Hugging Face produce dataset."
    )
    parser.add_argument("--parquet", type=Path, nargs="+", required=True)
    parser.add_argument("--split", choices=("train", "test"), required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--validation-percent", type=int, default=20)
    parser.add_argument("--exclude-manifest", type=Path)
    return parser.parse_args()


def main() -> None:
    import polars as pl

    args = parse_args()
    if args.output.exists() and any(args.output.iterdir()):
        raise FileExistsError(f"Output directory is not empty: {args.output}")
    if not 0 <= args.validation_percent < 100:
        raise ValueError("validation-percent must be between 0 and 99.")
    args.output.mkdir(parents=True, exist_ok=True)

    rows: list[dict[str, str]] = []
    counts: Counter[tuple[str, str]] = Counter()
    excluded_hashes: set[str] = set()
    if args.exclude_manifest:
        with args.exclude_manifest.open(encoding="utf-8", newline="") as handle:
            excluded_hashes = {row["sha256"] for row in csv.DictReader(handle)}
    seen_hashes: set[str] = set()
    excluded_count = 0
    duplicate_count = 0
    index = 0
    for parquet in args.parquet:
        frame = pl.read_parquet(parquet, columns=("image", "label"))
        for row in frame.iter_rows(named=True):
            source_label, canonical = canonical_label(int(row["label"]))
            image = row["image"]
            payload = image["bytes"]
            source_path = image.get("path") or f"row-{index}.jpg"
            suffix = Path(source_path).suffix.casefold() or ".jpg"
            digest = hashlib.sha256(payload).hexdigest()
            if digest in excluded_hashes:
                excluded_count += 1
                index += 1
                continue
            if digest in seen_hashes:
                duplicate_count += 1
                index += 1
                continue
            seen_hashes.add(digest)
            output_split = output_split_for_digest(
                args.split, digest, args.validation_percent
            )
            destination = (
                Path(output_split) / canonical / f"{index:04d}-{digest[:20]}{suffix}"
            )
            full_destination = args.output / destination
            full_destination.parent.mkdir(parents=True, exist_ok=True)
            full_destination.write_bytes(payload)
            counts[(output_split, canonical)] += 1
            rows.append(
                {
                    "split": output_split,
                    "destination": str(destination),
                    "source_label": source_label,
                    "canonical_label": canonical,
                    "source_path": source_path,
                    "sha256": digest,
                }
            )
            index += 1

    with (args.output / "manifest.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    summary = {
        "source": "Nattakarn/fruit-and-vegetable-image-recognition",
        "upstream": "kritikseth/fruit-and-vegetable-image-recognition",
        "license": "CC0: Public Domain",
        "source_split": f"upstream {args.split}",
        "classes": list(ALL_CLASSES),
        "excluded_against_manifest": excluded_count,
        "duplicate_rows_removed": duplicate_count,
        "counts": {
            split: {label: counts[(split, label)] for label in ALL_CLASSES}
            for split in ("train", "val", "test")
            if any(counts[(split, label)] for label in ALL_CLASSES)
        },
    }
    (args.output / "dataset-summary.json").write_text(
        json.dumps(summary, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
