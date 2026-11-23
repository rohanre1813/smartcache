"""
VectorStore – Pinecone cloud vector store for semantic query caching,
with automatic ChromaDB local fallback when PINECONE_API_KEY is not configured.
"""
from __future__ import annotations

import asyncio
import logging
import uuid
from typing import Any, Dict, List, Optional, Tuple

from config import get_settings

logger = logging.getLogger(__name__)


class ChromaVectorStore:
    """
    High-performance Vector Store supporting Pinecone (primary) with ChromaDB fallback.
    """

    def __init__(self) -> None:
        settings = get_settings()
        self._threshold = settings.similarity_threshold
        self._pinecone_key = settings.pinecone_api_key
        self._index_name = settings.pinecone_index_name
        self._dimension = settings.embedding_dimension
        self._is_pinecone: bool = False
        self._pinecone_index = None

        # ChromaDB fallback
        self._chroma_client = None
        self._chroma_collection = None
        self._persist_dir = settings.chroma_persist_dir
        self._collection_name = settings.chroma_collection_name

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def init(self) -> None:
        await asyncio.to_thread(self._init_sync)

    def _init_sync(self) -> None:
        if self._pinecone_key and self._pinecone_key != "your_pinecone_api_key_here":
            try:
                from pinecone import Pinecone

                pc = Pinecone(api_key=self._pinecone_key)
                settings = get_settings()
                host = settings.pinecone_host or (self._index_name if self._index_name.startswith("http") else None)
                if host:
                    self._pinecone_index = pc.Index(name="smartcache", host=host)
                else:
                    self._pinecone_index = pc.Index(self._index_name)

                # Test index connectivity
                self._pinecone_index.describe_index_stats()
                self._is_pinecone = True
                logger.info("Pinecone Vector Store connected on index '%s'", self._index_name)
                return
            except Exception as e:
                logger.warning("Could not connect to Pinecone (%s); falling back to ChromaDB", e)
                self._is_pinecone = False

        # Fallback to local ChromaDB
        try:
            import chromadb
            from chromadb.config import Settings as ChromaSettings

            self._chroma_client = chromadb.PersistentClient(
                path=self._persist_dir,
                settings=ChromaSettings(anonymized_telemetry=False),
            )
            self._chroma_collection = self._chroma_client.get_or_create_collection(
                name=self._collection_name,
                metadata={"hnsw:space": "cosine"},
            )
            logger.info("ChromaDB local vector store initialized (%d cached queries)", self._chroma_collection.count())
        except Exception as e:
            logger.error("Failed to initialize ChromaDB fallback: %s", e)

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
        # 1. Pinecone path
        if self._is_pinecone and self._pinecone_index:
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
                logger.info("Pinecone top match: score=%.4f (threshold=%.4f, tenant=%s)", similarity, self._threshold, tenant_id)

                if similarity >= self._threshold:
                    return top.metadata, similarity
                return None
            except Exception as exc:
                logger.error("Pinecone query error: %s; checking Chroma fallback", exc)

        # 2. ChromaDB path
        if self._chroma_collection:
            try:
                count = self._chroma_collection.count()
                if count == 0:
                    return None

                query_params: Dict[str, Any] = {
                    "query_embeddings": [embedding],
                    "n_results": min(n_results, count),
                    "include": ["metadatas", "documents", "distances"],
                }
                # Add tenant filter if specified
                if tenant_id and tenant_id != "all":
                    query_params["where"] = {"tenant_id": tenant_id}

                try:
                    results = self._chroma_collection.query(**query_params)
                except Exception as filter_err:
                    # If legacy documents lack tenant_id field, query without filter
                    logger.debug("ChromaDB query with tenant filter had exception: %s, retrying without filter", filter_err)
                    query_params.pop("where", None)
                    results = self._chroma_collection.query(**query_params)

                if not results["ids"] or not results["ids"][0]:
                    return None

                distance = results["distances"][0][0]
                similarity = max(0.0, min(1.0, 1.0 - distance))

                logger.info("Vector search top match: distance=%.4f, similarity=%.4f (threshold=%.4f)", distance, similarity, self._threshold)

                if similarity >= self._threshold:
                    metadata = results["metadatas"][0][0]
                    return metadata, similarity
            except Exception as exc:
                logger.warning("ChromaDB query error: %s; recreating collection on dimension change", exc)
                try:
                    self._chroma_client.delete_collection(self._collection_name)
                    self._chroma_collection = self._chroma_client.get_or_create_collection(
                        name=self._collection_name,
                        metadata={"hnsw:space": "cosine"},
                    )
                except Exception:
                    pass
                return None

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

        await asyncio.to_thread(self._add_sync, doc_id, query, embedding, metadata)
        return doc_id

        await asyncio.to_thread(self._add_sync, doc_id, query, embedding, metadata)
        return doc_id

    def _add_sync(
        self,
        doc_id: str,
        document: str,
        embedding: List[float],
        metadata: Dict[str, Any],
    ) -> None:
        # 1. Pinecone
        if self._is_pinecone and self._pinecone_index:
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

        # 2. ChromaDB
        if self._chroma_collection:
            try:
                self._chroma_collection.add(
                    ids=[doc_id],
                    embeddings=[embedding],
                    documents=[document],
                    metadatas=[metadata],
                )
            except Exception as e:
                logger.warning("ChromaDB add error (%s); resetting collection", e)
                try:
                    self._chroma_client.delete_collection(self._collection_name)
                    self._chroma_collection = self._chroma_client.get_or_create_collection(
                        name=self._collection_name,
                        metadata={"hnsw:space": "cosine"},
                    )
                    self._chroma_collection.add(
                        ids=[doc_id],
                        embeddings=[embedding],
                        documents=[document],
                        metadatas=[metadata],
                    )
                except Exception:
                    pass
                logger.error("ChromaDB add failed: %s", e)

    async def count(self) -> int:
        if self._is_pinecone and self._pinecone_index:
            try:
                stats = await asyncio.to_thread(self._pinecone_index.describe_index_stats)
                return getattr(stats, "total_vector_count", 0)
            except Exception:
                pass
        if self._chroma_collection:
            return self._chroma_collection.count()
        return 0

    async def get_recent(self, limit: int = 10) -> List[Dict[str, Any]]:
        if self._chroma_collection and self._chroma_collection.count() > 0:
            count = min(limit, self._chroma_collection.count())
            peek = self._chroma_collection.peek(limit=count)
            entries = []
            for i, doc_id in enumerate(peek["ids"]):
                meta = peek["metadatas"][i] if peek["metadatas"] else {}
                entries.append({
                    "id": doc_id,
                    "query": meta.get("query", peek["documents"][i] if peek["documents"] else ""),
                    "response": meta.get("response", ""),
                    "model_used": meta.get("model_used", ""),
                })
            return entries
        return []
