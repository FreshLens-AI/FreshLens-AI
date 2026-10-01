import httpx
from uuid import UUID

from app.core.config import get_settings


class InviteError(Exception):
    def __init__(self, message: str, status_code: int = 502) -> None:
        super().__init__(message)
        self.status_code = status_code


class SupabaseInviter:
    """Use the server-only Auth Admin API to email a password-setup link."""

    def __init__(self) -> None:
        settings = get_settings()
        if not settings.supabase_url or not settings.supabase_service_role_key:
            raise InviteError("Tenant invitations are not configured.", 503)
        self.base_url = f"{settings.supabase_url.rstrip('/')}/auth/v1"
        self.redirect_url = "freshlens://set-password"
        self.headers = {
            "apikey": settings.supabase_service_role_key,
            "Authorization": f"Bearer {settings.supabase_service_role_key}",
        }

    async def invite(self, email: str, name: str) -> UUID:
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                response = await client.post(
                    f"{self.base_url}/invite",
                    headers=self.headers,
                    params={"redirect_to": self.redirect_url},
                    json={"email": email, "data": {"name": name}},
                )
        except httpx.HTTPError as exc:
            raise InviteError("Could not reach the email invitation service.") from exc
        if response.status_code in (409, 422):
            raise InviteError("This email already has an account or cannot be invited.", 409)
        if response.is_error:
            raise InviteError("Could not send the invitation email.")
        try:
            payload = response.json()
            return UUID(payload.get("user", payload)["id"])
        except (KeyError, TypeError, ValueError) as exc:
            raise InviteError("The invitation service returned an invalid user.") from exc

    async def delete(self, user_id: UUID) -> None:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.delete(
                f"{self.base_url}/admin/users/{user_id}", headers=self.headers,
            )
            response.raise_for_status()

    async def provision_hosted_identity(
        self, tenant_id: UUID, tenant_name: str, user_id: UUID,
        vendor_name: str, email: str,
    ) -> None:
        """Mirror local Compose identities where the hosted JWT hook can see them."""
        headers = {**self.headers, "Prefer": "return=minimal"}
        async with httpx.AsyncClient(timeout=15) as client:
            try:
                tenant = await client.post(
                    f"{self.base_url.removesuffix('/auth/v1')}/rest/v1/tenants",
                    headers=headers, json={"id": str(tenant_id), "name": tenant_name},
                )
                tenant.raise_for_status()
                await self._provision_hosted_user(
                    client, headers, tenant_id, user_id, vendor_name, email,
                )
            except httpx.HTTPError as exc:
                raise InviteError("Could not provision the vendor in Supabase.") from exc

    async def _provision_hosted_user(
        self, client: httpx.AsyncClient, headers: dict[str, str], tenant_id: UUID,
        user_id: UUID, vendor_name: str, email: str,
    ) -> None:
        user = await client.post(
            f"{self.base_url.removesuffix('/auth/v1')}/rest/v1/users",
            headers=headers,
            json={"id": str(user_id), "tenant_id": str(tenant_id),
                  "role": "vendor", "display_name": vendor_name, "email": email},
        )
        user.raise_for_status()

    async def provision_hosted_user(
        self, tenant_id: UUID, user_id: UUID, vendor_name: str, email: str,
    ) -> None:
        headers = {**self.headers, "Prefer": "return=minimal"}
        async with httpx.AsyncClient(timeout=15) as client:
            try:
                await self._provision_hosted_user(
                    client, headers, tenant_id, user_id, vendor_name, email,
                )
            except httpx.HTTPError as exc:
                raise InviteError("Could not provision the vendor in Supabase.") from exc

    async def delete_hosted_user(self, user_id: UUID) -> None:
        base = self.base_url.removesuffix('/auth/v1')
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.delete(
                f"{base}/rest/v1/users", headers=self.headers,
                params={"id": f"eq.{user_id}"},
            )
            response.raise_for_status()

    async def delete_hosted_identity(self, tenant_id: UUID, user_id: UUID) -> None:
        base = self.base_url.removesuffix('/auth/v1')
        async with httpx.AsyncClient(timeout=15) as client:
            for table, column, value in (
                ("users", "id", user_id), ("tenants", "id", tenant_id),
            ):
                response = await client.delete(
                    f"{base}/rest/v1/{table}", headers=self.headers,
                    params={column: f"eq.{value}"},
                )
                response.raise_for_status()


def get_inviter() -> SupabaseInviter:
    return SupabaseInviter()
