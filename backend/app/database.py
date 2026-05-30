"""
FinSight AI — Asynchronous MongoDB Database Layer

Uses Motor (async MongoDB driver) to provide non-blocking database operations.
Manages connection lifecycle, index creation, and provides collection accessors.
"""

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from typing import Optional
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)


class Database:
    """Singleton-style async MongoDB connection manager."""

    client: Optional[AsyncIOMotorClient] = None
    db: Optional[AsyncIOMotorDatabase] = None

    @classmethod
    async def connect(cls) -> None:
        """Establish connection pool to MongoDB and create indexes."""
        logger.info(f"Connecting to MongoDB at {settings.MONGODB_URL}...")
        cls.client = AsyncIOMotorClient(
            settings.MONGODB_URL,
            maxPoolSize=50,
            minPoolSize=10,
            serverSelectionTimeoutMS=5000,
        )
        cls.db = cls.client[settings.MONGODB_DB_NAME]

        # ── Create Indexes ───────────────────────────────────────
        await cls._create_indexes()
        logger.info("MongoDB connected and indexes ensured.")

    @classmethod
    async def disconnect(cls) -> None:
        """Close the MongoDB connection pool gracefully."""
        if cls.client:
            cls.client.close()
            logger.info("MongoDB connection closed.")

    @classmethod
    async def _create_indexes(cls) -> None:
        """Ensure all required indexes exist for query performance."""
        db = cls.db

        # Transactions: compound index for company lookups sorted by date
        await db.transactions.create_index(
            [("company_id", 1), ("date", -1)],
            name="idx_transactions_company_date",
        )
        # Transactions: sparse index for anomalies
        await db.transactions.create_index(
            [("company_id", 1), ("is_anomaly", 1)],
            name="idx_transactions_anomaly",
            sparse=True,
        )
        # Monthly Financials: unique compound
        await db.monthly_financials.create_index(
            [("company_id", 1), ("month", -1)],
            name="idx_monthly_financials_lookup",
            unique=True,
        )
        # Scenarios: company lookup
        await db.scenarios.create_index(
            [("company_id", 1), ("created_at", -1)],
            name="idx_scenarios_company",
        )

    # ── Collection Accessors ─────────────────────────────────────

    @classmethod
    def get_collection(cls, name: str):
        """Return a Motor collection handle by name."""
        return cls.db[name]

    @classmethod
    @property
    def companies(cls):
        return cls.db["companies"]

    @classmethod
    @property
    def transactions(cls):
        return cls.db["transactions"]

    @classmethod
    @property
    def monthly_financials(cls):
        return cls.db["monthly_financials"]

    @classmethod
    @property
    def scenarios(cls):
        return cls.db["scenarios"]


def get_database() -> AsyncIOMotorDatabase:
    """FastAPI dependency to inject the database instance."""
    return Database.db
