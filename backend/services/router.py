"""
ComplexityRouter – decides whether a prompt should be served by the
lightweight flash model or the more capable pro model.

Decision factors (in order of priority):
1. Explicit complexity keywords anywhere in the prompt.
2. Approximate token count exceeding a configured threshold.
3. Presence of multi-sentence / multi-paragraph structure.
4. Question word heuristics (simple who/what/when → flash, how/why → pro).
"""
from __future__ import annotations

import logging
import re
from enum import Enum
from typing import List

from config import get_settings

logger = logging.getLogger(__name__)


class ModelTier(str, Enum):
    FLASH = "flash"   # gemini-1.5-flash – fast, cheap
    PRO = "pro"       # gemini-1.5-pro   – capable, expensive


class ComplexityRouter:
    """Rule-based prompt complexity classifier."""

    def __init__(self) -> None:
        settings = get_settings()
        self._token_threshold: int = settings.complex_token_threshold
        self._keywords: List[str] = [kw.lower() for kw in settings.complex_keywords]

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def classify(self, prompt: str) -> ModelTier:
        """Return the appropriate ModelTier for *prompt*."""
        if self._has_complexity_keyword(prompt):
            logger.debug("Routing to PRO: keyword match")
            return ModelTier.PRO

        token_count = self._estimate_tokens(prompt)
        if token_count >= self._token_threshold:
            logger.debug("Routing to PRO: token count %d >= %d", token_count, self._token_threshold)
            return ModelTier.PRO

        if self._is_multi_part(prompt):
            logger.debug("Routing to PRO: multi-part prompt detected")
            return ModelTier.PRO

        if self._has_complex_question_words(prompt):
            logger.debug("Routing to PRO: complex question words")
            return ModelTier.PRO

        logger.debug("Routing to FLASH: simple prompt (tokens=%d)", token_count)
        return ModelTier.FLASH

    def classify_with_reason(self, prompt: str) -> dict:
        """Like classify() but also returns a human-readable reason string."""
        tier = self.classify(prompt)
        reasons = []

        if self._has_complexity_keyword(prompt):
            matched = [kw for kw in self._keywords if re.search(rf"\b{re.escape(kw)}\b", prompt, re.IGNORECASE)]
            reasons.append(f"complexity keyword(s): {matched}")

        token_count = self._estimate_tokens(prompt)
        if token_count >= self._token_threshold:
            reasons.append(f"token count {token_count} ≥ threshold {self._token_threshold}")

        if self._is_multi_part(prompt):
            reasons.append("multi-part / multi-sentence prompt")

        if self._has_complex_question_words(prompt):
            reasons.append("complex question words (how/why/explain)")

        reason = "; ".join(reasons) if reasons else "simple prompt – default flash routing"
        return {"tier": tier, "reason": reason, "estimated_tokens": token_count}

    # ------------------------------------------------------------------
    # Heuristics
    # ------------------------------------------------------------------

    def _has_complexity_keyword(self, prompt: str) -> bool:
        lower = prompt.lower()
        for kw in self._keywords:
            if re.search(rf"\b{re.escape(kw)}\b", lower):
                return True
        return False

    @staticmethod
    def _estimate_tokens(text: str) -> int:
        """Rough approximation: 1 token ≈ 4 characters (OpenAI guideline)."""
        return max(1, len(text) // 4)

    @staticmethod
    def _is_multi_part(prompt: str) -> bool:
        """True if prompt has multiple sentences or paragraphs."""
        sentences = re.split(r"[.!?]\s+", prompt.strip())
        if len(sentences) >= 3:
            return True
        paragraphs = [p for p in prompt.split("\n\n") if p.strip()]
        return len(paragraphs) >= 2

    @staticmethod
    def _has_complex_question_words(prompt: str) -> bool:
        complex_patterns = [
            r"\bhow\b",
            r"\bwhy\b",
            r"\bexplain\b",
            r"\bdescribe\s+in\s+detail\b",
            r"\bwhat\s+is\s+the\s+difference\b",
            r"\bcompare\b",
            r"\bpros?\s+and\s+cons?\b",
        ]
        lower = prompt.lower()
        for pat in complex_patterns:
            if re.search(pat, lower):
                return True
        return False
