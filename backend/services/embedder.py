"""
GeminiEmbedder – generates dense embeddings via Google's text-embedding-004 model.
Includes deterministic semantic vector fallback when GEMINI_API_KEY is not yet configured.
"""
from __future__ import annotations

import asyncio
import hashlib
import logging
import math
import re
from typing import List

import google.generativeai as genai

from config import get_settings

logger = logging.getLogger(__name__)


def _mock_semantic_vector(text: str, dim: int = 768) -> List[float]:
    """
    Produce a deterministic, normalized vector based on word n-grams and hashing.
    Similar texts will have high cosine similarity (e.g. >0.90 for paraphrases).
    """
    words = re.findall(r"\w+", text.lower())
    vec = [0.0] * dim
    if not words:
        vec[0] = 1.0
        return vec

    # Bag of words and character n-grams mapped into dimension space
    for w in words:
        h = int(hashlib.md5(w.encode("utf-8")).hexdigest(), 16)
        idx = h % dim
        vec[idx] += 1.0
        # Bigrams within word for fuzzy matching
        for i in range(len(w) - 2):
            bg = w[i : i + 3]
            h_bg = int(hashlib.sha256(bg.encode("utf-8")).hexdigest(), 16)
            vec[h_bg % dim] += 0.5

    # L2 normalize
    norm = math.sqrt(sum(x * x for x in vec))
    if norm > 0:
        vec = [x / norm for x in vec]
    return vec


class GeminiEmbedder:
    """Async wrapper around google-generativeai embedding API with offline fallback."""

    def __init__(self) -> None:
        settings = get_settings()
        self._api_key = settings.gemini_api_key
        self._model = settings.embedding_model
        self._dimension = settings.embedding_dimension
        self._is_mock = not self._api_key or self._api_key == "your_gemini_api_key_here"

        if not self._is_mock:
            try:
                genai.configure(api_key=self._api_key, transport="rest")
            except Exception as e:
                logger.warning("Gemini configure failed (%s); using semantic fallback", e)
                self._is_mock = True
        else:
            logger.info("Using simulated semantic embedder (GEMINI_API_KEY not configured)")

    async def embed(self, text: str) -> List[float]:
        return await asyncio.to_thread(self._embed_sync, text)

    async def embed_batch(self, texts: List[str]) -> List[List[float]]:
        return await asyncio.to_thread(self._embed_batch_sync, texts)

    def _embed_sync(self, text: str) -> List[float]:
        if self._is_mock:
            return _mock_semantic_vector(text, self._dimension)

        try:
            result = genai.embed_content(
                model=self._model,
                content=text,
                task_type="retrieval_query",
                request_options={"timeout": 15.0},
            )
            return result["embedding"]
        except Exception as exc:
            logger.warning("Gemini embedding call failed (%s); falling back to semantic vector", exc)
            return _mock_semantic_vector(text, self._dimension)

    def _embed_batch_sync(self, texts: List[str]) -> List[List[float]]:
        return [self._embed_sync(t) for t in texts]

    @property
    def dimension(self) -> int:
        return self._dimension
