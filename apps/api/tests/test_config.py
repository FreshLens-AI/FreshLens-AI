import pytest
from pydantic import ValidationError

from app.core.config import Settings


def test_production_requires_database_tls() -> None:
    with pytest.raises(ValidationError, match="DATABASE_SSL_MODE"):
        Settings(app_env="production", database_ssl_mode="prefer")


@pytest.mark.parametrize("ssl_mode", ["require", "verify-ca", "verify-full"])
def test_production_accepts_verifying_database_ssl_modes(ssl_mode: str) -> None:
    settings = Settings(app_env="production", database_ssl_mode=ssl_mode)
    assert settings.database_ssl_mode == ssl_mode


def test_cors_origins_are_normalized() -> None:
    settings = Settings(cors_origins="http://localhost:3000, https://admin.test, ")
    assert settings.allowed_cors_origins == (
        "http://localhost:3000",
        "https://admin.test",
    )
