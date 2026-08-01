from __future__ import annotations

from typing import Any, Mapping, Protocol
from uuid import UUID

import jwt
from fastapi.concurrency import run_in_threadpool
from jwt import PyJWKClient
from jwt.exceptions import PyJWKClientConnectionError

from app.core.config import Settings, get_settings
from app.schemas.auth import AppRole, AuthPrincipal

SUPPORTED_ALGORITHMS = ("ES256", "RS256")


class AuthenticationError(Exception):
    """The supplied access token could not be trusted."""


class AuthorizationContextError(Exception):
    """The token is valid but lacks a valid FreshLens identity context."""


class AuthConfigurationError(Exception):
    """The API has not been configured with a Supabase project."""


class AuthenticationServiceUnavailableError(Exception):
    """The configured identity provider could not verify access tokens."""


class JWTVerifier(Protocol):
    async def verify(self, token: str) -> Mapping[str, Any]: ...


class SupabaseJWTVerifier:
    """Verify Supabase access tokens against the project's cached JWKS."""

    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        self._jwks_client: PyJWKClient | None = None

    def _client(self) -> PyJWKClient:
        if not self.settings.supabase_url:
            raise AuthConfigurationError("Supabase authentication is not configured.")
        if self._jwks_client is None:
            self._jwks_client = PyJWKClient(
                self.settings.supabase_jwks_url,
                cache_keys=False,
                cache_jwk_set=True,
                lifespan=600,
            )
        return self._jwks_client

    async def verify(self, token: str) -> Mapping[str, Any]:
        try:
            header = jwt.get_unverified_header(token)
            algorithm = header.get("alg")
            if algorithm not in SUPPORTED_ALGORITHMS:
                raise AuthenticationError("Unsupported access-token algorithm.")

            signing_key = await run_in_threadpool(
                self._client().get_signing_key_from_jwt,
                token,
            )
            claims = jwt.decode(
                token,
                signing_key.key,
                algorithms=[algorithm],
                audience=self.settings.supabase_jwt_audience,
                issuer=self.settings.supabase_issuer,
                leeway=self.settings.supabase_jwt_clock_skew_seconds,
                options={
                    "require": [
                        "aud",
                        "exp",
                        "iat",
                        "is_anonymous",
                        "iss",
                        "role",
                        "session_id",
                        "sub",
                    ]
                },
            )
            if claims.get("role") != "authenticated":
                raise AuthenticationError("Access token is not a user session.")
            if claims.get("is_anonymous") is not False:
                raise AuthenticationError("Anonymous sessions are not supported.")
            try:
                UUID(str(claims["session_id"]))
            except (KeyError, TypeError, ValueError) as exc:
                raise AuthenticationError("Invalid session identifier.") from exc
            return claims
        except PyJWKClientConnectionError as exc:
            raise AuthenticationServiceUnavailableError(
                "Supabase signing keys are temporarily unavailable."
            ) from exc
        except (AuthenticationError, AuthConfigurationError):
            raise
        except jwt.PyJWTError as exc:
            raise AuthenticationError("Invalid or expired access token.") from exc
        except Exception as exc:
            raise AuthenticationError("Access token could not be verified.") from exc


def principal_from_claims(claims: Mapping[str, Any]) -> AuthPrincipal:
    """Build a strict app identity from server-signed custom JWT claims."""

    if claims.get("role") != "authenticated":
        raise AuthorizationContextError("Access token is not a user session.")
    if claims.get("is_anonymous") is not False:
        raise AuthorizationContextError("Anonymous sessions are not supported.")

    try:
        user_id = UUID(str(claims["sub"]))
        role = AppRole(str(claims["app_role"]))
    except (KeyError, TypeError, ValueError) as exc:
        raise AuthorizationContextError(
            "Account has not been provisioned with a FreshLens role."
        ) from exc

    tenant_claim = claims.get("tenant_id")
    try:
        tenant_id = UUID(str(tenant_claim)) if tenant_claim else None
    except (TypeError, ValueError) as exc:
        raise AuthorizationContextError("Invalid tenant context.") from exc

    if role is AppRole.VENDOR and tenant_id is None:
        raise AuthorizationContextError("Vendor account has no tenant context.")
    if role is AppRole.PLATFORM_ADMIN and tenant_id is not None:
        raise AuthorizationContextError(
            "Admin account cannot use a vendor tenant context."
        )

    try:
        session_id = UUID(str(claims["session_id"]))
    except (KeyError, TypeError, ValueError) as exc:
        raise AuthorizationContextError("Invalid session identifier.") from exc

    email = claims.get("email")
    return AuthPrincipal(
        user_id=user_id,
        role=role,
        tenant_id=tenant_id,
        email=email if isinstance(email, str) else None,
        session_id=session_id,
    )
