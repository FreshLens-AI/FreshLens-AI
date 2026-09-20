from pathlib import Path
from training.dataset_snapstock import (
    DatasetSample,
    assign_split,
    build_yolo_datasets,
    parse_freshness,
    parse_product,
)


def test_parse_product():
    assert parse_product("fresh_banana_001") == "banana"
    assert parse_product("rotten_cucumber") == "cucumber"
    assert parse_product("eggplant_medium") == "eggplant"
    assert parse_product("fresh brinjal") == "eggplant"
    assert parse_product("fresh_tomato_front") == "tomato"
    assert parse_product("fresh_apple_01") == "apple"
    assert parse_product("rotten_orange_02") == "orange"
    assert parse_product("medium chilllies") == "chillies"
    assert parse_product("fresh bell pepper") == "pepper"
    assert parse_product("fresh lime") == "lemon"
    assert parse_product("random_unrelated_object") == "other"


def test_parse_freshness():
    assert parse_freshness("fresh_banana") == "fresh"
    assert parse_freshness("pure_fresh_tomato") == "fresh"
    assert parse_freshness("semi_fresh_cucumber") == "medium"
    assert parse_freshness("medium_eggplant") == "medium"
    assert parse_freshness("rotten_banana") == "spoiled"
    assert parse_freshness("spoiled_cucumber") == "spoiled"
    assert parse_freshness("unknown_grade") is None


def test_assign_split_determinism():
    split1 = assign_split("banana:sample_001", seed=21)
    split2 = assign_split("banana:sample_001", seed=21)
    assert split1 == split2
    assert split1 in {"train", "val", "test"}


def test_build_yolo_datasets(tmp_path: Path):
    source_dir = tmp_path / "source"
    source_dir.mkdir()
    out_dir = tmp_path / "out"

    # Create dummy images
    img1 = source_dir / "banana_fresh_1.jpg"
    img1.write_bytes(b"dummy1")
    img2 = source_dir / "cucumber_rotten_1.jpg"
    img2.write_bytes(b"dummy2")
    img3 = source_dir / "apple_fresh_1.jpg"
    img3.write_bytes(b"dummy3")

    samples = [
        DatasetSample(
            source_path=img1,
            filename=img1.name,
            product="banana",
            freshness="fresh",
            is_target_product=True,
            sha256="hash1",
            group_id="banana:1",
        ),
        DatasetSample(
            source_path=img2,
            filename=img2.name,
            product="cucumber",
            freshness="spoiled",
            is_target_product=True,
            sha256="hash2",
            group_id="cucumber:1",
        ),
        DatasetSample(
            source_path=img3,
            filename=img3.name,
            product="apple",
            freshness="fresh",
            is_target_product=False,
            sha256="hash3",
            group_id="apple:1",
        ),
    ]

    summary = build_yolo_datasets(samples, out_dir, seed=21)

    assert (out_dir / "identity").is_dir()
    assert (out_dir / "freshness").is_dir()
    assert (out_dir / "manifest.csv").is_file()
    assert (out_dir / "dataset-summary.json").is_file()

    assert summary["total_unique_samples"] == 3
    assert "banana" in summary["identity_dataset"]["classes"]
    assert "unknown" in summary["identity_dataset"]["classes"]
    assert "fresh" in summary["freshness_dataset"]["classes"]


def test_stratified_unknown_sampling(tmp_path: Path):
    source_dir = tmp_path / "source"
    source_dir.mkdir()
    out_dir = tmp_path / "out"

    # Create 4 target samples and multiple non-target produce samples
    target_samples = []
    for i, prod in enumerate(("banana", "cucumber", "eggplant", "tomato")):
        p = source_dir / f"{prod}_{i}.jpg"
        p.write_bytes(f"{prod}_{i}".encode())
        target_samples.append(
            DatasetSample(
                source_path=p,
                filename=p.name,
                product=prod,
                freshness="fresh",
                is_target_product=True,
                sha256=f"hash_{prod}_{i}",
                group_id=f"{prod}:{i}",
            )
        )

    # Create 10 apples, 10 oranges, 10 lemons
    unknown_samples = []
    for non_prod in ("apple", "orange", "lemon"):
        for j in range(10):
            p = source_dir / f"{non_prod}_{j}.jpg"
            p.write_bytes(f"{non_prod}_{j}".encode())
            unknown_samples.append(
                DatasetSample(
                    source_path=p,
                    filename=p.name,
                    product=non_prod,
                    freshness=None,
                    is_target_product=False,
                    sha256=f"hash_{non_prod}_{j}",
                    group_id=f"{non_prod}:{j}",
                )
            )

    all_samples = target_samples + unknown_samples
    summary = build_yolo_datasets(all_samples, out_dir, seed=21)

    strat = summary["identity_dataset"]["unknown_stratification"]
    assert "apple" in strat
    assert "orange" in strat
    assert "lemon" in strat
    # Verify each category receives a balanced allocation
    assert strat["apple"] == strat["orange"] == strat["lemon"]

