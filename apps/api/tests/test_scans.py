from datetime import UTC, datetime
from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

from app.core.database import get_tenant_connection
from app.core.jobs import ClassificationJobPublisher, TASK_NAME, get_publisher
from app.core.storage import detect_image_suffix, get_storage
from app.main import app
from tests.conftest import StaticVerifier
from tests.test_auth import admin_claims, vendor_claims

NOW = datetime(2026, 8, 13, tzinfo=UTC)
JPEG_BYTES = b"\xff\xd8\xff\xe0jpeg-test-data\xff\xd9"


class FakeStorage:
    def __init__(self) -> None:
        self.puts: list[tuple[UUID, UUID, bytes, str]] = []

    def put(self, tenant_id: UUID, scan_id: UUID, data: bytes, suffix: str = ".jpg") -> str:
        if not data:
            raise ValueError("Image is empty.")
        suffix = detect_image_suffix(data)
        self.puts.append((tenant_id, scan_id, data, suffix))
        return f"{tenant_id}/{scan_id}{suffix}"


class FakePublisher:
    def __init__(self, error: Exception | None = None) -> None:
        self.calls: list[tuple[UUID, UUID, str]] = []
        self.error = error

    def publish(self, tenant_id: UUID, scan_id: UUID, image_path: str) -> str:
        if self.error is not None:
            raise self.error
        self.calls.append((tenant_id, scan_id, image_path))
        return "task-1"


class FakeConnection:
    def __init__(self) -> None:
        self.failed: list[UUID] = []
        self.row: dict[str, object] | None = None
        self.rows: list[dict[str, object]] = []

    async def fetchrow(self, query: str, *args: object) -> dict[str, object] | None:
        if "insert" in query:
            scan_id, tenant_id, image_path, quantity, product_id, batch_id = args
            return {
                "id": scan_id,
                "tenant_id": tenant_id,
                "status": "pending",
                "image_path": image_path,
                "quantity": quantity,
                "classification": None,
                "freshness_score": None,
                "model_version": None,
                "identity_label": None,
                "identity_score": None,
                "identity_model_version": None,
                "product_id": product_id,
                "batch_id": batch_id,
                "created_at": NOW,
                "updated_at": NOW,
            }
        return self.row

    async def fetch(self, query: str, *args: object) -> list[dict[str, object]]:
        return self.rows

    async def execute(self, query: str, *args: object) -> None:
        if args:
            self.failed.append(args[0])  # type: ignore[arg-type]


@pytest.fixture
def scan_stack(
    client: TestClient,
    verifier: StaticVerifier,
) -> tuple[TestClient, StaticVerifier, FakeStorage, FakePublisher, FakeConnection]:
    storage = FakeStorage()
    jobs = FakePublisher()
    connection = FakeConnection()

    async def override_connection():
        yield connection

    app.dependency_overrides[get_tenant_connection] = override_connection
    app.dependency_overrides[get_storage] = lambda: storage
    app.dependency_overrides[get_publisher] = lambda: jobs
    yield client, verifier, storage, jobs, connection
    app.dependency_overrides.clear()


def test_create_scan_returns_202_and_does_not_classify(
    scan_stack: tuple[TestClient, StaticVerifier, FakeStorage, FakePublisher, FakeConnection],
) -> None:
    client, verifier, storage, jobs, _connection = scan_stack
    claims = vendor_claims()
    verifier.claims = claims
    response = client.post(
        "/api/v1/scans",
        headers={"Authorization": "Bearer valid"},
        files={"image": ("scan.jpg", JPEG_BYTES, "image/jpeg")},
        data={"quantity": "2"},
    )
    body = response.json()
    assert response.status_code == 202
    assert body["status"] == "pending"
    assert "classification" not in body
    assert len(jobs.calls) == 1
    assert jobs.calls[0][0] == UUID(str(claims["tenant_id"]))
    assert storage.puts[0][2] == JPEG_BYTES


def test_create_scan_rejects_empty_image(
    scan_stack: tuple[TestClient, StaticVerifier, FakeStorage, FakePublisher, FakeConnection],
) -> None:
    client, verifier, _storage, jobs, _connection = scan_stack
    verifier.claims = vendor_claims()
    response = client.post(
        "/api/v1/scans",
        headers={"Authorization": "Bearer valid"},
        files={"image": ("scan.jpg", b"", "image/jpeg")},
        data={"quantity": "1"},
    )
    assert response.status_code == 422
    assert jobs.calls == []


def test_create_scan_rejects_non_image_content(
    scan_stack: tuple[TestClient, StaticVerifier, FakeStorage, FakePublisher, FakeConnection],
) -> None:
    client, verifier, _storage, jobs, _connection = scan_stack
    verifier.claims = vendor_claims()
    response = client.post(
        "/api/v1/scans",
        headers={"Authorization": "Bearer valid"},
        files={"image": ("scan.jpg", b"File not found", "image/jpeg")},
        data={"quantity": "1"},
    )
    assert response.status_code == 422
    assert response.json()["detail"] == "Image must be a valid JPEG or PNG file."
    assert jobs.calls == []


def test_create_scan_rejects_quantity_below_one(
    scan_stack: tuple[TestClient, StaticVerifier, FakeStorage, FakePublisher, FakeConnection],
) -> None:
    client, verifier, _storage, jobs, _connection = scan_stack
    verifier.claims = vendor_claims()
    response = client.post(
        "/api/v1/scans",
        headers={"Authorization": "Bearer valid"},
        files={"image": ("scan.jpg", JPEG_BYTES, "image/jpeg")},
        data={"quantity": "0"},
    )
    assert response.status_code == 422
    assert jobs.calls == []


def test_admin_cannot_create_scan(
    client: TestClient,
    verifier: StaticVerifier,
) -> None:
    verifier.claims = admin_claims()
    response = client.post(
        "/api/v1/scans",
        headers={"Authorization": "Bearer valid"},
        files={"image": ("scan.jpg", JPEG_BYTES, "image/jpeg")},
        data={"quantity": "1"},
    )
    assert response.status_code == 403


def test_enqueue_failure_marks_scan_failed(
    scan_stack: tuple[TestClient, StaticVerifier, FakeStorage, FakePublisher, FakeConnection],
) -> None:
    client, verifier, _storage, jobs, connection = scan_stack
    jobs.error = RuntimeError("redis down")
    verifier.claims = vendor_claims()
    response = client.post(
        "/api/v1/scans",
        headers={"Authorization": "Bearer valid"},
        files={"image": ("scan.jpg", JPEG_BYTES, "image/jpeg")},
        data={"quantity": "1"},
    )
    assert response.status_code == 503
    assert connection.failed


def test_get_scan_returns_404_when_missing(
    scan_stack: tuple[TestClient, StaticVerifier, FakeStorage, FakePublisher, FakeConnection],
) -> None:
    client, verifier, _storage, _jobs, connection = scan_stack
    connection.row = None
    verifier.claims = vendor_claims()
    response = client.get(
        f"/api/v1/scans/{uuid4()}",
        headers={"Authorization": "Bearer valid"},
    )
    assert response.status_code == 404


def test_list_scans_returns_page(
    scan_stack: tuple[TestClient, StaticVerifier, FakeStorage, FakePublisher, FakeConnection],
) -> None:
    client, verifier, _storage, _jobs, connection = scan_stack
    scan_id = uuid4()
    tenant_id = uuid4()
    connection.rows = [
        {
            "id": scan_id,
            "tenant_id": tenant_id,
            "status": "completed",
            "image_path": f"{tenant_id}/{scan_id}.jpg",
            "quantity": 1,
            "classification": "fresh",
            "freshness_score": 0.91,
            "model_version": "stub-v0",
            "identity_label": "Banana",
            "identity_score": 0.94,
            "identity_model_version": "identity-yolo26n-cls-v1",
            "product_id": None,
            "batch_id": None,
            "created_at": NOW,
            "updated_at": NOW,
            "total": 1,
        }
    ]
    verifier.claims = vendor_claims()
    response = client.get(
        "/api/v1/scans",
        headers={"Authorization": "Bearer valid"},
    )
    body = response.json()
    assert response.status_code == 200
    assert body["total"] == 1
    assert body["items"][0]["classification"] == "fresh"
    assert body["items"][0]["model_version"] == "stub-v0"
    assert body["items"][0]["identity_label"] == "Banana"
    assert body["items"][0]["identity_score"] == pytest.approx(0.94)


def test_scan_router_does_not_import_classifier() -> None:
    import app.routers.scans as scans_router

    source = open(scans_router.__file__, encoding="utf-8").read()
    assert "StubClassifier" not in source
    assert "Yolo26ClsClassifier" not in source
    assert "ultralytics" not in source
    assert "classify_scan" not in source


def test_publisher_writes_tenant_namespaced_redis_key(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    sent: dict[str, object] = {}

    class FakeCelery:
        def __init__(self, *args: object, **kwargs: object) -> None:
            pass

        def send_task(self, name: str, args: list[str]) -> SimpleNamespace:
            sent["name"] = name
            sent["args"] = args
            return SimpleNamespace(id="task-99")

    class FakeRedis:
        @classmethod
        def from_url(cls, *args: object, **kwargs: object) -> "FakeRedis":
            return cls()

        def set(self, key: str, value: str) -> None:
            sent["key"] = key
            sent["value"] = value

    monkeypatch.setattr("app.core.jobs.Celery", FakeCelery)
    monkeypatch.setattr("app.core.jobs.Redis", FakeRedis)
    tenant_id = uuid4()
    scan_id = uuid4()
    ClassificationJobPublisher("redis://x", "redis://x").publish(
        tenant_id, scan_id, "t/s.jpg"
    )
    assert sent["name"] == TASK_NAME
    assert sent["key"] == f"tenant:{tenant_id}:scan:{scan_id}"
    assert sent["value"] == "task-99"
