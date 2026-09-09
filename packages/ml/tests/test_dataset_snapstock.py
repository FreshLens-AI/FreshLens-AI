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
    assert parse_product("fresh_tomato_front") == "tomato"
    assert parse_product("fresh_apple_01") == "apple"
    assert parse_product("rotten_orange_02") == "orange"
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
