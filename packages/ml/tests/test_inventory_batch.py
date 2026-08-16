from worker.classifier import ClassificationResult
from worker import db


class FakeCursor:
    def __init__(self, row=None):
        self.row = row

    def fetchone(self):
        return self.row


class FakeConnection:
    def __init__(
        self,
        *,
        product_id=None,
        batch_id=None,
        matched_product_id="banana-product",
    ):
        self.scan = {
            "product_id": product_id,
            "batch_id": batch_id,
            "quantity": 25,
        }
        self.matched_product_id = matched_product_id
        self.batch_inserts = 0

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def execute(self, query, params=None):
        normalized = " ".join(query.split()).lower()
        if normalized.startswith("select set_config"):
            return FakeCursor()
        if "from public.scans" in normalized and "for update" in normalized:
            return FakeCursor(dict(self.scan))
        if "from public.products" in normalized:
            row = (
                {"id": self.matched_product_id}
                if self.matched_product_id is not None
                else None
            )
            return FakeCursor(row)
        if normalized.startswith("insert into public.batches"):
            self.batch_inserts += 1
            return FakeCursor({"id": "new-batch"})
        if normalized.startswith("update public.scans"):
            self.scan["product_id"] = params[3] or self.scan["product_id"]
            self.scan["batch_id"] = params[4] or self.scan["batch_id"]
            return FakeCursor()
        raise AssertionError(f"Unexpected SQL: {normalized}")


def _result(name: str, confidence: float = 0.99) -> ClassificationResult:
    return ClassificationResult(
        label="fresh",
        score=confidence,
        model_version=f"yolo26n-cls:{name}",
    )


def test_completed_identified_scan_creates_one_batch_on_retry(monkeypatch) -> None:
    connection = FakeConnection()
    monkeypatch.setattr(db, "_connect", lambda: connection)

    db.complete("tenant-1", "scan-1", _result("Banana"))
    db.complete("tenant-1", "scan-1", _result("Banana"))

    assert connection.scan["product_id"] == "banana-product"
    assert connection.scan["batch_id"] == "new-batch"
    assert connection.batch_inserts == 1


def test_unknown_or_low_confidence_identity_does_not_create_batch(monkeypatch) -> None:
    for result, matched_product_id in [
        (_result("menu"), None),
        (_result("Banana", confidence=0.40), "banana-product"),
    ]:
        connection = FakeConnection(matched_product_id=matched_product_id)
        monkeypatch.setattr(db, "_connect", lambda: connection)

        db.complete("tenant-1", "scan-1", result)

        assert connection.scan["product_id"] is None
        assert connection.scan["batch_id"] is None
        assert connection.batch_inserts == 0


def test_existing_batch_is_preserved(monkeypatch) -> None:
    connection = FakeConnection(product_id="banana-product", batch_id="existing-batch")
    monkeypatch.setattr(db, "_connect", lambda: connection)

    db.complete("tenant-1", "scan-1", _result("Banana"))

    assert connection.scan["batch_id"] == "existing-batch"
    assert connection.batch_inserts == 0
