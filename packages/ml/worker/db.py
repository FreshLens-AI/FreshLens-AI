import os
from pathlib import Path

import psycopg
from psycopg.rows import dict_row

from worker.classifier import ClassificationResult


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


def complete(tenant_id: str, scan_id: str, result: ClassificationResult) -> None:
    with _connect() as connection:
        _with_vendor_tenant(connection, tenant_id)
        connection.execute(
            """
            update public.scans
            set status = 'completed',
                classification = %s::public.classification,
                freshness_score = %s,
                model_version = %s,
                updated_at = now()
            where id = %s
            """,
            (result.label, result.score, result.model_version, scan_id),
        )


def read_image(image_path: str) -> bytes:
    root = Path(os.environ.get("SCAN_STORAGE_DIR", "./data/scans"))
    relative = Path(image_path)
    if relative.is_absolute() or ".." in relative.parts:
        raise ValueError("image_path must be a relative object key.")
    return (root / relative).read_bytes()
