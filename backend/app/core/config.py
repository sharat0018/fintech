"""
FinSight AI — Core Configuration

Centralized environment configuration using Pydantic Settings.
All secrets and tunables are managed here.
"""

from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application-wide configuration loaded from environment variables."""

    # ── Application ──────────────────────────────────────────────
    APP_NAME: str = "FinSight AI"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    # ── MongoDB ──────────────────────────────────────────────────
    MONGODB_URL: str = "mongodb://localhost:27017"
    MONGODB_DB_NAME: str = "finsight_ai"

    # ── Security ─────────────────────────────────────────────────
    JWT_SECRET_KEY: str = "finsight-super-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_MINUTES: int = 1440  # 24 hours

    # ── AI / LLM ─────────────────────────────────────────────────
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "qwen3:14b"

    # ── WebSocket ────────────────────────────────────────────────
    WS_HEARTBEAT_INTERVAL: int = 30  # seconds
    WS_MAX_CONNECTIONS: int = 100

    # ── Transaction Generator ────────────────────────────────────
    GENERATOR_INTERVAL_SECONDS: float = 3.0  # Generate a new txn every N seconds
    GENERATOR_COMPANY_NAME: str = "Acme Ventures Pvt Ltd"

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
