import asyncio
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

from app.core.database import get_tenant_connection
from app.main import app
from app.schemas.sales import CreateSaleRequest, SaleItemInput, SaleSource
from app.services.sales import (
    IdempotencyConflictError,
    InsufficientStockError,
    SalesService,
    SaleValidationError,
)
from tests.conftest import StaticVerifier
from tests.test_auth import admin_claims, vendor_claims

NOW = datetime(2026, 8, 13, tzinfo=UTC)


def _request(product_id: UUID, batch_id: UUID, quantity: int = 1) -> CreateSaleRequest:
    return CreateSaleRequest(
        source=SaleSource.MANUAL,
        items=[
            SaleItemInput(
                product_id=product_id, batch_id=batch_id, quantity_sold=quantity
            )
        ],
    )


class SalesDb:
    def __init__(self) -> None:
        self.sale_by_key: dict[str, object] | None = None
        self.sale_items: list[dict[str, object]] = []
        self.batches: dict[UUID, dict[str, object]] = {}
        self.updates: list[tuple[UUID, int]] = []
        self.alerts: list[tuple[str, str]] = []
        self.alert_exists = False

    async def fetchrow(self, query: str, *args: object) -> dict[str, object] | None:
        compact = " ".join(query.lower().split())
        if "from public.sales" in compact and "idempotency_key" in compact:
            return self.sale_by_key
        if "for update of b" in compact:
            return self.batches.get(args[0])  # type: ignore[arg-type]
        if "insert into public.sales" in compact:
            return {"id": args[0], "created_at": NOW}
        if "insert into public.sale_items" in compact:
            return {"id": args[0]}
        if "from public.alerts" in compact:
            return {"exists": 1} if self.alert_exists else None
        return None

    async def fetch(self, query: str, *args: object) -> list[dict[str, object]]:
        if "from public.sale_items" in query.lower():
            return self.sale_items
        return []

    async def execute(self, query: str, *args: object) -> None:
        compact = " ".join(query.lower().split())
        if "update public.batches" in compact:
            self.updates.append((args[0], args[1]))  # type: ignore[arg-type]
        if "insert into public.alerts" in compact:
            self.alerts.append((str(args[1]), str(args[2])))


def test_sale_rejects_oversell() -> None:
    product_id, batch_id = uuid4(), uuid4()
    db = SalesDb()
    db.batches[batch_id] = {
        "id": batch_id,
        "product_id": product_id,
        "quantity_remaining": 1,
        "intake_date": NOW,
        "name": "Tomato",
        "low_stock_threshold": 3,
        "shelf_life_days": 5,
    }
    with pytest.raises(InsufficientStockError):
        asyncio.run(
            SalesService(db).create(  # type: ignore[arg-type]
                tenant_id=uuid4(),
                user_id=uuid4(),
                idempotency_key="sale-1",
                request=_request(product_id, batch_id, 2),
            )
        )
    assert db.updates == []


def test_sale_deducts_and_emits_low_stock_alert() -> None:
    product_id, batch_id = uuid4(), uuid4()
    db = SalesDb()
    db.batches[batch_id] = {
        "id": batch_id,
        "product_id": product_id,
        "quantity_remaining": 4,
        "intake_date": NOW,
        "name": "Tomato",
        "low_stock_threshold": 3,
        "shelf_life_days": 5,
    }
    sale = asyncio.run(
        SalesService(db).create(  # type: ignore[arg-type]
            tenant_id=uuid4(),
            user_id=uuid4(),
            idempotency_key="sale-2",
            request=_request(product_id, batch_id, 2),
        )
    )
    assert sale.items[0].quantity_remaining == 2
    assert db.updates == [(batch_id, 2)]
    assert ("low_stock", "warning") in db.alerts


def test_sale_emits_aging_alert_for_expired_batch() -> None:
    product_id, batch_id = uuid4(), uuid4()
    db = SalesDb()
    db.batches[batch_id] = {
        "id": batch_id,
        "product_id": product_id,
        "quantity_remaining": 8,
        "intake_date": NOW - timedelta(days=10),
        "name": "Banana",
        "low_stock_threshold": 2,
        "shelf_life_days": 3,
    }
    asyncio.run(
        SalesService(db).create(  # type: ignore[arg-type]
            tenant_id=uuid4(),
            user_id=uuid4(),
            idempotency_key="sale-3",
            request=_request(product_id, batch_id, 1),
        )
    )
    assert ("aging", "warning") in db.alerts


def test_sale_rejects_product_batch_mismatch() -> None:
    db = SalesDb()
    batch_id = uuid4()
    db.batches[batch_id] = {
        "id": batch_id,
        "product_id": uuid4(),
        "quantity_remaining": 5,
        "intake_date": NOW,
        "name": "Tomato",
        "low_stock_threshold": 3,
        "shelf_life_days": 5,
    }
    with pytest.raises(SaleValidationError):
        asyncio.run(
            SalesService(db).create(  # type: ignore[arg-type]
                tenant_id=uuid4(),
                user_id=uuid4(),
                idempotency_key="sale-4",
                request=_request(uuid4(), batch_id, 1),
            )
        )


def test_matching_idempotency_key_replays_without_deducting() -> None:
    product_id, batch_id, sale_id = uuid4(), uuid4(), uuid4()
    db = SalesDb()
    db.sale_by_key = {
        "id": sale_id,
        "source": "manual",
        "created_at": NOW,
    }
    db.sale_items = [
        {
            "id": uuid4(),
            "product_id": product_id,
            "batch_id": batch_id,
            "quantity_sold": 1,
            "quantity_remaining": 9,
        }
    ]
    sale = asyncio.run(
        SalesService(db).create(  # type: ignore[arg-type]
            tenant_id=uuid4(),
            user_id=uuid4(),
            idempotency_key="sale-5",
            request=_request(product_id, batch_id, 1),
        )
    )
    assert sale.id == sale_id
    assert db.updates == []


def test_conflicting_idempotency_payload_raises() -> None:
    product_id, batch_id, sale_id = uuid4(), uuid4(), uuid4()
    db = SalesDb()
    db.sale_by_key = {"id": sale_id, "source": "manual", "created_at": NOW}
    db.sale_items = [
        {
            "id": uuid4(),
            "product_id": product_id,
            "batch_id": batch_id,
            "quantity_sold": 2,
            "quantity_remaining": 8,
        }
    ]
    with pytest.raises(IdempotencyConflictError):
        asyncio.run(
            SalesService(db).create(  # type: ignore[arg-type]
                tenant_id=uuid4(),
                user_id=uuid4(),
                idempotency_key="sale-6",
                request=_request(product_id, batch_id, 1),
            )
        )


def test_admin_cannot_create_sale(
    client: TestClient,
    verifier: StaticVerifier,
) -> None:
    verifier.claims = admin_claims()
    response = client.post(
        "/api/v1/sales",
        headers={"Authorization": "Bearer valid", "Idempotency-Key": "k1"},
        json={
            "source": "manual",
            "items": [
                {
                    "product_id": str(uuid4()),
                    "batch_id": str(uuid4()),
                    "quantity_sold": 1,
                }
            ],
        },
    )
    assert response.status_code == 403


def test_sale_requires_idempotency_key(
    client: TestClient,
    verifier: StaticVerifier,
) -> None:
    async def override_connection():
        yield SalesDb()

    app.dependency_overrides[get_tenant_connection] = override_connection
    try:
        verifier.claims = vendor_claims()
        response = client.post(
            "/api/v1/sales",
            headers={"Authorization": "Bearer valid"},
            json={
                "source": "manual",
                "items": [
                    {
                        "product_id": str(uuid4()),
                        "batch_id": str(uuid4()),
                        "quantity_sold": 1,
                    }
                ],
            },
        )
        assert response.status_code == 422
    finally:
        app.dependency_overrides.clear()


def test_vendor_lists_products_and_alerts(
    client: TestClient,
    verifier: StaticVerifier,
) -> None:
    class ListDb:
        async def fetch(self, query: str, *args: object) -> list[dict[str, object]]:
            if "from public.products" in query:
                return [
                    {
                        "id": uuid4(),
                        "name": "Tomato",
                        "low_stock_threshold": 3,
                    }
                ]
            if "from public.alerts" in query:
                return [
                    {
                        "id": uuid4(),
                        "type": "aging",
                        "message": "Banana is old",
                        "severity": "warning",
                        "created_at": NOW,
                        "batch_id": uuid4(),
                        "product_id": uuid4(),
                        "total": 1,
                    }
                ]
            return []

    async def override_connection():
        yield ListDb()

    app.dependency_overrides[get_tenant_connection] = override_connection
    try:
        verifier.claims = vendor_claims()
        products = client.get(
            "/api/v1/products",
            headers={"Authorization": "Bearer valid"},
        )
        alerts = client.get(
            "/api/v1/alerts",
            headers={"Authorization": "Bearer valid"},
        )
        assert products.status_code == 200
        assert products.json()["items"][0]["name"] == "Tomato"
        assert alerts.status_code == 200
        assert alerts.json()["items"][0]["type"] == "aging"
    finally:
        app.dependency_overrides.clear()
