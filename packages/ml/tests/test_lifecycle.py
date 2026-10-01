from datetime import UTC, datetime, timedelta

from worker import db, lifecycle


class FakeCursor:
    def __init__(self, *, row=None, rows=None):
        self.row = row
        self.rows = rows or []

    def fetchone(self):
        return self.row

    def fetchall(self):
        return self.rows


class LifecycleConnection:
    def __init__(self, rows):
        self.rows = rows
        self.events = set()

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def execute(self, query, params=None):
        normalized = " ".join(query.split()).lower()
        if normalized.startswith("select set_config"):
            return FakeCursor()
        if normalized.startswith("update public.alerts"):
            return FakeCursor()
        if "from public.batches as batches" in normalized:
            return FakeCursor(rows=self.rows)
        if normalized.startswith("insert into public.alerts"):
            event_key = params[1]
            batch_id = params[5]
            unique = (batch_id, event_key)
            if unique in self.events:
                return FakeCursor()
            self.events.add(unique)
            return FakeCursor(row={"id": f"alert-{len(self.events)}"})
        raise AssertionError(f"Unexpected SQL: {normalized}")


def test_due_lifecycle_alerts_are_distinct_and_idempotent(monkeypatch) -> None:
    now = datetime.now(UTC)
    rows = [
        {
            "id": "fresh-batch",
            "tenant_id": "tenant-1",
            "product_id": "banana",
            "initial_classification": "fresh",
            "quantity_received": 20,
            "quantity_remaining": 15,
            "fresh_to_medium_at": now + timedelta(hours=12),
            "medium_to_spoiled_at": now + timedelta(days=3),
            "name": "Banana",
        },
        {
            "id": "medium-batch",
            "tenant_id": "tenant-1",
            "product_id": "tomato",
            "initial_classification": "medium",
            "quantity_received": 10,
            "quantity_remaining": 8,
            "fresh_to_medium_at": now,
            "medium_to_spoiled_at": now + timedelta(hours=6),
            "name": "Tomato",
        },
    ]
    connection = LifecycleConnection(rows)
    monkeypatch.setattr(db, "_connect", lambda: connection)

    assert lifecycle.evaluate_due_lifecycle_alerts("tenant-1", "user-1") == 2
    assert lifecycle.evaluate_due_lifecycle_alerts("tenant-1", "user-1") == 0
    assert connection.events == {
        ("fresh-batch", "fresh_to_medium_warning"),
        ("medium-batch", "medium_to_spoiled_warning"),
    }
