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
        self.mobile_redirect_url = "freshlens://set-password"
        self.tenant_admin_redirect_url = settings.tenant_admin_invite_redirect_url
        self.headers = {
            "apikey": settings.supabase_service_role_key,
            "Authorization": f"Bearer {settings.supabase_service_role_key}",
        }

    async def invite(
        self, email: str, name: str, *, redirect_url: str | None = None,
    ) -> UUID:
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                response = await client.post(
                    f"{self.base_url}/invite",
                    headers=self.headers,
                    params={"redirect_to": redirect_url or self.mobile_redirect_url},
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


def get_inviter() -> SupabaseInviter:
    return SupabaseInviter()
