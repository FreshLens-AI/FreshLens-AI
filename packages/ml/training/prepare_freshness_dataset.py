from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import re
import shutil
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path

from training.prepare_identity_dataset import (
    DEFAULT_SEED,
    IMAGE_SUFFIXES,
    TARGET_CLASSES,
    agrifresh_source_name,
    canonical_product,
    split_for_group,
)

FRESHNESS_CLASSES = ("fresh", "medium", "spoiled")


@dataclass(frozen=True)
class FreshnessSample:
    source_path: Path
    source_label: str
    product: str
    freshness: str
    group_id: str
    sha256: str
    is_augmented: bool


def canonical_freshness(label: str) -> str | None:
    normalized = re.sub(r"[_-]+", " ", label).casefold()
    if "semi" in normalized and "fresh" in normalized:
        return "medium"
    if "rotten" in normalized:
        return "spoiled"
    if "fresh" in normalized:
        return "fresh"
    return None


def _digest(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def discover_agrifresh_freshness(root: Path) -> list[FreshnessSample]:
    if (root / "Processed Data").is_dir():
        root = root / "Processed Data"
    samples: list[FreshnessSample] = []
    for class_dir in sorted(path for path in root.iterdir() if path.is_dir()):
        product = canonical_product(class_dir.name)
        freshness = canonical_freshness(class_dir.name)
        if product not in TARGET_CLASSES or freshness is None:
            continue
        for image_path in sorted(class_dir.iterdir()):
            if image_path.suffix.casefold() not in IMAGE_SUFFIXES:
                continue
            original_name = agrifresh_source_name(image_path.name).casefold()
            samples.append(
                FreshnessSample(
                    source_path=image_path,
                    source_label=class_dir.name,
                    product=product,
                    freshness=freshness,
                    # Do not include freshness in the group. A source filename
                    # reused across stages must stay on one side of the split.
                    group_id=f"agrifreshnet:{product}:{original_name}",
                    sha256=_digest(image_path),
                    is_augmented=bool(re.match(r"^aug_\d+_", image_path.name, re.I)),
                )
            )
    if not samples:
        raise FileNotFoundError(f"No supported freshness images found below {root}")
    return samples


def deduplicate(samples: list[FreshnessSample]) -> tuple[list[FreshnessSample], int]:
    by_hash: dict[str, FreshnessSample] = {}
    for sample in sorted(samples, key=lambda item: (item.is_augmented, str(item.source_path))):
        existing = by_hash.get(sample.sha256)
        if existing is None:
            by_hash[sample.sha256] = sample
            continue
        if (existing.product, existing.freshness) != (sample.product, sample.freshness):
            raise ValueError(
                "Identical image bytes have conflicting labels: "
                f"{existing.source_path} and {sample.source_path}"
            )
    unique = sorted(by_hash.values(), key=lambda item: str(item.source_path))
    return unique, len(samples) - len(unique)


def select_splits(
    samples: list[FreshnessSample], seed: int = DEFAULT_SEED
) -> dict[str, list[FreshnessSample]]:
    selected: dict[str, list[FreshnessSample]] = {
        "train": [],
        "val": [],
        "test": [],
    }
    for sample in samples:
        split = split_for_group(sample.group_id, seed)
        # Processed_Data contains offline augmentation. It is useful for
        # training, but evaluation must contain source photos only.
        if split != "train" and sample.is_augmented:
            continue
        selected[split].append(sample)
    return selected


def _link_or_copy(source: Path, destination: Path) -> None:
    try:
        os.link(source, destination)
    except OSError:
        shutil.copy2(source, destination)


def write_dataset(
    output: Path,
    selected: dict[str, list[FreshnessSample]],
    *,
    seed: int,
    duplicates_removed: int,
) -> None:
    if output.exists() and any(output.iterdir()):
        raise FileExistsError(
            f"Output directory is not empty: {output}. Choose a new versioned path."
        )
    output.mkdir(parents=True, exist_ok=True)
    rows: list[dict[str, str]] = []
    for split, samples in selected.items():
        for sample in samples:
            class_dir = output / split / sample.freshness
            class_dir.mkdir(parents=True, exist_ok=True)
            destination = class_dir / f"agrifresh-{sample.sha256[:20]}{sample.source_path.suffix.lower()}"
            _link_or_copy(sample.source_path, destination)
            rows.append(
                {
                    "split": split,
                    "class": sample.freshness,
                    "product": sample.product,
                    "destination": str(destination.relative_to(output)),
                    "source_dataset": "agrifreshnet",
                    "source_label": sample.source_label,
                    "source_path": str(sample.source_path),
                    "group_id": sample.group_id,
                    "sha256": sample.sha256,
                    "is_augmented": str(sample.is_augmented).lower(),
                }
            )
    if not rows:
        raise RuntimeError("Freshness selection produced no images.")

    with (output / "manifest.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)

    group_splits: dict[str, set[str]] = defaultdict(set)
    for row in rows:
        group_splits[row["group_id"]].add(row["split"])
    leaking = [group for group, splits in group_splits.items() if len(splits) > 1]
    if leaking:
        raise RuntimeError(f"Source groups crossed dataset splits: {leaking[:5]}")

    counts = Counter((row["split"], row["class"]) for row in rows)
    product_counts = Counter(
        (row["split"], row["product"], row["class"]) for row in rows
    )
    summary = {
        "seed": seed,
        "classes": list(FRESHNESS_CLASSES),
        "products": list(TARGET_CLASSES),
        "counts": {
            split: {label: counts[(split, label)] for label in FRESHNESS_CLASSES}
            for split in ("train", "val", "test")
        },
        "product_class_counts": {
            split: {
                product: {
                    label: product_counts[(split, product, label)]
                    for label in FRESHNESS_CLASSES
                }
                for product in TARGET_CLASSES
            }
            for split in ("train", "val", "test")
        },
        "unique_source_groups": len(group_splits),
        "exact_duplicates_removed": duplicates_removed,
        "evaluation_policy": "Validation and test contain unaugmented source photos only.",
        "source": {
            "name": "AgriFreshNET",
            "license": "CC BY 4.0",
            "doi": "10.17632/42m5tb7yv9.1",
            "url": "https://data.mendeley.com/datasets/42m5tb7yv9/1",
        },
    }
    (output / "dataset-summary.json").write_text(
        json.dumps(summary, indent=2) + "\n", encoding="utf-8"
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Prepare FreshLens freshness-v1.")
    parser.add_argument("--agrifresh-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    discovered = discover_agrifresh_freshness(args.agrifresh_root)
    unique, duplicates_removed = deduplicate(discovered)
    selected = select_splits(unique, args.seed)
    write_dataset(
        args.output,
        selected,
        seed=args.seed,
        duplicates_removed=duplicates_removed,
    )
    print((args.output / "dataset-summary.json").read_text(encoding="utf-8"))


if __name__ == "__main__":
    main()
