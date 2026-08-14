# ImageNet-1k names that are grocery-ish → FreshLens display names.
# ponytail: pretrained YOLO26-cls is ImageNet, not FruitVeg. No tomato, potato,
# guava, chili, or brinjal. Fine-tune yolo26n-cls on FruitVeg identity labels.

PRODUCE_NAMES = {
    "Granny Smith": "Apple",
    "banana": "Banana",
    "orange": "Orange",
    "lemon": "Lemon",
    "strawberry": "Strawberry",
    "pineapple": "Pineapple",
    "fig": "Fig",
    "pomegranate": "Pomegranate",
    "jackfruit": "Jackfruit",
    "custard apple": "Custard apple",
    "cucumber": "Cucumber",
    "bell pepper": "Pepper",
    "broccoli": "Broccoli",
    "cauliflower": "Cauliflower",
    "zucchini": "Zucchini",
    "head cabbage": "Cabbage",
    "artichoke": "Artichoke",
    "spaghetti squash": "Squash",
    "acorn squash": "Squash",
    "butternut squash": "Squash",
    "corn": "Corn",
    "ear": "Corn",
}

MODEL_PREFIX = "yolo26n-cls"


def display_produce(raw: str) -> str:
    return PRODUCE_NAMES.get(raw, raw.replace("_", " "))


def model_version_for(display_name: str) -> str:
    return f"{MODEL_PREFIX}:{display_name}"


def parse_identified(model_version: str | None) -> str | None:
    if not model_version or not model_version.startswith(f"{MODEL_PREFIX}:"):
        return None
    name = model_version.split(":", 1)[1].strip()
    return name or None
