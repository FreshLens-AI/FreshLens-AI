from uuid import UUID

from celery import Celery
from redis import Redis

TASK_NAME = "classify_scan"


class ClassificationJobPublisher:
    """Enqueue classify work. Redis job keys are tenant-namespaced."""

    def __init__(self, broker_url: str, redis_url: str) -> None:
        self._celery = Celery("freshlens", broker=broker_url)
        self._redis = Redis.from_url(redis_url, decode_responses=True)

    def publish(self, tenant_id: UUID, scan_id: UUID, image_path: str) -> str:
        # ponytail: one shared Celery queue; namespaced key is the tenant boundary.
        # Per-tenant queues if a noisy tenant starves others.
        key = f"tenant:{tenant_id}:scan:{scan_id}"
        result = self._celery.send_task(
            TASK_NAME,
            args=[str(tenant_id), str(scan_id), image_path],
        )
        self._redis.set(key, result.id)
        return str(result.id)


def get_publisher() -> ClassificationJobPublisher:
    from app.core.config import get_settings

    settings = get_settings()
    return ClassificationJobPublisher(settings.celery_broker_url, settings.redis_url)
