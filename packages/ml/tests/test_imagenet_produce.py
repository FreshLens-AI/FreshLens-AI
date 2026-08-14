from worker.imagenet_produce import display_produce, model_version_for, parse_identified


def test_maps_known_imagenet_produce() -> None:
    assert display_produce("banana") == "Banana"
    assert display_produce("Granny Smith") == "Apple"
    assert display_produce("bell pepper") == "Pepper"


def test_keeps_unknown_imagenet_label() -> None:
    assert display_produce("airliner") == "airliner"


def test_roundtrip_model_version() -> None:
    version = model_version_for("Banana")
    assert version == "yolo26n-cls:Banana"
    assert parse_identified(version) == "Banana"
    assert parse_identified("stub-v0") is None


def test_tasks_does_not_import_ultralytics() -> None:
    from pathlib import Path

    source = Path("worker/tasks.py").read_text(encoding="utf-8")
    assert "from ultralytics" not in source
    assert "import ultralytics" not in source
