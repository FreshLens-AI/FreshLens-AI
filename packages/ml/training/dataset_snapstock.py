"""Hugging Face dataset preparation pipeline for FreshLens FL-2TC.

Downloads and formats the SnapStock-AI freshness dataset
(https://huggingface.co/datasets/SnapStock-AI/snapstock-freshness-dataset-v2)
based on the Fahad et al. (CMC 2022) 3-stage freshness taxonomy.

Produces two clean Ultralytics YOLO-cls dataset directories:
1. Identity: banana, cucumber, eggplant, tomato, unknown
2. Freshness: fresh, medium, spoiled
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import re
import shutil
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any

TARGET_PRODUCTS = ("banana", "cucumber", "eggplant", "tomato")
IDENTITY_CLASSES = (*TARGET_PRODUCTS, "unknown")
FRESHNESS_CLASSES = ("fresh", "medium", "spoiled")
IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
DEFAULT_SEED = 21


@dataclass(frozen=True)
class DatasetSample:
    source_path: Path
    filename: str
    product: str
    freshness: str | None
    is_target_product: bool
    sha256: str
    group_id: str


def parse_product(name: str) -> str:
    """Extract and normalize produce commodity name."""
    clean = re.sub(r"[_\-0-9]+", " ", name).casefold()
    tokens = set(clean.split())
    # Map brinjal / aubergine to eggplant
    if "brinjal" in tokens or "brinjal" in clean or "aubergine" in tokens or "aubergine" in clean:
        return "eggplant"
    for target in TARGET_PRODUCTS:
        if target in tokens or target in clean:
            return target
    # Handle chillies spelling variations (e.g. chilllies with 3 L's, chilli, chili)
    if "chilli" in clean or "chili" in clean or "chilllie" in clean:
        return "chillies"
    # Recognize common non-target fruits/vegetables as negative samples
    other_produce = (
        "apple", "orange", "potato", "capsicum", "pepper", "bell pepper",
        "guava", "lime", "lemon", "pomegranate", "strawberry", "mango",
        "carrot", "onion", "cabbage", "broccoli"
    )
    for other in other_produce:
        if other in clean:
            if other in ("capsicum", "bell pepper"):
                return "pepper"
            if other == "lime":
                return "lemon"
            return other.replace(" ", "_")
    return "other"


def parse_freshness(name: str) -> str | None:
    """Normalize freshness stage to fresh, medium, or spoiled."""
    clean = re.sub(r"[_\-]+", " ", name).casefold()
    if "semi" in clean or "medium" in clean:
        return "medium"
    if "rotten" in clean or "spoiled" in clean or "bad" in clean:
        return "spoiled"
    if "fresh" in clean or "good" in clean:
        return "fresh"
    return None


def calculate_sha256(path: Path) -> str:
    hasher = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def assign_split(group_id: str, seed: int = DEFAULT_SEED) -> str:
    """Deterministic 70/15/15 split based on group hash to prevent data leakage."""
    digest = hashlib.sha256(f"{seed}:{group_id}".encode()).digest()
    bucket = int.from_bytes(digest[:4], "big") % 10_000
    if bucket < 7_000:
        return "train"
    if bucket < 8_500:
        return "val"
    return "test"


def scan_dataset_directory(root: Path) -> list[DatasetSample]:
    """Scan local or downloaded directory for image samples."""
    samples: list[DatasetSample] = []
    seen_hashes: set[str] = set()

    for file_path in root.rglob("*"):
        if not file_path.is_file() or file_path.suffix.casefold() not in IMAGE_SUFFIXES:
            continue

        # Extract information safely from parent directory name and filename
        parent_name = file_path.parent.name
        combined_text = f"{parent_name} {file_path.stem}"

        product_name = parse_product(combined_text)
        is_target = product_name in TARGET_PRODUCTS
        freshness_label = parse_freshness(combined_text)

        sha = calculate_sha256(file_path)
        if sha in seen_hashes:
            continue
        seen_hashes.add(sha)

        # Remove common augment prefixes to group duplicate/variant images
        base_name = re.sub(r"^(aug_\d+_|copy_\d+_|\d+_)", "", file_path.name, flags=re.I)
        group_id = f"{product_name}:{base_name.casefold()}"

        samples.append(
            DatasetSample(
                source_path=file_path,
                filename=file_path.name,
                product=product_name,
                freshness=freshness_label,
                is_target_product=is_target,
                sha256=sha,
                group_id=group_id,
            )
        )
    return samples


TARGET_DOWNLOAD_PATTERNS = [
    # Train targets (fresh, medium, rotten for banana, cucumber, brinjal, tomato)
    "train/*banana*/*",
    "train/*cucumber*/*",
    "train/*brinjal*/*",
    "train/*tomato*/*",
    # Test targets
    "test/*banana*/*",
    "test/*cucumber*/*",
    "test/*brinjal*/*",
    "test/*tomato*/*",
    # Produce negative samples for unknown rejection
    "test/fresh apple/*",
    "test/fresh lemon/*",
    "test/fresh chillies/*",
    "test/fresh orange/*",
]


def download_hf_dataset(
    repo_id: str,
    local_dir: Path,
    token: str | None = None,
    allow_patterns: list[str] | None = None,
) -> Path:
    """Download dataset repo from Hugging Face Hub with target filtering."""
    from huggingface_hub import snapshot_download

    token = token or os.environ.get("HF_TOKEN") or os.environ.get("HUGGINGFACE_HUB_TOKEN")
    patterns = allow_patterns or TARGET_DOWNLOAD_PATTERNS
    print(f"Downloading target produce folders from {repo_id}...")
    download_path = snapshot_download(
        repo_id=repo_id,
        repo_type="dataset",
        local_dir=str(local_dir.resolve()),
        allow_patterns=patterns,
        token=token,
        max_workers=2,
    )
    return Path(download_path)


def build_yolo_datasets(
    samples: list[DatasetSample],
    output_dir: Path,
    seed: int = DEFAULT_SEED,
    max_samples_per_class: int | None = None,
) -> dict[str, Any]:
    """Structure samples into YOLO classification train/val/test splits."""
    identity_dir = output_dir / "identity"
    freshness_dir = output_dir / "freshness"

    for d in (identity_dir, freshness_dir):
        if d.exists():
            shutil.rmtree(d)

    identity_counts: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    freshness_counts: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    manifest_rows: list[dict[str, Any]] = []

    target_samples = [s for s in samples if s.is_target_product]
    unknown_candidates = [s for s in samples if not s.is_target_product]

    # Stratified sampling across non-target categories to avoid single-commodity bias
    unknown_by_category: dict[str, list[DatasetSample]] = defaultdict(list)
    for s in unknown_candidates:
        unknown_by_category[s.product].append(s)

    # Determine balanced unknown quota (aiming for ~35% of target count)
    target_count = len(target_samples)
    max_unknown = max(500, int(target_count * 0.35))

    selected_unknown: list[DatasetSample] = []
    stratification_summary: dict[str, int] = {}
    if unknown_by_category:
        import random
        rng = random.Random(seed)
        num_categories = len(unknown_by_category)
        per_cat_quota = max(1, max_unknown // num_categories)

        for cat, cat_samples in sorted(unknown_by_category.items()):
            # Sort deterministically by sha256 before shuffling with seed
            sorted_samples = sorted(cat_samples, key=lambda x: x.sha256)
            rng.shuffle(sorted_samples)
            sampled = sorted_samples[:per_cat_quota]
            selected_unknown.extend(sampled)
            stratification_summary[cat] = len(sampled)

    active_samples = target_samples + selected_unknown

    for s in active_samples:
        split = assign_split(s.group_id, seed=seed)

        # 1. Identity Dataset (Model 1)
        id_class = s.product if s.is_target_product else "unknown"
        id_dest = identity_dir / split / id_class / f"{s.sha256[:12]}_{s.source_path.name}"
        id_dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(s.source_path, id_dest)
        identity_counts[split][id_class] += 1

        # 2. Freshness Dataset (Model 2: Target produce only, with valid freshness label)
        fresh_dest_str = None
        if s.is_target_product and s.freshness in FRESHNESS_CLASSES:
            fresh_dest = freshness_dir / split / s.freshness / f"{s.sha256[:12]}_{s.source_path.name}"
            fresh_dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(s.source_path, fresh_dest)
            freshness_counts[split][s.freshness] += 1
            fresh_dest_str = str(fresh_dest)

        manifest_rows.append(
            {
                "sha256": s.sha256,
                "product": s.product,
                "freshness": s.freshness or "unlabeled",
                "is_target": s.is_target_product,
                "split": split,
                "group_id": s.group_id,
                "identity_dest": str(id_dest),
                "freshness_dest": fresh_dest_str or "",
            }
        )

    # Save manifest
    manifest_path = output_dir / "manifest.csv"
    with manifest_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(manifest_rows[0].keys()))
        writer.writeheader()
        writer.writerows(manifest_rows)

    summary = {
        "dataset_name": "SnapStock-AI FreshLens FL-2TC Dataset",
        "total_unique_samples": len(active_samples),
        "seed": seed,
        "identity_dataset": {
            "root": str(identity_dir),
            "classes": list(IDENTITY_CLASSES),
            "splits": dict(identity_counts),
            "unknown_stratification": stratification_summary,
        },
        "freshness_dataset": {
            "root": str(freshness_dir),
            "classes": list(FRESHNESS_CLASSES),
            "splits": dict(freshness_counts),
        },
    }

    summary_json = json.dumps(summary, indent=2) + "\n"
    summary_path = output_dir / "dataset-summary.json"
    summary_path.write_text(summary_json, encoding="utf-8")

    # Also place a copy directly in each dataset split root for convenient lookup
    (identity_dir / "dataset-summary.json").write_text(summary_json, encoding="utf-8")
    (freshness_dir / "dataset-summary.json").write_text(summary_json, encoding="utf-8")

    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description="Prepare SnapStock-AI freshness dataset for FL-2TC.")
    parser.add_argument(
        "--repo-id",
        default="SnapStock-AI/snapstock-freshness-dataset-v2",
        help="Hugging Face dataset repository ID.",
    )
    parser.add_argument(
        "--local-dir",
        type=Path,
        default=None,
        help="Local directory if dataset is already downloaded or extracted.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("data/ml-datasets/snapstock-fl2tc"),
        help="Directory to store formatted YOLO identity and freshness datasets.",
    )
    parser.add_argument(
        "--token",
        default=None,
        help="Hugging Face access token (or set HF_TOKEN env var).",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=DEFAULT_SEED,
        help="Random seed for deterministic hashing.",
    )
    args = parser.parse_args()

    output_dir = args.output_dir.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    source_dir = args.local_dir
    if source_dir is None or not source_dir.exists():
        raw_download_dir = output_dir / "raw_hf_dataset"
        source_dir = download_hf_dataset(args.repo_id, raw_download_dir, token=args.token)

    print(f"Scanning samples from {source_dir}...")
    samples = scan_dataset_directory(source_dir)
    print(f"Found {len(samples)} valid produce image samples.")

    print("Formatting YOLO identity and freshness splits...")
    summary = build_yolo_datasets(samples, output_dir, seed=args.seed)

    print("\nDataset preparation complete:")
    print(f"  Identity dataset:  {summary['identity_dataset']['root']}")
    print(f"  Freshness dataset: {summary['freshness_dataset']['root']}")
    print(f"  Manifest:          {output_dir / 'manifest.csv'}")
    print(f"  Summary:           {output_dir / 'dataset-summary.json'}")


if __name__ == "__main__":
    main()
