from pathlib import Path

from training.prepare_freshness_dataset import (
    FreshnessSample,
    canonical_freshness,
    select_splits,
)


def _sample(group: str, *, augmented: bool) -> FreshnessSample:
    return FreshnessSample(
        source_path=Path(f"/{group}-{'aug' if augmented else 'original'}.jpg"),
        source_label="Fresh Banana(1-4)",
        product="banana",
        freshness="fresh",
        group_id=group,
        sha256=f"hash-{group}-{augmented}",
        is_augmented=augmented,
    )


def test_maps_agrifresh_stages_to_application_labels() -> None:
    assert canonical_freshness("Fresh Banana(1-4)") == "fresh"
    assert canonical_freshness("Semi_Fresh eggplant(4-8)") == "medium"
    assert canonical_freshness("Rotten Tomato(24-35)") == "spoiled"
    assert canonical_freshness("Banana") is None


def test_augmented_variants_share_split_and_stay_out_of_evaluation() -> None:
    groups = [f"group-{index}" for index in range(100)]
    samples = [
        sample
        for group in groups
        for sample in (_sample(group, augmented=False), _sample(group, augmented=True))
    ]

    selected = select_splits(samples, seed=21)

    split_by_group: dict[str, set[str]] = {}
    for split, split_samples in selected.items():
        for sample in split_samples:
            split_by_group.setdefault(sample.group_id, set()).add(split)
            if split in {"val", "test"}:
                assert not sample.is_augmented
    assert all(len(splits) == 1 for splits in split_by_group.values())
    assert {"train", "val", "test"} == {
        split for split, values in selected.items() if values
    }
