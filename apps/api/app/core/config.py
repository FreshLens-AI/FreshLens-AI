from functools import lru_cache
from pathlib import Path
from typing import Literal, Self

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

WORKING_DIRECTORY = Path.cwd()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(WORKING_DIRECTORY.parent.parent / ".env", WORKING_DIRECTORY / ".env"),
        extra="ignore",
    )

    app_env: str = "development"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    database_url: str = (
        "postgresql://freshlens_api_local:freshlens_api_local@localhost:5432/freshlens"
    )
    database_ssl_mode: Literal[
        "disable",
        "allow",
        "prefer",
        "require",
        "verify-ca",
        "verify-full",
    ] = "prefer"
    supabase_url: str = ""
    supabase_jwt_audience: str = "authenticated"
    supabase_jwt_clock_skew_seconds: int = 30
    cors_origins: str = (
        "http://localhost:3000,http://localhost:3001,http://localhost:3002"
    )

    @model_validator(mode="after")
    def require_database_tls_in_production(self) -> Self:
        secure_modes = {"require", "verify-ca", "verify-full"}
        if (
            self.app_env.lower() in {"prod", "production"}
            and self.database_ssl_mode not in secure_modes
        ):
            raise ValueError(
                "DATABASE_SSL_MODE must require TLS in production."
            )
        return self

    @property
    def supabase_issuer(self) -> str:
        return f"{self.supabase_url.rstrip('/')}/auth/v1"

    @property
    def supabase_jwks_url(self) -> str:
        return f"{self.supabase_issuer}/.well-known/jwks.json"

    @property
    def allowed_cors_origins(self) -> tuple[str, ...]:
        return tuple(
            origin.strip()
            for origin in self.cors_origins.split(",")
            if origin.strip()
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
