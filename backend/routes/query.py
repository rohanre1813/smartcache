"""
Query router – POST /api/query pipeline and GET /api/recent endpoint.
Maintains high-fidelity stats and in-memory recent query feed matching frontend types.
"""
from __future__ import annotations

import asyncio
import datetime
import hashlib
import logging
import re
import time
import uuid
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field, model_validator

from services.cache import RedisCache
from services.embedder import GeminiEmbedder
from services.llm_client import LLMClient
from services.pii_detector import PIIDetector
from services.router import ComplexityRouter, ModelTier
from services.vector_store import ChromaVectorStore

logger = logging.getLogger(__name__)

router = APIRouter()

# Global ring-buffer of recent queries for /api/recent
_RECENT_QUERIES: List[Dict[str, Any]] = []
_MAX_RECENT = 50

# Global tracking metrics
_METRICS = {
    "cached_latencies": [],
    "uncached_latencies": [],
    "total_tokens_saved": 0,
    "pii_blocked_count": 0,
    "stampede_prevented_count": 0,
    "guardrail_rejections_count": 0,
}

# Production: Version salting against model/prompt drift
SYSTEM_PROMPT_VERSION = "v2.5"

# Production: SingleFlight mutex locks to prevent Cache Stampedes
_INFLIGHT_LOCKS: Dict[str, asyncio.Lock] = {}
_REGISTRY_LOCK = asyncio.Lock()

async def get_inflight_lock(key: str) -> asyncio.Lock:
    async with _REGISTRY_LOCK:
        if key not in _INFLIGHT_LOCKS:
            _INFLIGHT_LOCKS[key] = asyncio.Lock()
        return _INFLIGHT_LOCKS[key]


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class QueryRequest(BaseModel):
    prompt: Optional[str] = None
    query: Optional[str] = None
    force_model: Optional[str] = None
    tenant_id: Optional[str] = "default"
    is_private: Optional[bool] = False

    @model_validator(mode="before")
    @classmethod
    def normalize_fields(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # Accept either prompt or query
            if "prompt" in data and not data.get("query"):
                data["query"] = data["prompt"]
            elif "query" in data and not data.get("prompt"):
                data["prompt"] = data["query"]
        return data


class QueryResponse(BaseModel):
    answer: str
    response: str
    cache_hit: bool
    cached: bool
    model_used: str  # "gemini-flash" | "gemini-pro" | "redis-cache"
    latency_ms: float
    similarity_score: Optional[float] = None
    pii_detected: bool = False
    tokens_used: int = 0
    cache_type: Optional[str] = None
    error: Optional[str] = None
    guardrail_status: Optional[str] = None
    is_temporal: bool = False
    tenant_id: str = "default"


class RecentQueryItem(BaseModel):
    id: str
    prompt: str
    answer: str
    cache_hit: bool
    model_used: str
    latency_ms: float
    similarity_score: Optional[float] = None
    pii_detected: bool = False
    timestamp: str
    guardrail_status: Optional[str] = None


# ---------------------------------------------------------------------------
# Production Guardrail 1: Entity & Intent & Antonym Disambiguation
# ---------------------------------------------------------------------------

_STOP_WORDS = {
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
    "in", "on", "at", "to", "for", "of", "with", "by", "about",
    "what", "who", "which", "where", "when", "why", "how",
    "can", "could", "you", "please", "tell", "me", "give", "share", "show",
    "i", "want", "know", "do", "does", "did"
}

_ANTONYM_PAIRS = [
    ("advantage", "disadvantage"),
    ("advantages", "disadvantages"),
    ("benefit", "drawback"),
    ("benefits", "drawbacks"),
    ("pro", "con"),
    ("pros", "cons"),
    ("good", "bad"),
    ("fast", "slow"),
    ("increase", "decrease"),
    ("buy", "sell"),
    ("positive", "negative"),
    ("before", "after"),
    ("enable", "disable"),
    ("yes", "no"),
    ("true", "false"),
]

def verify_entity_and_intent(incoming: str, cached: str) -> Tuple[bool, str]:
    """
    Prevents false semantic collisions on distinct entities, antonym polarities,
    negations, or differing years/numbers.
    """
    if not cached:
        return True, "No cached query string to compare"

    tokens_inc = re.findall(r"\b\w+\b", incoming.lower())
    tokens_cac = re.findall(r"\b\w+\b", cached.lower())

    set_inc = set(tokens_inc)
    set_cac = set(tokens_cac)

    # 1. Antonym Inversion Guardrail (e.g. advantages vs disadvantages)
    for word_a, word_b in _ANTONYM_PAIRS:
        has_a_inc = word_a in set_inc
        has_b_inc = word_b in set_inc
        has_a_cac = word_a in set_cac
        has_b_cac = word_b in set_cac
        if (has_a_inc and has_b_cac) or (has_b_inc and has_a_cac):
            return False, f"Antonym polarity mismatch: '{word_a}' vs '{word_b}'"

    # 2. Number / Year Guardrail (e.g. 2018 vs 2022)
    nums_inc = {t for t in tokens_inc if t.isdigit()}
    nums_cac = {t for t in tokens_cac if t.isdigit()}
    if nums_inc != nums_cac:
        return False, f"Number mismatch ({nums_inc} vs {nums_cac})"

    # 3. Negation Guardrail (e.g. why is it fast vs why is it not fast)
    negations = {"not", "never", "no", "without", "isn't", "aren't", "doesn't"}
    if bool(set_inc & negations) != bool(set_cac & negations):
        return False, "Negation polarity mismatch"

    # 4. Entity Initial / Single-Letter Distinction (e.g. 'b' in Michael B. Jordan)
    singles_inc = {t for t in tokens_inc if len(t) == 1 and t not in {"a", "i"}}
    singles_cac = {t for t in tokens_cac if len(t) == 1 and t not in {"a", "i"}}
    if singles_inc != singles_cac:
        return False, f"Entity initial distinction mismatch ({singles_inc} vs {singles_cac})"

    # 5. Content Word Overlap (Jaccard on non-stopwords)
    content_inc = {t for t in tokens_inc if t not in _STOP_WORDS}
    content_cac = {t for t in tokens_cac if t not in _STOP_WORDS}
    if content_inc and content_cac:
        overlap = len(content_inc & content_cac) / min(len(content_inc), len(content_cac))
        if overlap < 0.60:
            return False, f"Key entity overlap too low ({overlap:.2f})"

    return True, "Verified"


# ---------------------------------------------------------------------------
# Production Guardrail 2: Temporal / Stale Data Detection
# ---------------------------------------------------------------------------

_TEMPORAL_KEYWORDS = {
    "today", "now", "current", "currently", "latest", "yesterday", "tomorrow",
    "stock", "price", "prices", "weather", "forecast", "breaking", "real-time",
    "live", "trending", "news", "score", "scores", "schedule", "election"
}

def is_temporal_query(query: str) -> bool:
    tokens = set(re.findall(r"\b\w+\b", query.lower()))
    return bool(tokens & _TEMPORAL_KEYWORDS)


# ---------------------------------------------------------------------------
# Dependencies
# ---------------------------------------------------------------------------

def _get_embedder(request: Request) -> GeminiEmbedder:
    return request.app.state.embedder

def _get_vector_store(request: Request) -> ChromaVectorStore:
    return request.app.state.vector_store

def _get_cache(request: Request) -> RedisCache:
    return request.app.state.cache

def _get_pii(request: Request) -> PIIDetector:
    return request.app.state.pii_detector

def _get_complexity_router(request: Request) -> ComplexityRouter:
    return request.app.state.complexity_router

def _get_llm(request: Request) -> LLMClient:
    return request.app.state.llm_client


# Production Guardrail 5: Salted Hash for Tenant Isolation & Model Drift
def _cache_key(text: str, tenant_id: str = "default", model_tag: str = "gemini-flash") -> str:
    salt = f"{tenant_id}:{SYSTEM_PROMPT_VERSION}:{model_tag}:{text}"
    digest = hashlib.sha256(salt.encode("utf-8")).hexdigest()
    return f"smartcache:{tenant_id}:{digest}"


# ---------------------------------------------------------------------------
# POST /api/query
# ---------------------------------------------------------------------------

@router.post("/query", response_model=QueryResponse)
async def handle_query(
    body: QueryRequest,
    embedder: GeminiEmbedder = Depends(_get_embedder),
    vector_store: ChromaVectorStore = Depends(_get_vector_store),
    cache: RedisCache = Depends(_get_cache),
    pii_detector: PIIDetector = Depends(_get_pii),
    complexity_router: ComplexityRouter = Depends(_get_complexity_router),
    llm: LLMClient = Depends(_get_llm),
) -> QueryResponse:
    t0 = time.monotonic()
    raw_prompt = (body.prompt or body.query or "").strip()
    if not raw_prompt:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Prompt cannot be empty",
        )

    tenant_id = body.tenant_id or "default"
    is_private = bool(body.is_private)
    guardrail_status: Optional[str] = None

    # 1. PII detection
    pii_result = pii_detector.analyze(raw_prompt)
    if pii_result.has_pii:
        logger.warning("PII detected in query: %s", pii_result.entities)
        _METRICS["pii_blocked_count"] += 1
        safe_query = pii_result.anonymized_text or raw_prompt
    else:
        safe_query = raw_prompt

    # 2. Complexity routing
    if body.force_model and body.force_model.lower() in ("flash", "pro"):
        tier = ModelTier(body.force_model.lower())
    else:
        routing_info = complexity_router.classify_with_reason(safe_query)
        tier = routing_info["tier"]

    model_tag = "gemini-pro" if tier == ModelTier.PRO else "gemini-flash"
    await cache.increment_stat("total_requests")

    # Production Guardrail 2: Temporal / Stale Data Detection
    is_temporal = is_temporal_query(safe_query)
    if is_temporal:
        guardrail_status = "Temporal Query (60s dynamic TTL / Vector bypass)"

    # 3. Exact-match cache check (Redis with salted hash & tenant isolation)
    exact_key = _cache_key(safe_query, tenant_id=tenant_id, model_tag=model_tag)
    cached_exact = await cache.get(exact_key)
    if cached_exact and not pii_result.has_pii and not is_private:
        await cache.increment_stat("cache_hits_exact")
        latency_ms = round((time.monotonic() - t0) * 1000, 1)
        _METRICS["cached_latencies"].append(latency_ms)
        _METRICS["total_tokens_saved"] += 120

        answer = cached_exact["response"]
        item = {
            "id": f"q_{uuid.uuid4().hex[:8]}",
            "prompt": raw_prompt,
            "answer": answer,
            "cache_hit": True,
            "model_used": "redis-cache",
            "latency_ms": latency_ms,
            "similarity_score": 1.0,
            "pii_detected": pii_result.has_pii,
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "guardrail_status": guardrail_status,
        }
        _RECENT_QUERIES.insert(0, item)
        if len(_RECENT_QUERIES) > _MAX_RECENT:
            _RECENT_QUERIES.pop()

        return QueryResponse(
            answer=answer,
            response=answer,
            cache_hit=True,
            cached=True,
            model_used="redis-cache",
            latency_ms=latency_ms,
            similarity_score=1.0,
            pii_detected=pii_result.has_pii,
            tokens_used=0,
            cache_type="exact",
            guardrail_status=guardrail_status,
            is_temporal=is_temporal,
            tenant_id=tenant_id,
        )

    # 4. Semantic similarity search (Pinecone / ChromaDB with tenant isolation)
    # Bypass vector search if query is temporal, private, or contains PII
    sem_result = None
    embedding = None
    if not pii_result.has_pii and not is_private and not is_temporal:
        embedding = await embedder.embed(safe_query)
        sem_result = await vector_store.search(embedding, tenant_id=tenant_id)

    if sem_result is not None:
        meta, similarity = sem_result
        cached_query = meta.get("query", "")

        # Production Guardrail 1: Entity & Intent & Antonym Disambiguation
        entity_valid, guardrail_reason = verify_entity_and_intent(safe_query, cached_query)
        if not entity_valid:
            _METRICS["guardrail_rejections_count"] += 1
            guardrail_status = f"Collision Prevented: {guardrail_reason}"
            logger.info(
                "Semantic hit REJECTED by Guardrail: %s ('%s' vs '%s')",
                guardrail_reason,
                safe_query,
                cached_query,
            )
        else:
            await cache.increment_stat("cache_hits_semantic")
            latency_ms = round((time.monotonic() - t0) * 1000, 1)
            _METRICS["cached_latencies"].append(latency_ms)
            _METRICS["total_tokens_saved"] += 120

            answer = meta["response"]
            await cache.set(exact_key, {"response": answer, "model_used": "redis-cache"}, ttl=86400)

            item = {
                "id": f"q_{uuid.uuid4().hex[:8]}",
                "prompt": raw_prompt,
                "answer": answer,
                "cache_hit": True,
                "model_used": "redis-cache",
                "latency_ms": latency_ms,
                "similarity_score": round(similarity, 3),
                "pii_detected": pii_result.has_pii,
                "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                "guardrail_status": "Semantic Cache Match Verified",
            }
            _RECENT_QUERIES.insert(0, item)
            if len(_RECENT_QUERIES) > _MAX_RECENT:
                _RECENT_QUERIES.pop()

            return QueryResponse(
                answer=answer,
                response=answer,
                cache_hit=True,
                cached=True,
                model_used="redis-cache",
                latency_ms=latency_ms,
                similarity_score=round(similarity, 3),
                pii_detected=pii_result.has_pii,
                tokens_used=0,
                cache_type="semantic",
                guardrail_status="Semantic Cache Match Verified",
                is_temporal=False,
                tenant_id=tenant_id,
            )

    # 5. Cache Miss -> Cache Stampede Protection (SingleFlight Mutex Lock)
    await cache.increment_stat("cache_misses")

    lock = await get_inflight_lock(exact_key)
    async with lock:
        # Double-checked locking: Another concurrent request may have populated cache while we waited
        double_check = await cache.get(exact_key)
        if double_check and not pii_result.has_pii and not is_private:
            _METRICS["stampede_prevented_count"] += 1
            latency_ms = round((time.monotonic() - t0) * 1000, 1)
            _METRICS["cached_latencies"].append(latency_ms)
            _METRICS["total_tokens_saved"] += 120
            answer = double_check["response"]

            return QueryResponse(
                answer=answer,
                response=answer,
                cache_hit=True,
                cached=True,
                model_used="redis-cache",
                latency_ms=latency_ms,
                similarity_score=1.0,
                pii_detected=pii_result.has_pii,
                tokens_used=0,
                cache_type="exact",
                guardrail_status="Stampede Prevented (SingleFlight Lock Hit)",
                is_temporal=is_temporal,
                tenant_id=tenant_id,
            )

        # Call LLM
        llm_res = await llm.generate(safe_query, tier=tier)
        answer = llm_res["response"]
        tokens_used = llm_res.get("input_tokens", 0) + llm_res.get("output_tokens", 0)

        if tier == ModelTier.PRO:
            await cache.increment_stat("pro_calls")
        else:
            await cache.increment_stat("flash_calls")

        # 6. Store in caches (unless sensitive PII or private)
        if not pii_result.has_pii and not is_private:
            try:
                # Dynamic TTL: 60s for temporal queries, 24 hours for standard
                ttl = 60 if is_temporal else 86400
                await cache.set(exact_key, {"response": answer, "model_used": model_tag}, ttl=ttl)

                # Only persist to semantic vector index if not temporal
                if not is_temporal:
                    if embedding is None:
                        embedding = await embedder.embed(safe_query)
                    await vector_store.add(
                        query=safe_query,
                        embedding=embedding,
                        response=answer,
                        model_used=model_tag,
                        tenant_id=tenant_id,
                    )
            except Exception as e:
                logger.error("Failed to persist to cache: %s", e)

    latency_ms = round((time.monotonic() - t0) * 1000, 1)
    _METRICS["uncached_latencies"].append(latency_ms)

    item = {
        "id": f"q_{uuid.uuid4().hex[:8]}",
        "prompt": raw_prompt,
        "answer": answer,
        "cache_hit": False,
        "model_used": model_tag,
        "latency_ms": latency_ms,
        "similarity_score": None,
        "pii_detected": pii_result.has_pii,
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "guardrail_status": guardrail_status,
    }
    _RECENT_QUERIES.insert(0, item)
    if len(_RECENT_QUERIES) > _MAX_RECENT:
        _RECENT_QUERIES.pop()

    return QueryResponse(
        answer=answer,
        response=answer,
        cache_hit=False,
        cached=False,
        model_used=model_tag,
        latency_ms=latency_ms,
        similarity_score=None,
        pii_detected=pii_result.has_pii,
        tokens_used=tokens_used,
        cache_type=None,
        guardrail_status=guardrail_status,
        is_temporal=is_temporal,
        tenant_id=tenant_id,
    )


# ---------------------------------------------------------------------------
# GET /api/recent
# ---------------------------------------------------------------------------

@router.get("/recent", response_model=List[RecentQueryItem])
async def get_recent() -> List[RecentQueryItem]:
    """Return in-memory chronological list of recent query events."""
    return [RecentQueryItem(**q) for q in _RECENT_QUERIES[:20]]


def get_pipeline_metrics() -> Dict[str, Any]:
    return _METRICS
