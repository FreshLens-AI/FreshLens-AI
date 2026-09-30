"""Verify Supabase HTTP Auth Hook requests (Standard Webhooks signatures)."""

from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import time

SIGNATURE_TOLERANCE_SECONDS = 300


class HookSignatureError(Exception):
    """The request was not signed by Supabase Auth with the configured secret."""


class HookConfigurationError(Exception):
    """The API has no usable Supabase auth-hook secret."""


def _secret_bytes(secret: str) -> bytes:
    # Supabase shows the secret as "v1,whsec_<base64>".
    value = secret.strip().removeprefix("v1,").removeprefix("whsec_")
    if not value:
        raise HookConfigurationError("Supabase auth hook secret is not configured.")
    try:
        return base64.b64decode(value, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise HookConfigurationError("Supabase auth hook secret is invalid.") from exc


def verify_hook_signature(
    *,
    secret: str,
    webhook_id: str | None,
    timestamp: str | None,
    signature_header: str | None,
    body: bytes,
    now: float | None = None,
) -> None:
    """Reject unsigned, forged, or replayed hook requests."""

    key = _secret_bytes(secret)
    if not webhook_id or not timestamp or not signature_header:
        raise HookSignatureError("Missing webhook signature headers.")
    try:
        sent_at = int(timestamp)
    except ValueError as exc:
        raise HookSignatureError("Invalid webhook timestamp.") from exc
    current = time.time() if now is None else now
    if abs(current - sent_at) > SIGNATURE_TOLERANCE_SECONDS:
        raise HookSignatureError("Webhook timestamp is outside the allowed window.")

    signed = f"{webhook_id}.{timestamp}.".encode() + body
    expected = base64.b64encode(hmac.new(key, signed, hashlib.sha256).digest()).decode()
    for candidate in signature_header.split():
        version, _, value = candidate.partition(",")
        if version == "v1" and hmac.compare_digest(value, expected):
            return
    raise HookSignatureError("Webhook signature does not match.")
