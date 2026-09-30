"""Integration through live HTTP and actual PostgreSQL/Redis/Celery services."""
import base64
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import threading
import time
from uuid import uuid4

import httpx
import psycopg
import pytest
from redis import Redis


def headers(system, actor="a", key=None):
    value = {"Authorization": "Bearer " + system["actors"][actor]["token"]}
    if key:
        value["Idempotency-Key"] = key
    return value


def batch(db, system, quantity=10, actor="a"):
    identity = system["actors"][actor]
    batch_id = str(uuid4())
    db.execute("insert into public.batches(id,tenant_id,product_id,quantity_received,quantity_remaining) values (%s,%s,%s,%s,%s)",
               (batch_id, identity["tenant_id"], identity["product_id"], quantity, quantity))
    return {"source": "manual", "items": [{"product_id": identity["product_id"],
             "batch_id": batch_id, "quantity_sold": 1}]}


def remaining(db, payload):
    return db.execute("select quantity_remaining from public.batches where id=%s",
                      (payload["items"][0]["batch_id"],)).fetchone()[0]


def test_real_jwt_verification_and_role_enforcement(client, system):
    assert client.get("/api/v1/products").status_code == 401
    assert client.get("/api/v1/products", headers={"Authorization": "Bearer invalid"}).status_code == 401
    token = system["actors"]["a"]["token"]
    prefix, signature = token.rsplit(".", 1)
    tampered = prefix + "." + ("A" if signature[0] != "A" else "B") + signature[1:]
    assert client.get("/api/v1/products", headers={"Authorization": "Bearer " + tampered}).status_code == 401
    assert client.get("/api/v1/admin/tenants", headers=headers(system)).status_code == 403
    assert client.get("/api/v1/admin/tenants", headers=headers(system, "admin")).status_code == 200


def test_api_uses_restricted_database_role(system):
    with psycopg.connect(system["runtime_dsn"]) as connection:
        role = connection.execute("select current_user, rolsuper, rolbypassrls from pg_roles where rolname=current_user").fetchone()
    assert role == ("freshlens_api_local", False, False)


def test_tenant_catalogue_isolation_over_http(client, system):
    for actor in ("a", "b"):
        response = client.get("/api/v1/products", headers=headers(system, actor))
        assert response.status_code == 200
        assert {item["id"] for item in response.json()["items"]} == {system["actors"][actor]["product_id"]}


def test_sale_persists_and_identical_retry_deducts_once(client, db, system):
    payload, key = batch(db, system), str(uuid4())
    first = client.post("/api/v1/sales", headers=headers(system, key=key), json=payload)
    second = client.post("/api/v1/sales", headers=headers(system, key=key), json=payload)
    assert first.status_code == second.status_code == 201
    assert first.json()["id"] == second.json()["id"]
    assert remaining(db, payload) == 9
    assert db.execute("select count(*) from public.sales where idempotency_key=%s", (key,)).fetchone()[0] == 1


def test_changed_idempotency_payload_conflicts_without_deduction(client, db, system):
    payload, key = batch(db, system), str(uuid4())
    assert client.post("/api/v1/sales", headers=headers(system, key=key), json=payload).status_code == 201
    payload["items"][0]["quantity_sold"] = 2
    assert client.post("/api/v1/sales", headers=headers(system, key=key), json=payload).status_code == 409
    assert remaining(db, payload) == 9


def test_cross_tenant_sale_is_rejected_without_mutation(client, db, system):
    payload = batch(db, system, actor="b")
    response = client.post("/api/v1/sales", headers=headers(system, key=str(uuid4())), json=payload)
    assert response.status_code == 422
    assert remaining(db, payload) == 10


def test_multiline_oversell_rolls_back_entire_sale(client, db, system):
    first, second = batch(db, system, 5), batch(db, system, 1)
    second["items"][0]["quantity_sold"] = 2
    payload = {"source": "manual", "items": first["items"] + second["items"]}
    key = str(uuid4())
    assert client.post("/api/v1/sales", headers=headers(system, key=key), json=payload).status_code == 422
    assert remaining(db, first) == 5 and remaining(db, second) == 1
    assert db.execute("select count(*) from public.sales where idempotency_key=%s", (key,)).fetchone()[0] == 0


def simultaneous_sales(system, payload, keys):
    barrier = threading.Barrier(len(keys))
    def request(key):
        with httpx.Client(base_url=system["base_url"], timeout=15, trust_env=False) as client:
            barrier.wait(timeout=10)
            return client.post("/api/v1/sales", headers=headers(system, key=key), json=payload)
    with ThreadPoolExecutor(max_workers=len(keys)) as pool:
        return list(pool.map(request, keys))


def test_concurrent_sales_cannot_oversell_last_item(db, system):
    payload = batch(db, system, 1)
    responses = simultaneous_sales(system, payload, [str(uuid4()), str(uuid4())])
    assert sorted(r.status_code for r in responses) == [201, 422]
    assert remaining(db, payload) == 0


@pytest.mark.parametrize("stock", [1, 10])
def test_concurrent_identical_retries_return_one_sale(db, system, stock):
    payload, key = batch(db, system, stock), str(uuid4())
    # Hold the real batch lock until both requests are waiting in PostgreSQL.
    # This makes the duplicate-request race reproducible without mocking code.
    with psycopg.connect(system["owner_dsn"]) as blocker:
        blocker.execute("select id from public.batches where id=%s for update", (payload["items"][0]["batch_id"],))
        with ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(simultaneous_sales, system, payload, [key, key])
            deadline = time.monotonic() + 10
            waiting = 0
            while time.monotonic() < deadline:
                waiting = db.execute("select count(*) from pg_stat_activity where usename='freshlens_api_local' and wait_event_type='Lock'").fetchone()[0]
                if waiting >= 2:
                    break
                time.sleep(0.02)
            blocker.commit()
            responses = future.result(timeout=15)
    assert waiting >= 2, "Both HTTP requests must overlap at database locks"
    assert [r.status_code for r in responses] == [201, 201]
    assert responses[0].json()["id"] == responses[1].json()["id"]
    assert remaining(db, payload) == stock - 1
    assert db.execute("select count(*) from public.sales where idempotency_key=%s", (key,)).fetchone()[0] == 1


def test_concurrent_conflicting_payloads_return_409(db, system):
    first, second, key = batch(db, system), batch(db, system), str(uuid4())
    barrier = threading.Barrier(2)
    def request(payload):
        with httpx.Client(base_url=system["base_url"], timeout=15, trust_env=False) as client:
            barrier.wait(timeout=10)
            return client.post("/api/v1/sales", headers=headers(system, key=key), json=payload)
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(request, [first, second]))
    assert sorted(r.status_code for r in responses) == [201, 409]
    assert remaining(db, first) + remaining(db, second) == 19


def test_same_idempotency_key_is_independent_per_tenant(client, db, system):
    key = str(uuid4())
    a, b = batch(db, system), batch(db, system, actor="b")
    first = client.post("/api/v1/sales", headers=headers(system, key=key), json=a)
    second = client.post("/api/v1/sales", headers=headers(system, "b", key=key), json=b)
    assert first.status_code == second.status_code == 201
    assert first.json()["id"] != second.json()["id"]
    assert remaining(db, a) == remaining(db, b) == 9


def test_low_stock_alert_is_persisted_and_visible(client, db, system):
    payload = batch(db, system, 1)
    assert client.post("/api/v1/sales", headers=headers(system, key=str(uuid4())), json=payload).status_code == 201
    response = client.get("/api/v1/alerts", headers=headers(system))
    assert response.status_code == 200
    matching = [item for item in response.json()["items"] if item["batch_id"] == payload["items"][0]["batch_id"]]
    assert len(matching) == 1
    assert matching[0]["type"] == "low_stock" and matching[0]["severity"] == "critical"


def test_scan_upload_queue_worker_storage_and_tenant_isolation(client, db, system):
    image = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aCxoAAAAASUVORK5CYII=")
    response = client.post("/api/v1/scans", headers=headers(system),
                           files={"image": ("test.png", image, "image/png")},
                           data={"quantity": "3", "product_id": system["actors"]["a"]["product_id"]})
    assert response.status_code == 202
    scan_id = response.json()["id"]
    assert client.get(f"/api/v1/scans/{scan_id}", headers=headers(system, "b")).status_code == 404
    deadline = time.monotonic() + 15
    while time.monotonic() < deadline:
        response = client.get(f"/api/v1/scans/{scan_id}", headers=headers(system))
        assert response.status_code == 200
        scan = response.json()
        if scan["status"] in ("completed", "failed"):
            break
        time.sleep(0.1)
    assert scan["status"] == "completed", scan
    assert scan["model_version"] == "stub-v0" and scan["batch_id"]
    assert (Path(system["scan_storage"]) / scan["image_path"]).read_bytes() == image
    assert db.execute("select quantity_remaining from public.batches where id=%s", (scan["batch_id"],)).fetchone()[0] == 3
    with Redis.from_url(system["redis_url"]) as redis:
        assert redis.get(f'tenant:{system["actors"]["a"]["tenant_id"]}:scan:{scan_id}')
