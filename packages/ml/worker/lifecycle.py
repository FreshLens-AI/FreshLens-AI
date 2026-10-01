import math
import os
from datetime import UTC, datetime, timedelta

from worker import db

LIFECYCLE_EVENT_KEYS = (
    "fresh_to_medium_warning",
    "medium_to_spoiled_warning",
)


def _with_platform_admin(connection) -> None:
    connection.execute(
        "select set_config('app.user_role', %s, true)", ("platform_admin",)
    )


def active_tenant_contexts() -> list[tuple[str, str]]:
    with db._connect() as connection:
        _with_platform_admin(connection)
        rows = connection.execute(
            """
            select distinct on (tenants.id)
              tenants.id as tenant_id,
              users.id as user_id
            from public.tenants as tenants
            join public.users as users
              on users.tenant_id = tenants.id
             and users.role = 'vendor'
             and users.status = 'active'
            where tenants.status = 'active'
            order by tenants.id, users.created_at, users.id
            """
        ).fetchall()
    return [(str(row["tenant_id"]), str(row["user_id"])) for row in rows]


def _time_phrase(deadline: datetime, now: datetime) -> str:
    seconds = (deadline - now).total_seconds()
    if seconds <= 0:
        return "now"
    hours = max(1, math.ceil(seconds / 3600))
    if hours < 24:
        return f"in about {hours} hour{'s' if hours != 1 else ''}"
    days = math.ceil(hours / 24)
    return f"in about {days} day{'s' if days != 1 else ''}"


def _insert_alert(connection, *, row, event_key: str, deadline: datetime, now: datetime):
    batch_ref = str(row["id"])[:8]
    remaining = int(row["quantity_remaining"])
    received = int(row["quantity_received"])
    timing = _time_phrase(deadline, now)
    if event_key == "fresh_to_medium_warning":
        severity = "warning"
        message = (
            f"{row['name']} batch {batch_ref} is expected to move to medium "
            f"freshness {timing}. {remaining} of {received} items remain; "
            "prioritize this batch for sale."
        )
    else:
        severity = "critical"
        message = (
            f"{row['name']} batch {batch_ref} is expected to spoil {timing}. "
            f"{remaining} of {received} items remain; sell or discount them soon."
        )
    return connection.execute(
        """
        insert into public.alerts (
          tenant_id, type, event_key, severity, message, product_id, batch_id,
          transition_at
        )
        values (%s, 'aging', %s, %s::public.alert_severity, %s, %s, %s, %s)
        on conflict (tenant_id, batch_id, event_key)
          where batch_id is not null and event_key is not null
        do nothing
        returning id
        """,
        (
            row["tenant_id"],
            event_key,
            severity,
            message,
            row["product_id"],
            row["id"],
            deadline,
        ),
    ).fetchone()


def evaluate_due_lifecycle_alerts(tenant_id: str, user_id: str) -> int:
    lead_hours = max(1, int(os.environ.get("LIFECYCLE_WARNING_LEAD_HOURS", "24")))
    min_ratio = float(os.environ.get("LIFECYCLE_MIN_REMAINING_RATIO", "0.25"))
    min_ratio = min(1.0, max(0.0, min_ratio))
    now = datetime.now(UTC)
    due_before = now + timedelta(hours=lead_hours)
    inserted = 0

    with db._connect() as connection:
        db._with_vendor_tenant(connection, tenant_id, user_id)
        connection.execute(
            """
            update public.alerts as alerts
            set resolved_at = coalesce(alerts.resolved_at, now())
            from public.batches as batches
            where alerts.batch_id = batches.id
              and alerts.event_key = any(%s)
              and alerts.resolved_at is null
              and (
                batches.quantity_remaining = 0
                or (
                  alerts.event_key = 'fresh_to_medium_warning'
                  and batches.fresh_to_medium_at <= now()
                )
              )
            """,
            (list(LIFECYCLE_EVENT_KEYS),),
        )
        rows = connection.execute(
            """
            select
              batches.id,
              batches.tenant_id,
              batches.product_id,
              batches.initial_classification,
              batches.quantity_received,
              batches.quantity_remaining,
              batches.fresh_to_medium_at,
              batches.medium_to_spoiled_at,
              products.name
            from public.batches as batches
            join public.products as products
              on products.id = batches.product_id
             and products.tenant_id = batches.tenant_id
            where batches.quantity_received > 0
              and batches.quantity_remaining > 0
              and batches.quantity_remaining::numeric
                    / batches.quantity_received >= %s
              and (
                (
                  batches.initial_classification = 'fresh'
                  and batches.fresh_to_medium_at <= %s
                )
                or batches.medium_to_spoiled_at <= %s
              )
            order by batches.medium_to_spoiled_at, batches.id
            """,
            (min_ratio, due_before, due_before),
        ).fetchall()

        for row in rows:
            fresh_deadline = row["fresh_to_medium_at"]
            spoiled_deadline = row["medium_to_spoiled_at"]
            if (
                row["initial_classification"] == "fresh"
                and fresh_deadline is not None
                and fresh_deadline <= due_before
                and (
                    spoiled_deadline is None
                    or now < spoiled_deadline - timedelta(hours=lead_hours)
                )
            ):
                inserted += int(
                    _insert_alert(
                        connection,
                        row=row,
                        event_key="fresh_to_medium_warning",
                        deadline=fresh_deadline,
                        now=now,
                    )
                    is not None
                )
            if spoiled_deadline is not None and spoiled_deadline <= due_before:
                inserted += int(
                    _insert_alert(
                        connection,
                        row=row,
                        event_key="medium_to_spoiled_warning",
                        deadline=spoiled_deadline,
                        now=now,
                    )
                    is not None
                )
    return inserted


def pending_alert_notifications(
    tenant_id: str, user_id: str
) -> list[dict[str, object]]:
    with db._connect() as connection:
        db._with_vendor_tenant(connection, tenant_id, user_id)
        rows = connection.execute(
            """
            select id, event_key, severity::text as severity, message
            from public.alerts
            where notification_sent_at is null
              and resolved_at is null
            order by created_at
            limit 100
            """
        ).fetchall()
    return [dict(row) for row in rows]
