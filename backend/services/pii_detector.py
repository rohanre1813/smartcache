"""
PIIDetector – scans text for personally identifiable information using
Microsoft Presidio (with regex fallback) and returns both a flag and a sanitised copy.
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import List, Optional

logger = logging.getLogger(__name__)

# Try importing Presidio; fall back to regex if not installed
_PRESIDIO_AVAILABLE = False
try:
    from presidio_analyzer import AnalyzerEngine, RecognizerResult
    from presidio_anonymizer import AnonymizerEngine
    from presidio_anonymizer.entities import OperatorConfig
    _PRESIDIO_AVAILABLE = True
except ImportError:
    logger.info("Presidio not installed; using built-in regex PII detector")

_DEFAULT_ENTITIES: List[str] = [
    "PERSON",
    "EMAIL_ADDRESS",
    "PHONE_NUMBER",
    "CREDIT_CARD",
    "IBAN_CODE",
    "IP_ADDRESS",
    "LOCATION",
    "US_SSN",
]

# Robust regex patterns for fallback PII detection
_REGEX_PATTERNS = {
    "EMAIL_ADDRESS": r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b",
    "PHONE_NUMBER": r"\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b",
    "CREDIT_CARD": r"\b(?:\d{4}[-\s]?){3}\d{4}\b",
    "US_SSN": r"\b\d{3}-\d{2}-\d{4}\b",
    "IP_ADDRESS": r"\b(?:\d{1,3}\.){3}\d{1,3}\b",
}


@dataclass
class PIIResult:
    has_pii: bool
    entities: List[str] = field(default_factory=list)
    anonymized_text: Optional[str] = None
    original_text: str = ""


class PIIDetector:
    """Presidio Analyzer + Anonymizer with transparent Regex fallback."""

    def __init__(
        self,
        entities: Optional[List[str]] = None,
        language: str = "en",
        score_threshold: float = 0.6,
    ) -> None:
        self._entities = entities or _DEFAULT_ENTITIES
        self._language = language
        self._score_threshold = score_threshold

        if _PRESIDIO_AVAILABLE:
            try:
                self._analyzer = AnalyzerEngine()
                self._anonymizer = AnonymizerEngine()
            except Exception as e:
                logger.warning("Could not initialize Presidio engine (%s); falling back to regex", e)
                self._analyzer = None
                self._anonymizer = None
        else:
            self._analyzer = None
            self._anonymizer = None

    def analyze(self, text: str) -> PIIResult:
        if not text:
            return PIIResult(has_pii=False, original_text=text)

        # 1. Use Presidio if initialized
        if self._analyzer and self._anonymizer:
            try:
                results: List[RecognizerResult] = self._analyzer.analyze(
                    text=text,
                    entities=self._entities,
                    language=self._language,
                    score_threshold=self._score_threshold,
                )
                if results:
                    entity_types = list({r.entity_type for r in results})
                    anonymized = self._anonymizer.anonymize(
                        text=text,
                        analyzer_results=results,
                        operators={
                            entity: OperatorConfig("replace", {"new_value": f"<{entity}>"})
                            for entity in entity_types
                        },
                    )
                    return PIIResult(
                        has_pii=True,
                        entities=entity_types,
                        anonymized_text=anonymized.text,
                        original_text=text,
                    )
            except Exception as exc:
                logger.error("Presidio analysis failed: %s; falling back to regex", exc)

        # 2. Regex fallback
        detected_entities = []
        anonymized = text
        for entity, pattern in _REGEX_PATTERNS.items():
            if re.search(pattern, text):
                detected_entities.append(entity)
                anonymized = re.sub(pattern, f"<{entity}>", anonymized)

        if detected_entities:
            return PIIResult(
                has_pii=True,
                entities=detected_entities,
                anonymized_text=anonymized,
                original_text=text,
            )

        return PIIResult(has_pii=False, original_text=text)

    def has_pii(self, text: str) -> bool:
        return self.analyze(text).has_pii

    def sanitize(self, text: str) -> str:
        res = self.analyze(text)
        return res.anonymized_text if res.has_pii and res.anonymized_text else text
