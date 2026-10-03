"""Create and remove a disposable platform-admin used only by the E2E suite.

Credentials are read from the local .env at runtime and never written into git.
The generated password lives only in the process environment.
"""

from __future__ import annotations

import json
import os
import secrets
import subprocess
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[2]
VPS_HOST = os.environ.get("FRESHLENS_VPS_HOST", "azureuser@172.198.64.148")


@dataclass(frozen=True)
class DisposableAdmin:
    user_id: str
    email: str
    password: str

    def __repr__(self) -> str:
        return f"DisposableAdmin(user_id={self.user_id!r}, email={self.email!r})"


def _env_file(name: str) -> str:
    path = ROOT / ".env"
    for line in path.read_text().splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        if key.strip() == name:
            return value.strip().strip('"').strip("'")
    raise RuntimeError(f"{name} is missing from .env")


def _supabase_admin(method: str, path: str, payload: dict | None = None) -> dict:
    url = _env_file("SUPABASE_URL").rstrip("/") + path
    key = _env_file("SUPABASE_SERVICE_ROLE_KEY")
    data = None if payload is None else json.dumps(payload).encode()
    request = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            body = response.read().decode()
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode(errors="replace")[:500]
        raise RuntimeError(f"Supabase admin {method} {path} failed ({exc.code}): {detail}") from exc
    return json.loads(body) if body else {}


def _psql(sql: str) -> str:
    remote = (
        "docker exec -i docker-postgres-1 psql -U freshlens -d freshlens "
        "-v ON_ERROR_STOP=1 -At"
    )
    completed = subprocess.run(
        ["ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=20", VPS_HOST, remote],
        input=sql,
        text=True,
        capture_output=True,
        timeout=60,
        check=False,
    )
    if completed.returncode != 0:
        detail = (completed.stderr or completed.stdout or "ssh failed").strip()
        raise RuntimeError(detail[:800])
    return completed.stdout.strip()


def create_disposable_admin() -> DisposableAdmin:
    """Provision a confirmed Auth user mapped to platform_admin on the VPS."""

    email = f"e2e-{uuid4().hex[:10]}@example.com"
    password = secrets.token_urlsafe(24)
    created = _supabase_admin(
        "POST",
        "/auth/v1/admin/users",
        {
            "email": email,
            "password": password,
            "email_confirm": True,
            "user_metadata": {"display_name": "E2E Platform Admin"},
        },
    )
    user_id = str(created["id"])
    _psql(
        "insert into auth.users (id, email) values "
        f"('{user_id}'::uuid, '{email}') on conflict (id) do nothing;\n"
        "insert into public.users (id, role, display_name, email, status) values "
        f"('{user_id}'::uuid, 'platform_admin', 'E2E Platform Admin', '{email}', 'active');\n"
    )
    return DisposableAdmin(user_id=user_id, email=email, password=password)


def create_unprovisioned_user() -> DisposableAdmin:
    """Auth user with no FreshLens role, used to prove the admin gate."""

    email = f"e2e-norole-{uuid4().hex[:10]}@example.com"
    password = secrets.token_urlsafe(24)
    created = _supabase_admin(
        "POST",
        "/auth/v1/admin/users",
        {"email": email, "password": password, "email_confirm": True},
    )
    return DisposableAdmin(user_id=str(created["id"]), email=email, password=password)


def delete_auth_user(user_id: str) -> None:
    _supabase_admin("DELETE", f"/auth/v1/admin/users/{user_id}")


def delete_app_user(user_id: str) -> None:
    _psql(
        f"delete from public.users where id = '{user_id}'::uuid;\n"
        f"delete from auth.users where id = '{user_id}'::uuid;\n"
    )
