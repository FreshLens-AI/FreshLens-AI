from training.prepare_identity_dataset import (
    agrifresh_source_name,
    canonical_product,
    split_for_group,
)
from training.prepare_external_dataset import canonical_label, output_split_for_digest


def test_canonicalizes_supported_varieties_and_freshness_folders() -> None:
    assert canonical_product("Banana Lady Finger 1") == "banana"
    assert canonical_product("Fresh Tomato(1-10)") == "tomato"
    assert canonical_product("Semi_Fresh eggplant(4-8)") == "eggplant"
    assert canonical_product("Rotten Cucumber(12-20)") == "cucumber"
    assert canonical_product("Fresh Pineapple(1-15)") == "unknown"


def test_augmented_variants_share_the_original_source_name() -> None:
    assert agrifresh_source_name("aug_12_IMG_123.jpg") == "IMG_123.jpg"
    assert agrifresh_source_name("aug_999_Banana (4).jpeg") == "Banana (4).jpeg"


def test_group_split_is_stable_and_seeded() -> None:
    group = "agrifreshnet:banana:img_123.jpg"
    assert split_for_group(group, 21) == split_for_group(group, 21)
    assert split_for_group(group, 21) in {"train", "val", "test"}


def test_cross_domain_labels_map_non_targets_to_unknown() -> None:
    assert canonical_label(1) == ("banana", "banana")
    assert canonical_label(10) == ("cucumber", "cucumber")
    assert canonical_label(11) == ("eggplant", "eggplant")
    assert canonical_label(33) == ("tomato", "tomato")
    assert canonical_label(0) == ("apple", "unknown")


def test_external_validation_split_is_stable_and_test_stays_untouched() -> None:
    digest = "00000001" + "0" * 56
    assert output_split_for_digest("train", digest, 20) == "val"
    assert output_split_for_digest("train", digest, 0) == "train"
    assert output_split_for_digest("test", digest, 20) == "test"
