import os
from pathlib import Path

import psycopg
from psycopg.rows import dict_row

from worker.classifier import ClassificationResult


AUTO_BATCH_IDENTITY_MIN_CONFIDENCE = 0.75


def _connect() -> psycopg.Connection:
    return psycopg.connect(
        os.environ["DATABASE_URL"],
        sslmode=os.environ.get("DATABASE_SSL_MODE", "prefer"),
        row_factory=dict_row,
    )


def _with_vendor_tenant(connection: psycopg.Connection, tenant_id: str) -> None:
    connection.execute("select set_config('app.tenant_id', %s, true)", (tenant_id,))
    connection.execute("select set_config('app.user_role', %s, true)", ("vendor",))


def set_status(tenant_id: str, scan_id: str, status: str) -> None:
    with _connect() as connection:
        _with_vendor_tenant(connection, tenant_id)
        connection.execute(
            """
            update public.scans
            set status = %s::public.scan_status, updated_at = now()
            where id = %s
            """,
            (status, scan_id),
        )


def _ensure_inventory_batch(
    connection: psycopg.Connection,
    scan_id: str,
    result: ClassificationResult,
) -> tuple[object | None, object | None]:
    """Attach exactly one inventory batch to a confidently identified scan.

    The locked scan row is the idempotency guard: a Celery retry observes the
    batch_id written by the first successful transaction and does not insert a
    second batch.
    """
    scan = connection.execute(
        """
        select product_id, batch_id, quantity
        from public.scans
        where id = %s
        for update
        """,
        (scan_id,),
    ).fetchone()
    if scan is None:
        return None, None

    product_id = scan["product_id"]
    batch_id = scan["batch_id"]
    if batch_id is not None:
        return product_id, batch_id

    # An explicitly supplied product wins. Otherwise, only auto-link a
    # high-confidence identity-v1 label that exactly matches the catalogue.
    if (
        product_id is None
        and result.identity_score is not None
        and result.identity_score >= AUTO_BATCH_IDENTITY_MIN_CONFIDENCE
    ):
        if result.identity_label:
            product = connection.execute(
                """
                select id
                from public.products
                where lower(trim(name)) = lower(trim(%s))
                order by created_at, id
                limit 1
                """,
                (result.identity_label,),
            ).fetchone()
            if product is not None:
                product_id = product["id"]

    if product_id is None:
        return None, None

    batch = connection.execute(
        """
        insert into public.batches (
          tenant_id, product_id, intake_date,
          quantity_received, quantity_remaining
        )
        select tenant_id, %s, now(), quantity, quantity
        from public.scans
        where id = %s
        returning id
        """,
        (product_id, scan_id),
    ).fetchone()
    return product_id, batch["id"] if batch is not None else None


def complete(tenant_id: str, scan_id: str, result: ClassificationResult) -> None:
    with _connect() as connection:
        _with_vendor_tenant(connection, tenant_id)
        product_id, batch_id = _ensure_inventory_batch(connection, scan_id, result)
        connection.execute(
            """
            update public.scans
            set status = 'completed',
                classification = %s::public.classification,
                freshness_score = %s,
                model_version = %s,
                identity_label = %s,
                identity_score = %s,
                identity_model_version = %s,
                product_id = coalesce(%s, product_id),
                batch_id = coalesce(%s, batch_id),
                updated_at = now()
            where id = %s
            """,
            (
                result.label,
                result.score,
                result.model_version,
                result.identity_label,
                result.identity_score,
                result.identity_model_version,
                product_id,
                batch_id,
                scan_id,
            ),
        )
        if (
            result.label == "spoiled"
            and product_id is not None
            and batch_id is not None
        ):
            confidence = f"{result.score:.0%}" if result.score is not None else "unknown"
            product = result.identity_label or "Produce"
            message = (
                f"{product} batch was classified as spoiled "
                f"({confidence} confidence)."
            )
            connection.execute(
                """
                insert into public.alerts (
                  tenant_id, type, severity, message, product_id, batch_id
                )
                select
                  %s, 'spoilage', 'critical', %s, %s, %s
                where not exists (
                  select 1
                  from public.alerts
                  where type = 'spoilage'
                    and batch_id = %s
                )
                """,
                (tenant_id, message, product_id, batch_id, batch_id),
            )


def read_image(image_path: str) -> bytes:
    root = Path(os.environ.get("SCAN_STORAGE_DIR", "./data/scans"))
    relative = Path(image_path)
    if relative.is_absolute() or ".." in relative.parts:
        raise ValueError("image_path must be a relative object key.")
    return (root / relative).read_bytes()
