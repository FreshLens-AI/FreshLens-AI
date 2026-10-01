from app.core.config import Settings
from app.core.jobs import get_publisher


def test_get_publisher_reuses_one_client(monkeypatch) -> None:
    settings = Settings(
        celery_broker_url="redis://broker/0",
        redis_url="redis://cache/0",
    )
    monkeypatch.setattr("app.core.config.get_settings", lambda: settings)
    get_publisher.cache_clear()

    first = get_publisher()
    second = get_publisher()

    assert first is second
    get_publisher.cache_clear()
