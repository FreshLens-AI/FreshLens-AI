from __future__ import annotations

SUPPORTED_IDENTITIES = {
    "banana": "Banana",
    "cucumber": "Cucumber",
    "eggplant": "Eggplant",
    "tomato": "Tomato",
}
UNKNOWN_CLASS = "unknown"
DEFAULT_IDENTITY_MODEL_VERSION = "identity-yolo26n-cls-v1"


def display_identity(raw_label: str) -> str | None:
    """Return a catalogue-compatible display name or None for rejection."""
    normalized = raw_label.strip().casefold().replace("_", " ").replace("-", " ")
    normalized = " ".join(normalized.split())
    return SUPPORTED_IDENTITIES.get(normalized)
