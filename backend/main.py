"""
FastAPI application entry point for SmartCache & LLM Router.

Endpoints:
  GET  /            → health check
  GET  /api/stats   → aggregated runtime statistics
  POST /api/query   → main query pipeline (see routes/query.py)
  GET  /api/recent  → recently cached queries
"""
from __future__ import annotations

import logging
import time
from contextlib import asynccontextmanager
from typing import Any, AsyncGenerator, Dict

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import get_settings
from routes.query import router as query_router, get_pipeline_metrics
from routes.auth import router as auth_router
from routes.chat import router as chat_router
from services.cache import RedisCache
from services.embedder import GeminiEmbedder
from services.llm_client import LLMClient
from services.mongodb import MongoDBService
from services.pii_detector import PIIDetector
from services.router import ComplexityRouter
from services.vector_store import PineconeVectorStore

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)

_START_TIME = time.time()


# ---------------------------------------------------------------------------
# Lifespan – initialise / tear-down shared resources
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    settings = get_settings()
    logger.info("Starting SmartCache LLM Router…")

    # Instantiate services
    embedder = GeminiEmbedder()
    vector_store = PineconeVectorStore()
    cache = RedisCache()
    mongodb = MongoDBService()
    pii_detector = PIIDetector()
    complexity_router = ComplexityRouter()
    llm_client = LLMClient()

    # Initialise async services
    await vector_store.init()
    await cache.init()
    await mongodb.init()

    # Attach to app state so route handlers can retrieve them
    app.state.embedder = embedder
    app.state.vector_store = vector_store
    app.state.cache = cache
    app.state.mongodb = mongodb
    app.state.pii_detector = pii_detector
    app.state.complexity_router = complexity_router
    app.state.llm_client = llm_client

    logger.info(
        "Services ready. similarity_threshold=%.2f  cache_ttl=%ds",
        settings.similarity_threshold,
        settings.cache_ttl_seconds,
    )

    yield  # ── application runs ──

    logger.info("Shutting down SmartCache LLM Router…")
    await cache.close()


# ---------------------------------------------------------------------------
# Application factory
# ---------------------------------------------------------------------------

def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="SmartCache & LLM Router",
        description=(
            "Semantic query caching with PII detection and automatic routing "
            "between Gemini Flash and Gemini Pro."
        ),
        version="1.0.0",
        lifespan=lifespan,
    )

    # ── CORS ────────────────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Routers ─────────────────────────────────────────────────────────
    app.include_router(query_router, prefix="/api")
    app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
    app.include_router(chat_router, prefix="/api/chat", tags=["chat"])

    # ── Root health check ────────────────────────────────────────────────
    @app.get("/", tags=["health"])
    async def health_check() -> Dict[str, Any]:
        return {
            "status": "ok",
            "service": "SmartCache & LLM Router",
            "version": app.version,
            "uptime_seconds": round(time.time() - _START_TIME, 1),
        }

    # ── Stats endpoint ───────────────────────────────────────────────────
    @app.get("/api/stats", tags=["stats"])
    async def get_stats() -> Dict[str, Any]:
        cache: RedisCache = app.state.cache

        redis_stats = await cache.get_stats()
        total_requests = redis_stats.get("total_requests", 0)
        cache_hits = redis_stats.get("cache_hits_exact", 0) + redis_stats.get("cache_hits_semantic", 0)
        cache_misses = redis_stats.get("cache_misses", 0)
        hit_rate = round(cache_hits / total_requests * 100, 1) if total_requests > 0 else 0.0

        pipeline_metrics = get_pipeline_metrics()
        cached_l = pipeline_metrics["cached_latencies"]
        uncached_l = pipeline_metrics["uncached_latencies"]
        all_l = cached_l + uncached_l

        avg_latency = sum(all_l) / len(all_l) if all_l else 0.0
        avg_cached = sum(cached_l) / len(cached_l) if cached_l else 0.0
        avg_uncached = sum(uncached_l) / len(uncached_l) if uncached_l else 0.0

        total_tokens_saved = pipeline_metrics["total_tokens_saved"]
        estimated_cost_saved = total_tokens_saved * 0.000002

        flash_calls = redis_stats.get("flash_calls", 0)
        pro_calls = redis_stats.get("pro_calls", 0)

        return {
            "total_queries": total_requests,
            "cache_hits": cache_hits,
            "cache_misses": cache_misses,
            "cache_hit_rate": hit_rate,
            "avg_latency_ms": round(avg_latency, 1),
            "avg_cached_latency_ms": round(avg_cached, 1),
            "avg_uncached_latency_ms": round(avg_uncached, 1),
            "total_tokens_saved": total_tokens_saved,
            "estimated_cost_savings_usd": round(estimated_cost_saved, 4),
            "model_distribution": {
                "flash": flash_calls,
                "pro": pro_calls,
                "cache": cache_hits,
            },
            "pii_blocked": pipeline_metrics["pii_blocked_count"],
        }

    return app


app = create_app()


# ---------------------------------------------------------------------------
# Dev-server entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )
