from uuid import uuid4

from app.core.storage import ObjectStorageClient


def test_storage_put_returns_opaque_relative_path(tmp_path) -> None:
    client = ObjectStorageClient(tmp_path)
    tenant_id = uuid4()
    scan_id = uuid4()
    path = client.put(tenant_id, scan_id, b"jpeg-bytes")
    assert path == f"{tenant_id}/{scan_id}.jpg"
    assert (tmp_path / path).read_bytes() == b"jpeg-bytes"


def test_storage_put_rejects_empty_image(tmp_path) -> None:
    client = ObjectStorageClient(tmp_path)
    try:
        client.put(uuid4(), uuid4(), b"")
    except ValueError as exc:
        assert "empty" in str(exc)
    else:
        raise AssertionError("empty image was stored")
