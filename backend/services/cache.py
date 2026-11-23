"""
RedisCache – Upstash Redis key/value store for exact-match and metadata caching.
Supports Upstash REST API (URL + Token) and standard Redis URL (including rediss:// for Upstash).
Seamless in-memory fallback if credentials are not yet configured.
"""
from __future__ import annotations

import json
import logging
import time
from typing import Any, Dict, Optional

from config import get_settings

logger = logging.getLogger(__name__)

_STATS_KEY = "smartcache:stats"


class RedisCache:
    """Upstash Redis client with JSON helpers, running statistics, and in-memory fallback."""

    def __init__(self) -> None:
        settings = get_settings()
        self._url = settings.redis_url
        self._upstash_url = settings.upstash_redis_rest_url
        self._upstash_token = settings.upstash_redis_rest_token
        self._ttl = settings.cache_ttl_seconds

        self._upstash_client = None
        self._redis_client = None
        self._mode = "in_memory"

        self._fallback_store: Dict[str, tuple[Dict[str, Any], float]] = {}
        self._fallback_stats: Dict[str, int] = {}

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def init(self) -> None:
        # 1. Try Upstash REST client first if configured
        if self._upstash_url and self._upstash_token and self._upstash_url != "your_upstash_redis_rest_url_here":
            try:
                from upstash_redis.asyncio import Redis as UpstashRedis

                self._upstash_client = UpstashRedis(
                    url=self._upstash_url,
                    token=self._upstash_token,
                )
                await self._upstash_client.ping()
                self._mode = "upstash_rest"
                logger.info("Connected to Upstash Redis via REST API: %s", self._upstash_url)
                return
            except Exception as e:
                logger.warning("Upstash REST connection failed (%s); checking standard Redis URL", e)

        # 2. Try standard Redis client (also handles Upstash rediss:// URLs)
        if self._url and self._url != "redis://localhost:6379" or "upstash.io" in self._url:
            try:
                import redis.asyncio as aioredis

                self._redis_client = aioredis.from_url(
                    self._url,
                    encoding="utf-8",
                    decode_responses=True,
                    socket_connect_timeout=2.0,
                )
                await self._redis_client.ping()
                self._mode = "redis_tcp"
                logger.info("Connected to Redis via TCP/TLS: %s", self._url)
                return
            except Exception as e:
                logger.warning("Redis TCP connection failed (%s); falling back to in-memory cache", e)

        # 3. Fallback to in-memory cache
        self._mode = "in_memory"
        logger.info("Upstash credentials not configured; using high-speed in-memory cache")

    async def close(self) -> None:
        if self._redis_client:
            try:
                await self._redis_client.aclose()
            except Exception:
                pass
        if self._upstash_client:
            try:
                await self._upstash_client.close()
            except Exception:
                pass

    # ------------------------------------------------------------------
    # Core get / set
    # ------------------------------------------------------------------

    async def get(self, key: str) -> Optional[Dict[str, Any]]:
        # Upstash REST
        if self._mode == "upstash_rest" and self._upstash_client:
            try:
                raw = await self._upstash_client.get(key)
                if raw is not None:
                    return json.loads(raw) if isinstance(raw, str) else raw
                return None
            except Exception as e:
                logger.error("Upstash GET error for key=%r: %s", key, e)

        # Standard Redis
        if self._mode == "redis_tcp" and self._redis_client:
            try:
                raw = await self._redis_client.get(key)
                if raw is not None:
                    return json.loads(raw)
                return None
            except Exception as e:
                logger.error("Redis GET error for key=%r: %s", key, e)

        # In-memory fallback
        item = self._fallback_store.get(key)
        if item:
            val, expiry = item
            if expiry == 0 or expiry > time.time():
                return val
            del self._fallback_store[key]
        return None

    async def set(
        self,
        key: str,
        value: Dict[str, Any],
        ttl: Optional[int] = None,
    ) -> bool:
        actual_ttl = ttl if ttl is not None else self._ttl

        # Upstash REST
        if self._mode == "upstash_rest" and self._upstash_client:
            try:
                payload = json.dumps(value)
                await self._upstash_client.set(key, payload, ex=actual_ttl)
                return True
            except Exception as e:
                logger.error("Upstash SET error for key=%r: %s", key, e)

        # Standard Redis
        if self._mode == "redis_tcp" and self._redis_client:
            try:
                await self._redis_client.set(
                    key,
                    json.dumps(value),
                    ex=actual_ttl,
                )
                return True
            except Exception as e:
                logger.error("Redis SET error for key=%r: %s", key, e)

        # In-memory fallback
        expiry = time.time() + actual_ttl if actual_ttl > 0 else 0
        self._fallback_store[key] = (value, expiry)
        return True

    # ------------------------------------------------------------------
    # Statistics
    # ------------------------------------------------------------------

    async def increment_stat(self, field: str, amount: int = 1) -> None:
        self._fallback_stats[field] = self._fallback_stats.get(field, 0) + amount

        if self._mode == "upstash_rest" and self._upstash_client:
            try:
                await self._upstash_client.hincrby(_STATS_KEY, field, amount)
            except Exception:
                pass
        elif self._mode == "redis_tcp" and self._redis_client:
            try:
                await self._redis_client.hincrby(_STATS_KEY, field, amount)
            except Exception:
                pass

    async def get_stats(self) -> Dict[str, int]:
        if self._mode == "upstash_rest" and self._upstash_client:
            try:
                raw = await self._upstash_client.hgetall(_STATS_KEY)
                if raw:
                    return {str(k): int(v) for k, v in raw.items()}
            except Exception:
                pass
        elif self._mode == "redis_tcp" and self._redis_client:
            try:
                raw = await self._redis_client.hgetall(_STATS_KEY)
                if raw:
                    return {str(k): int(v) for k, v in raw.items()}
            except Exception:
                pass

        return dict(self._fallback_stats)

    async def ping(self) -> bool:
        if self._mode == "upstash_rest" and self._upstash_client:
            try:
                return bool(await self._upstash_client.ping())
            except Exception:
                return False
        elif self._mode == "redis_tcp" and self._redis_client:
            try:
                return bool(await self._redis_client.ping())
            except Exception:
                return False
        return True
