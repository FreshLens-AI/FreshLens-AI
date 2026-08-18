from uuid import uuid4

from app.core.storage import ObjectStorageClient


JPEG_BYTES = b"\xff\xd8\xff\xe0jpeg-test-data\xff\xd9"


def test_storage_put_returns_opaque_relative_path(tmp_path) -> None:
    client = ObjectStorageClient(tmp_path)
    tenant_id = uuid4()
    scan_id = uuid4()
    path = client.put(tenant_id, scan_id, JPEG_BYTES)
    assert path == f"{tenant_id}/{scan_id}.jpg"
    assert (tmp_path / path).read_bytes() == JPEG_BYTES


def test_storage_put_rejects_empty_image(tmp_path) -> None:
    client = ObjectStorageClient(tmp_path)
    try:
        client.put(uuid4(), uuid4(), b"")
    except ValueError as exc:
        assert "empty" in str(exc)
    else:
        raise AssertionError("empty image was stored")


def test_storage_put_rejects_non_image_bytes(tmp_path) -> None:
    client = ObjectStorageClient(tmp_path)
    try:
        client.put(uuid4(), uuid4(), b"File not found")
    except ValueError as exc:
        assert "valid JPEG or PNG" in str(exc)
    else:
        raise AssertionError("non-image content was stored")
