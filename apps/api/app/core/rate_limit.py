import logging
import time
from functools import lru_cache
from uuid import UUID

from redis.asyncio import Redis

logger = logging.getLogger(__name__)


class TenantRateLimiter:
    """Fixed one-minute window per tenant and route, in tenant-namespaced keys."""

    def __init__(self, redis_url: str) -> None:
        self._redis = Redis.from_url(redis_url, decode_responses=True)

    async def allow(self, tenant_id: UUID, route: str, limit: int) -> bool:
        window = int(time.time() // 60)
        key = f"tenant:{tenant_id}:rl:{route}:{window}"
        try:
            async with self._redis.pipeline(transaction=True) as pipe:
                pipe.incr(key)
                pipe.expire(key, 120)
                count, _ = await pipe.execute()
        except Exception as exc:
            # Fail open: a Redis outage should not block sales entry.
            logger.warning("rate limiter unavailable: %s", type(exc).__name__)
            return True
        return int(count) <= limit


@lru_cache
def get_rate_limiter() -> TenantRateLimiter:
    from app.core.config import get_settings

    return TenantRateLimiter(get_settings().redis_url)
