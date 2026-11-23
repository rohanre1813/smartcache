"""
Application configuration loaded from environment / .env file.
"""
from __future__ import annotations

from functools import lru_cache
from typing import List

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- Gemini ---
    gemini_api_key: str = ""

    # --- Pinecone ---
    pinecone_api_key: str = ""
    pinecone_index_name: str = "smartcache-vector"
    pinecone_host: str = ""

    # --- Upstash Redis ---
    upstash_redis_rest_url: str = ""
    upstash_redis_rest_token: str = ""
    redis_url: str = "redis://localhost:6379"

    # --- MongoDB Atlas ---
    mongodb_uri: str = ""
    mongodb_db_name: str = "smartcache"

    # --- Authentication ---
    jwt_secret: str = "smartcache_production_jwt_secret_key_2026"
    jwt_algorithm: str = "HS256"
    jwt_expiry_hours: int = 168  # 7 days

    # --- ChromaDB fallback ---
    chroma_persist_dir: str = "./chroma_db"
    chroma_collection_name: str = "query_cache"

    # --- Semantic cache ---
    similarity_threshold: float = 0.78
    cache_ttl_seconds: int = 86400  # 24 h

    # --- CORS ---
    cors_origins: str = "http://localhost:5173"

    # --- Routing thresholds ---
    complex_token_threshold: int = 150
    complex_keywords: List[str] = [
        "explain",
        "analyse",
        "analyze",
        "compare",
        "summarize",
        "summarise",
        "detail",
        "elaborate",
        "evaluate",
        "architecture",
        "tradeoff",
        "trade-off",
        "implement",
        "debug",
        "refactor",
        "design",
        "proof",
        "derive",
        "contrast",
    ]

    # --- Models ---
    flash_model: str = "models/gemini-3.5-flash"
    pro_model: str = "models/gemini-3.6-flash"
    embedding_model: str = "models/gemini-embedding-001"
    embedding_dimension: int = 3072

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache()
def get_settings() -> Settings:
    return Settings()
