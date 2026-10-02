from datetime import UTC, date, datetime
from uuid import uuid4

import pytest

from app.core.database import get_tenant_connection
from app.main import app
from tests.test_auth import admin_claims, tenant_admin_claims, vendor_claims


class StockSalesConnection:
    async def fetchval(self, query):
        return 2

    async def fetch(self, query, *values):
        if "generate_series" in query:
            return [{"date": date(2026, 10, 2), "transactions": 1, "units": 5}]
        if "public.sale_items" in query:
            assert values == (25, 25)
            return []  # An out-of-range page must still report the real total.
        return [{"id": uuid4(), "product_id": uuid4(), "product_name": "Banana",
                 "quantity_received": 10, "quantity_remaining": 4,
                 "intake_date": datetime(2026, 10, 1, tzinfo=UTC),
                 "current_freshness": "medium", "fresh_to_medium_at": None,
                 "medium_to_spoiled_at": None}]


@pytest.mark.parametrize("claims,expected", [(tenant_admin_claims, 200), (vendor_claims, 403), (admin_claims, 403)])
def test_sales_history_authorization_and_empty_page_totals(client, verifier, claims, expected):
    verifier.claims = claims()

    async def connection():
        yield StockSalesConnection()

    app.dependency_overrides[get_tenant_connection] = connection
    try:
        response = client.get("/api/v1/tenant/sales?offset=25", headers={"Authorization": "Bearer valid"})
        assert response.status_code == expected
        if expected == 200:
            assert response.json()["items"] == []
            assert response.json()["total"] == 2
            assert response.json()["trend"][0]["units"] == 5
            stock = client.get("/api/v1/batches", headers={"Authorization": "Bearer valid"}).json()["items"][0]
            assert stock["current_freshness"] == "medium" and stock["medium_to_spoiled_at"] is None
    finally:
        app.dependency_overrides.clear()


@pytest.mark.parametrize("query", ["days=0", "days=91", "limit=101", "offset=-1"])
def test_sales_history_rejects_invalid_ranges(client, verifier, query):
    verifier.claims = tenant_admin_claims()

    async def connection():
        yield StockSalesConnection()

    app.dependency_overrides[get_tenant_connection] = connection
    try:
        assert client.get(f"/api/v1/tenant/sales?{query}", headers={"Authorization": "Bearer valid"}).status_code == 422
    finally:
        app.dependency_overrides.clear()
