from pathlib import Path
from uuid import UUID

_MAX_IMAGE_BYTES = 8 * 1024 * 1024
_JPEG_SIGNATURE = b"\xff\xd8\xff"
_PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def detect_image_suffix(data: bytes) -> str:
    if data.startswith(_JPEG_SIGNATURE):
        return ".jpg"
    if data.startswith(_PNG_SIGNATURE):
        return ".png"
    raise ValueError("Image must be a valid JPEG or PNG file.")


class ObjectStorageClient:
    """Local-volume object store. Opaque `image_path`; swap for R2 in #18."""

    def __init__(self, root: str | Path) -> None:
        self.root = Path(root)

    def put(self, tenant_id: UUID, scan_id: UUID, data: bytes, suffix: str = ".jpg") -> str:
        if not data:
            raise ValueError("Image is empty.")
        if len(data) > _MAX_IMAGE_BYTES:
            raise ValueError("Image exceeds 8MB.")
        # Trust the bytes, not the multipart filename or content type.
        suffix = detect_image_suffix(data)
        relative = f"{tenant_id}/{scan_id}{suffix}"
        destination = self.root / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(data)
        return relative


def get_storage() -> ObjectStorageClient:
    from app.core.config import get_settings

    return ObjectStorageClient(get_settings().scan_storage_dir)
