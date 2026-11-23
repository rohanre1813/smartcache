"""
Chat router – Multi-turn conversation sessions, history persistence in MongoDB Atlas,
and context-aware caching for conversational LLM interactions.
"""
from __future__ import annotations

import datetime
import hashlib
import logging
import re
import time
import uuid
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from config import get_settings
from routes.auth import get_current_user_optional, get_current_user_required
from routes.query import (
    SYSTEM_PROMPT_VERSION,
    get_inflight_lock,
    is_temporal_query,
    verify_entity_and_intent,
)
from services.cache import RedisCache
from services.embedder import GeminiEmbedder
from services.llm_client import LLMClient
from services.mongodb import MongoDBService
from services.pii_detector import PIIDetector
from services.router import ComplexityRouter, ModelTier
from services.vector_store import PineconeVectorStore

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class CreateSessionRequest(BaseModel):
    title: Optional[str] = "New Conversation"
    tenant_id: Optional[str] = "default"


class ChatMessageRequest(BaseModel):
    prompt: str
    tenant_id: Optional[str] = None
    is_private: Optional[bool] = False
    force_model: Optional[str] = None


class ChatMessageResponse(BaseModel):
    id: str
    session_id: str
    role: str
    content: str
    timestamp: str
    cache_hit: bool
    cache_type: Optional[str] = None
    model_used: str
    latency_ms: float
    similarity_score: Optional[float] = None
    pii_detected: bool = False
    tokens_used: int = 0
    guardrail_status: Optional[str] = None
    is_temporal: bool = False
    resolved_intent: Optional[str] = None


# ---------------------------------------------------------------------------
# Conversational Context Resolver
# ---------------------------------------------------------------------------

_PRONOUNS_AND_REFERENCES = {
    "he", "she", "it", "they", "him", "her", "them", "his", "its", "their",
    "this", "that", "these", "those", "the same", "how many did he",
    "what about him", "tell me more", "why did he", "where did he", "when did he"
}

def resolve_contextual_intent(prompt: str, history: List[Dict[str, Any]]) -> str:
    """
    In multi-turn chat, converts follow-up queries like 'How many championships did he win?'
    into standalone intents like 'How many championships did Michael Jordan win?'
    so that dual-tier caching (Redis + Vector) achieves high hit rates across conversations.
    """
    clean_prompt = prompt.strip()
    if not history:
        return clean_prompt

    tokens = set(re.findall(r"\b\w+\b", clean_prompt.lower()))
    has_pronoun = bool(tokens & {"he", "she", "it", "they", "him", "her", "his", "its", "their", "this", "that"})
    is_short_followup = len(clean_prompt.split()) <= 6

    if not has_pronoun and not is_short_followup:
        return clean_prompt

    # Look back at the last user message to extract subject entity
    last_user_msg = ""
    for msg in reversed(history):
        if msg.get("role") == "user":
            last_user_msg = msg.get("content", "")
            break

    if not last_user_msg:
        return clean_prompt

    # Extract capitalized proper nouns or key subject from previous turn
    proper_nouns = re.findall(r"\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b", last_user_msg)
    if proper_nouns:
        entity = proper_nouns[0]
        # Replace pronoun with entity
        resolved = re.sub(r"\b(he|she|it|him|her|his)\b", entity, clean_prompt, flags=re.IGNORECASE)
        if entity.lower() not in resolved.lower():
            resolved = f"{resolved} regarding {entity}"
        return resolved

    return clean_prompt


# ---------------------------------------------------------------------------
# Dependencies
# ---------------------------------------------------------------------------

def _get_mongodb(request: Request) -> MongoDBService:
    return request.app.state.mongodb

def _get_embedder(request: Request) -> GeminiEmbedder:
    return request.app.state.embedder

def _get_vector_store(request: Request) -> PineconeVectorStore:
    return request.app.state.vector_store

def _get_cache(request: Request) -> RedisCache:
    return request.app.state.cache

def _get_pii(request: Request) -> PIIDetector:
    return request.app.state.pii_detector

def _get_complexity_router(request: Request) -> ComplexityRouter:
    return request.app.state.complexity_router

def _get_llm(request: Request) -> LLMClient:
    return request.app.state.llm_client


def _salted_cache_key(text: str, tenant_id: str, model_tag: str) -> str:
    salt = f"{tenant_id}:{SYSTEM_PROMPT_VERSION}:{model_tag}:{text}"
    digest = hashlib.sha256(salt.encode("utf-8")).hexdigest()
    return f"smartcache:{tenant_id}:{digest}"


# ---------------------------------------------------------------------------
# Sessions Endpoints
# ---------------------------------------------------------------------------

@router.get("/sessions")
async def list_sessions(
    user: Dict[str, Any] = Depends(get_current_user_required),
    mongodb: MongoDBService = Depends(_get_mongodb),
) -> List[Dict[str, Any]]:
    return await mongodb.get_user_sessions(user["id"])


@router.post("/sessions")
async def create_session(
    body: CreateSessionRequest,
    user: Dict[str, Any] = Depends(get_current_user_required),
    mongodb: MongoDBService = Depends(_get_mongodb),
) -> Dict[str, Any]:
    tenant = body.tenant_id or user.get("tenant_id", "default")
    return await mongodb.create_session(
        user_id=user["id"],
        title=body.title or "New Conversation",
        tenant_id=tenant,
    )


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: str,
    user: Dict[str, Any] = Depends(get_current_user_required),
    mongodb: MongoDBService = Depends(_get_mongodb),
) -> Dict[str, Any]:
    deleted = await mongodb.delete_session(session_id, user["id"])
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found or not owned by user.")
    return {"status": "success", "deleted": True}


@router.get("/sessions/{session_id}/messages")
async def get_messages(
    session_id: str,
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
    mongodb: MongoDBService = Depends(_get_mongodb),
) -> List[Dict[str, Any]]:
    if user:
        sess = await mongodb.get_session_by_id(session_id)
        if sess and sess.get("user_id") and sess["user_id"] != user["id"]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: session belongs to another user.")
    return await mongodb.get_session_messages(session_id, limit=50)


# ---------------------------------------------------------------------------
# Multi-Turn Message Submission with Context-Aware Caching
# ---------------------------------------------------------------------------

@router.post("/sessions/{session_id}/messages", response_model=ChatMessageResponse)
async def send_chat_message(
    session_id: str,
    body: ChatMessageRequest,
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
    mongodb: MongoDBService = Depends(_get_mongodb),
    embedder: GeminiEmbedder = Depends(_get_embedder),
    vector_store: PineconeVectorStore = Depends(_get_vector_store),
    cache: RedisCache = Depends(_get_cache),
    pii_detector: PIIDetector = Depends(_get_pii),
    complexity_router: ComplexityRouter = Depends(_get_complexity_router),
    llm: LLMClient = Depends(_get_llm),
) -> ChatMessageResponse:
    t0 = time.monotonic()
    raw_prompt = body.prompt.strip()
    if not raw_prompt:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Prompt cannot be empty")

    user_id = user["id"] if user else "guest_user"
    tenant_id = body.tenant_id or (user.get("tenant_id", "default") if user else "default")
    is_private = bool(body.is_private)
    guardrail_status: Optional[str] = None

    if user:
        sess = await mongodb.get_session_by_id(session_id)
        if sess and sess.get("user_id") and sess["user_id"] != user["id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: session belongs to another user."
            )

    # 1. Retrieve session history from MongoDB Atlas
    history = await mongodb.get_session_messages(session_id, limit=10)

    # 2. Persist User Message in MongoDB Atlas
    await mongodb.add_message(
        session_id=session_id,
        user_id=user_id,
        role="user",
        content=raw_prompt,
        metadata={"tenant_id": tenant_id},
    )

    # 3. Contextual Intent Condensation for Caching
    resolved_query = resolve_contextual_intent(raw_prompt, history)
    if resolved_query != raw_prompt:
        logger.info("Contextual Intent Resolved: '%s' -> '%s'", raw_prompt, resolved_query)

    # 4. PII Redaction
    pii_result = pii_detector.analyze(resolved_query)
    safe_query = pii_result.anonymized_text if pii_result.has_pii else resolved_query

    # 5. Complexity Routing
    if body.force_model and body.force_model.lower() in ("flash", "pro"):
        tier = ModelTier(body.force_model.lower())
    else:
        routing_info = complexity_router.classify_with_reason(safe_query)
        tier = routing_info["tier"]

    model_tag = "gemini-pro" if tier == ModelTier.PRO else "gemini-flash"

    # 6. Temporal Detection
    is_temporal = is_temporal_query(safe_query)
    if is_temporal:
        guardrail_status = "Temporal Query (60s dynamic TTL / Vector bypass)"

    # 7. Check Upstash Redis Exact Cache (on resolved standalone intent)
    exact_key = _salted_cache_key(safe_query, tenant_id=tenant_id, model_tag=model_tag)
    cached_exact = await cache.get(exact_key)
    if cached_exact and not pii_result.has_pii and not is_private:
        latency_ms = round((time.monotonic() - t0) * 1000, 1)
        answer = cached_exact["response"]

        # Persist Assistant Message in MongoDB Atlas
        msg_doc = await mongodb.add_message(
            session_id=session_id,
            user_id=user_id,
            role="assistant",
            content=answer,
            metadata={
                "cache_hit": True,
                "cache_type": "exact",
                "model_used": "redis-cache",
                "latency_ms": latency_ms,
                "similarity_score": 1.0,
                "tenant_id": tenant_id,
                "resolved_intent": resolved_query if resolved_query != raw_prompt else None,
            },
        )

        return ChatMessageResponse(
            id=msg_doc["id"],
            session_id=session_id,
            role="assistant",
            content=answer,
            timestamp=msg_doc["timestamp"],
            cache_hit=True,
            cache_type="exact",
            model_used="redis-cache",
            latency_ms=latency_ms,
            similarity_score=1.0,
            pii_detected=pii_result.has_pii,
            tokens_used=0,
            guardrail_status=guardrail_status,
            is_temporal=is_temporal,
            resolved_intent=resolved_query if resolved_query != raw_prompt else None,
        )

    # 8. Check Semantic Vector Cache (Pinecone with tenant isolation)
    sem_result = None
    embedding = None
    if not pii_result.has_pii and not is_private and not is_temporal:
        embedding = await embedder.embed(safe_query)
        sem_result = await vector_store.search(embedding, tenant_id=tenant_id)

    if sem_result is not None:
        meta, similarity = sem_result
        cached_query = meta.get("query", "")

        # Guardrail check
        entity_valid, guardrail_reason = verify_entity_and_intent(safe_query, cached_query)
        if not entity_valid:
            guardrail_status = f"Collision Prevented: {guardrail_reason}"
        else:
            latency_ms = round((time.monotonic() - t0) * 1000, 1)
            answer = meta["response"]
            await cache.set(exact_key, {"response": answer, "model_used": "redis-cache"}, ttl=86400)

            msg_doc = await mongodb.add_message(
                session_id=session_id,
                user_id=user_id,
                role="assistant",
                content=answer,
                metadata={
                    "cache_hit": True,
                    "cache_type": "semantic",
                    "model_used": "redis-cache",
                    "latency_ms": latency_ms,
                    "similarity_score": round(similarity, 3),
                    "tenant_id": tenant_id,
                    "resolved_intent": resolved_query if resolved_query != raw_prompt else None,
                },
            )

            return ChatMessageResponse(
                id=msg_doc["id"],
                session_id=session_id,
                role="assistant",
                content=answer,
                timestamp=msg_doc["timestamp"],
                cache_hit=True,
                cache_type="semantic",
                model_used="redis-cache",
                latency_ms=latency_ms,
                similarity_score=round(similarity, 3),
                pii_detected=pii_result.has_pii,
                tokens_used=0,
                guardrail_status="Semantic Cache Match Verified",
                is_temporal=False,
                resolved_intent=resolved_query if resolved_query != raw_prompt else None,
            )

    # 9. Cache Miss -> Cache Stampede Lock & Multi-Turn LLM Generation
    lock = await get_inflight_lock(exact_key)
    async with lock:
        # Double checked lock
        double_check = await cache.get(exact_key)
        if double_check and not pii_result.has_pii and not is_private:
            latency_ms = round((time.monotonic() - t0) * 1000, 1)
            answer = double_check["response"]
            msg_doc = await mongodb.add_message(
                session_id=session_id,
                user_id=user_id,
                role="assistant",
                content=answer,
                metadata={"cache_hit": True, "cache_type": "exact", "latency_ms": latency_ms},
            )
            return ChatMessageResponse(
                id=msg_doc["id"],
                session_id=session_id,
                role="assistant",
                content=answer,
                timestamp=msg_doc["timestamp"],
                cache_hit=True,
                cache_type="exact",
                model_used="redis-cache",
                latency_ms=latency_ms,
                similarity_score=1.0,
                guardrail_status="Stampede Prevented (SingleFlight Lock Hit)",
            )

        # Build context-rich prompt for Gemini with recent history
        context_prompt = safe_query
        if history:
            history_lines = []
            for h in history[-6:]:
                role_label = "User" if h.get("role") == "user" else "Assistant"
                history_lines.append(f"{role_label}: {h.get('content')}")
            history_context = "\n".join(history_lines)
            context_prompt = (
                f"Previous Conversation:\n{history_context}\n\n"
                f"Current Question:\n{safe_query}\n\n"
                f"Provide a helpful, precise answer taking into account the conversation context above."
            )

        llm_res = await llm.generate(context_prompt, tier=tier)
        answer = llm_res["response"]
        tokens_used = llm_res.get("input_tokens", 0) + llm_res.get("output_tokens", 0)

        # Cache in Redis and Vector Store associated with the resolved intent
        if not pii_result.has_pii and not is_private:
            try:
                ttl = 60 if is_temporal else 86400
                await cache.set(exact_key, {"response": answer, "model_used": model_tag}, ttl=ttl)

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

    # Persist Assistant Turn in MongoDB Atlas
    msg_doc = await mongodb.add_message(
        session_id=session_id,
        user_id=user_id,
        role="assistant",
        content=answer,
        metadata={
            "cache_hit": False,
            "model_used": model_tag,
            "latency_ms": latency_ms,
            "tenant_id": tenant_id,
            "tokens_used": tokens_used,
            "guardrail_status": guardrail_status,
            "resolved_intent": resolved_query if resolved_query != raw_prompt else None,
        },
    )

    # Auto-update session title if first turn
    if len(history) <= 1:
        auto_title = raw_prompt[:32] + ("…" if len(raw_prompt) > 32 else "")
        await mongodb.update_session_title(session_id, auto_title)

    return ChatMessageResponse(
        id=msg_doc["id"],
        session_id=session_id,
        role="assistant",
        content=answer,
        timestamp=msg_doc["timestamp"],
        cache_hit=False,
        cache_type=None,
        model_used=model_tag,
        latency_ms=latency_ms,
        similarity_score=None,
        pii_detected=pii_result.has_pii,
        tokens_used=tokens_used,
        guardrail_status=guardrail_status,
        is_temporal=is_temporal,
        resolved_intent=resolved_query if resolved_query != raw_prompt else None,
    )
