"""
VectorStore – Pinecone cloud vector store for semantic query caching.
Provides high-performance vector search and upsert with multi-tenant isolation.
"""
from __future__ import annotations

import asyncio
import logging
import uuid
from typing import Any, Dict, List, Optional, Tuple

from config import get_settings

logger = logging.getLogger(__name__)


class PineconeVectorStore:
    """
    High-performance Vector Store backed exclusively by Pinecone cloud.
    """

    def __init__(self) -> None:
        settings = get_settings()
        self._threshold = settings.similarity_threshold
        self._pinecone_key = settings.pinecone_api_key
        self._index_name = settings.pinecone_index_name
        self._dimension = settings.embedding_dimension
        self._is_pinecone: bool = False
        self._pinecone_index = None

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def init(self) -> None:
        await asyncio.to_thread(self._init_sync)

    def _init_sync(self) -> None:
        if not self._pinecone_key:
            logger.error("PINECONE_API_KEY is not configured! Cloud vector store cannot initialize.")
            return

        try:
            from pinecone import Pinecone

            pc = Pinecone(api_key=self._pinecone_key)
            settings = get_settings()
            host = settings.pinecone_host or (self._index_name if self._index_name.startswith("http") else None)
            if host:
                self._pinecone_index = pc.Index(name=self._index_name, host=host)
            else:
                self._pinecone_index = pc.Index(self._index_name)

            # Test index connectivity
            self._pinecone_index.describe_index_stats()
            self._is_pinecone = True
            logger.info("Pinecone Vector Store connected on index '%s'", self._index_name)
        except Exception as e:
            logger.error("Failed to connect to Pinecone index '%s': %s", self._index_name, e)
            self._is_pinecone = False

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def search(
        self, embedding: List[float], n_results: int = 1, tenant_id: Optional[str] = "default"
    ) -> Optional[Tuple[Dict[str, Any], float]]:
        """
        Return the closest stored entry and its similarity score.
        Returns (metadata_dict, similarity_score) where score in [0, 1].
        Filters by tenant_id to prevent multi-tenant data bleed.
        """
        return await asyncio.to_thread(self._search_sync, embedding, n_results, tenant_id)

    def _search_sync(
        self, embedding: List[float], n_results: int, tenant_id: Optional[str] = "default"
    ) -> Optional[Tuple[Dict[str, Any], float]]:
        if not self._is_pinecone or not self._pinecone_index:
            logger.warning("Pinecone index not available for search.")
            return None

        try:
            filter_dict = {"tenant_id": {"$eq": tenant_id}} if tenant_id else None
            res = self._pinecone_index.query(
                vector=embedding,
                top_k=n_results,
                filter=filter_dict,
                include_metadata=True,
            )
            matches = getattr(res, "matches", [])
            if not matches:
                return None

            top = matches[0]
            similarity = float(top.score)
            logger.info(
                "Pinecone top match: score=%.4f (threshold=%.4f, tenant=%s)",
                similarity,
                self._threshold,
                tenant_id,
            )

            if similarity >= self._threshold:
                return top.metadata, similarity
            return None
        except Exception as exc:
            logger.error("Pinecone search error: %s", exc)
            return None

    async def add(
        self,
        query: str,
        embedding: List[float],
        response: str,
        model_used: str,
        tenant_id: Optional[str] = "default",
        extra_metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Store a query-response pair with tenant isolation and return its document id."""
        doc_id = str(uuid.uuid4())
        metadata: Dict[str, Any] = {
            "response": response,
            "model_used": model_used,
            "query": query,
            "tenant_id": tenant_id or "default",
        }
        if extra_metadata:
            metadata.update(extra_metadata)

        await asyncio.to_thread(self._add_sync, doc_id, embedding, metadata)
        return doc_id

    def _add_sync(
        self,
        doc_id: str,
        embedding: List[float],
        metadata: Dict[str, Any],
    ) -> None:
        if not self._is_pinecone or not self._pinecone_index:
            logger.error("Cannot upsert vector: Pinecone is not connected.")
            return

        try:
            self._pinecone_index.upsert(
                vectors=[
                    {
                        "id": doc_id,
                        "values": embedding,
                        "metadata": metadata,
                    }
                ]
            )
            logger.info("Upserted vector into Pinecone (id=%s)", doc_id)
        except Exception as e:
            logger.error("Pinecone upsert failed: %s", e)

    async def count(self) -> int:
        if self._is_pinecone and self._pinecone_index:
            try:
                stats = await asyncio.to_thread(self._pinecone_index.describe_index_stats)
                return getattr(stats, "total_vector_count", 0)
            except Exception:
                pass
        return 0

    async def get_recent(self, limit: int = 10) -> List[Dict[str, Any]]:
        return []


# Backward compatibility alias
ChromaVectorStore = PineconeVectorStore
