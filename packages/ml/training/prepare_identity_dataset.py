from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import random
import re
import shutil
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path

TARGET_CLASSES = ("banana", "cucumber", "eggplant", "tomato")
ALL_CLASSES = (*TARGET_CLASSES, "unknown")
IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png"}
DEFAULT_SEED = 21


@dataclass(frozen=True)
class Sample:
    source_path: Path
    source_dataset: str
    source_label: str
    canonical_label: str
    group_id: str


def canonical_product(label: str) -> str:
    """Map dataset-specific variety/freshness names to FreshLens labels."""
    normalized = re.sub(r"[_-]+", " ", label).casefold()
    for target in TARGET_CLASSES:
        if target in normalized:
            return target
    return "unknown"


def agrifresh_source_name(filename: str) -> str:
    """Remove the dataset's augmentation prefix while preserving the source name."""
    return re.sub(r"^aug_\d+_", "", filename, flags=re.IGNORECASE)


def split_for_group(group_id: str, seed: int = DEFAULT_SEED) -> str:
    """Return a stable 70/15/15 split for a source-image group."""
    digest = hashlib.sha256(f"{seed}:{group_id}".encode()).digest()
    bucket = int.from_bytes(digest[:4], "big") % 10_000
    if bucket < 7_000:
        return "train"
    if bucket < 8_500:
        return "val"
    return "test"


def discover_fruits360(root: Path) -> list[Sample]:
    samples: list[Sample] = []
    for split_name in ("Training", "Test"):
        split_root = root / split_name
        if not split_root.is_dir():
            continue
        for variety_dir in sorted(path for path in split_root.iterdir() if path.is_dir()):
            canonical = canonical_product(variety_dir.name)
            if canonical == "unknown":
                continue
            for image_path in sorted(variety_dir.iterdir()):
                if image_path.suffix.casefold() not in IMAGE_SUFFIXES:
                    continue
                samples.append(
                    Sample(
                        source_path=image_path,
                        source_dataset="fruits-360",
                        source_label=variety_dir.name,
                        canonical_label=canonical,
                        # Fruits-360 is supplemental training data. The group still
                        # records its capture variety for auditability.
                        group_id=f"fruits-360:{variety_dir.name}:{image_path.stem}",
                    )
                )
    if not samples:
        raise FileNotFoundError(f"No selected Fruits-360 images found below {root}")
    return samples


def discover_agrifresh(root: Path) -> list[Sample]:
    samples: list[Sample] = []
    if (root / "Processed Data").is_dir():
        root = root / "Processed Data"
    for class_dir in sorted(path for path in root.iterdir() if path.is_dir()):
        source_product = canonical_product(class_dir.name)
        # Preserve each non-target product as its own group namespace while
        # training all of them as the open-set rejection class.
        normalized_source = re.sub(r"\([^)]*\)", "", class_dir.name)
        normalized_source = re.sub(
            r"\b(fresh|semi|rotten)\b", "", normalized_source, flags=re.IGNORECASE
        )
        normalized_source = re.sub(r"\s+", " ", normalized_source).strip().casefold()
        for image_path in sorted(class_dir.iterdir()):
            if image_path.suffix.casefold() not in IMAGE_SUFFIXES:
                continue
            original_name = agrifresh_source_name(image_path.name).casefold()
            samples.append(
                Sample(
                    source_path=image_path,
                    source_dataset="agrifreshnet",
                    source_label=class_dir.name,
                    canonical_label=source_product,
                    group_id=f"agrifreshnet:{normalized_source}:{original_name}",
                )
            )
    if not samples:
        raise FileNotFoundError(f"No AgriFreshNET images found below {root}")
    return samples


def _stable_sample(samples: list[Sample], limit: int, seed: int) -> list[Sample]:
    if len(samples) <= limit:
        return sorted(samples, key=lambda sample: str(sample.source_path))
    ordered = sorted(samples, key=lambda sample: str(sample.source_path))
    random.Random(seed).shuffle(ordered)
    return ordered[:limit]


def select_samples(
    fruits360: list[Sample],
    agrifresh: list[Sample],
    *,
    train_limit: int,
    eval_limit: int,
    seed: int,
) -> dict[str, list[Sample]]:
    """Balance classes while reserving realistic AgriFresh images for evaluation."""
    selected: dict[str, list[Sample]] = {split: [] for split in ("train", "val", "test")}
    agri_by_split_class: dict[tuple[str, str], list[Sample]] = defaultdict(list)
    for sample in agrifresh:
        agri_by_split_class[(split_for_group(sample.group_id, seed), sample.canonical_label)].append(
            sample
        )

    fruit_by_class: dict[str, list[Sample]] = defaultdict(list)
    for sample in fruits360:
        fruit_by_class[sample.canonical_label].append(sample)

    for class_index, label in enumerate(ALL_CLASSES):
        train_agri = _stable_sample(
            agri_by_split_class[("train", label)], train_limit, seed + class_index
        )
        remaining = max(0, train_limit - len(train_agri))
        train_fruits = _stable_sample(
            fruit_by_class[label], remaining, seed + 100 + class_index
        )
        selected["train"].extend((*train_agri, *train_fruits))
        for split_index, split in enumerate(("val", "test"), start=1):
            selected[split].extend(
                _stable_sample(
                    agri_by_split_class[(split, label)],
                    eval_limit,
                    seed + split_index * 1000 + class_index,
                )
            )
    return selected


def _link_or_copy(source: Path, destination: Path) -> None:
    try:
        os.link(source, destination)
    except OSError:
        shutil.copy2(source, destination)


def write_dataset(output: Path, selected: dict[str, list[Sample]], seed: int) -> None:
    if output.exists() and any(output.iterdir()):
        raise FileExistsError(
            f"Output directory is not empty: {output}. Choose a new path to preserve prior runs."
        )
    output.mkdir(parents=True, exist_ok=True)
    manifest_rows: list[dict[str, str]] = []
    for split, samples in selected.items():
        for sample in samples:
            class_dir = output / split / sample.canonical_label
            class_dir.mkdir(parents=True, exist_ok=True)
            relative_source = str(sample.source_path)
            digest = hashlib.sha256(relative_source.encode()).hexdigest()[:16]
            destination = class_dir / f"{sample.source_dataset}-{digest}{sample.source_path.suffix.lower()}"
            _link_or_copy(sample.source_path, destination)
            manifest_rows.append(
                {
                    "split": split,
                    "class": sample.canonical_label,
                    "destination": str(destination.relative_to(output)),
                    "source_dataset": sample.source_dataset,
                    "source_label": sample.source_label,
                    "source_path": relative_source,
                    "group_id": sample.group_id,
                }
            )

    with (output / "manifest.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(manifest_rows[0]))
        writer.writeheader()
        writer.writerows(manifest_rows)

    counts = Counter((row["split"], row["class"]) for row in manifest_rows)
    group_splits: dict[str, set[str]] = defaultdict(set)
    for row in manifest_rows:
        group_splits[row["group_id"]].add(row["split"])
    leaking_groups = sorted(group for group, splits in group_splits.items() if len(splits) > 1)
    if leaking_groups:
        raise RuntimeError(f"Source groups crossed dataset splits: {leaking_groups[:5]}")

    summary = {
        "seed": seed,
        "classes": list(ALL_CLASSES),
        "counts": {
            split: {label: counts[(split, label)] for label in ALL_CLASSES}
            for split in ("train", "val", "test")
        },
        "unique_source_groups": len(group_splits),
        "sources": {
            "fruits-360": {
                "license": "CC BY-SA 4.0",
                "url": "https://github.com/fruits-360/fruits-360-100x100",
            },
            "agrifreshnet": {
                "license": "CC BY 4.0",
                "doi": "10.17632/42m5tb7yv9.1",
            },
        },
    }
    (output / "dataset-summary.json").write_text(
        json.dumps(summary, indent=2) + "\n", encoding="utf-8"
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Prepare the FreshLens identity-v1 dataset.")
    parser.add_argument("--fruits360-root", type=Path, required=True)
    parser.add_argument("--agrifresh-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--train-limit", type=int, default=1_500)
    parser.add_argument("--eval-limit", type=int, default=350)
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.train_limit < 1 or args.eval_limit < 1:
        raise ValueError("Sample limits must be positive.")
    fruits360 = discover_fruits360(args.fruits360_root)
    agrifresh = discover_agrifresh(args.agrifresh_root)
    selected = select_samples(
        fruits360,
        agrifresh,
        train_limit=args.train_limit,
        eval_limit=args.eval_limit,
        seed=args.seed,
    )
    write_dataset(args.output, selected, args.seed)
    print((args.output / "dataset-summary.json").read_text(encoding="utf-8"))


if __name__ == "__main__":
    main()
