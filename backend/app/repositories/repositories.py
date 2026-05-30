"""
FinSight AI — Repository Layer

Encapsulates all MongoDB read/write operations.
Provides async CRUD methods for each collection.
"""

from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
from datetime import datetime, date
from typing import List, Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)


def _serialize_doc(doc: dict) -> dict:
    """Convert MongoDB document ObjectIds to strings for JSON serialization."""
    if doc and "_id" in doc:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
    if doc and "company_id" in doc and isinstance(doc["company_id"], ObjectId):
        doc["company_id"] = str(doc["company_id"])
    return doc


class CompanyRepository:
    """CRUD operations for the companies collection."""

    def __init__(self, db: AsyncIOMotorDatabase):
        self.collection = db["companies"]

    async def create(self, data: dict) -> dict:
        data["created_at"] = datetime.utcnow()
        result = await self.collection.insert_one(data)
        data["_id"] = result.inserted_id
        return _serialize_doc(data)

    async def find_by_id(self, company_id: str) -> Optional[dict]:
        doc = await self.collection.find_one({"_id": ObjectId(company_id)})
        return _serialize_doc(doc) if doc else None

    async def find_by_name(self, name: str) -> Optional[dict]:
        doc = await self.collection.find_one({"name": name})
        return _serialize_doc(doc) if doc else None

    async def find_or_create(self, name: str, industry: str = None, currency: str = "INR") -> dict:
        existing = await self.find_by_name(name)
        if existing:
            return existing
        return await self.create({
            "name": name,
            "industry": industry or "Technology",
            "currency": currency,
        })

    async def list_all(self) -> List[dict]:
        cursor = self.collection.find().sort("created_at", -1)
        return [_serialize_doc(doc) async for doc in cursor]


class TransactionRepository:
    """CRUD operations for the transactions collection."""

    def __init__(self, db: AsyncIOMotorDatabase):
        self.collection = db["transactions"]

    async def insert_many(self, transactions: List[dict]) -> int:
        if not transactions:
            return 0
        for txn in transactions:
            txn["created_at"] = datetime.utcnow()
            if isinstance(txn.get("company_id"), str):
                txn["company_id"] = ObjectId(txn["company_id"])
        result = await self.collection.insert_many(transactions)
        return len(result.inserted_ids)

    async def insert_one(self, txn: dict) -> dict:
        txn["created_at"] = datetime.utcnow()
        if isinstance(txn.get("company_id"), str):
            txn["company_id"] = ObjectId(txn["company_id"])
        result = await self.collection.insert_one(txn)
        txn["_id"] = result.inserted_id
        return _serialize_doc(txn)

    async def find_by_company(
        self,
        company_id: str,
        limit: int = 500,
        skip: int = 0,
    ) -> List[dict]:
        cursor = (
            self.collection.find({"company_id": ObjectId(company_id)})
            .sort("date", -1)
            .skip(skip)
            .limit(limit)
        )
        return [_serialize_doc(doc) async for doc in cursor]

    async def find_anomalies(self, company_id: str) -> List[dict]:
        cursor = self.collection.find({
            "company_id": ObjectId(company_id),
            "is_anomaly": True,
        }).sort("anomaly_score", -1)
        return [_serialize_doc(doc) async for doc in cursor]

    async def get_monthly_aggregates(self, company_id: str) -> List[dict]:
        """Aggregate transactions by month for a company."""
        pipeline = [
            {"$match": {"company_id": ObjectId(company_id)}},
            {
                "$group": {
                    "_id": {
                        "year": {"$year": "$date"},
                        "month": {"$month": "$date"},
                    },
                    "total_inflow": {
                        "$sum": {"$cond": [{"$gt": ["$amount", 0]}, "$amount", 0]}
                    },
                    "total_outflow": {
                        "$sum": {"$cond": [{"$lt": ["$amount", 0]}, {"$abs": "$amount"}, 0]}
                    },
                    "net_flow": {"$sum": "$amount"},
                    "transaction_count": {"$sum": 1},
                }
            },
            {"$sort": {"_id.year": 1, "_id.month": 1}},
        ]
        results = []
        async for doc in self.collection.aggregate(pipeline):
            results.append({
                "year": doc["_id"]["year"],
                "month": doc["_id"]["month"],
                "total_inflow": doc["total_inflow"],
                "total_outflow": doc["total_outflow"],
                "net_flow": doc["net_flow"],
                "transaction_count": doc["transaction_count"],
            })
        return results

    async def get_category_breakdown(self, company_id: str) -> List[dict]:
        """Aggregate expenses by category."""
        pipeline = [
            {"$match": {"company_id": ObjectId(company_id), "amount": {"$lt": 0}}},
            {
                "$group": {
                    "_id": "$category",
                    "total": {"$sum": {"$abs": "$amount"}},
                    "count": {"$sum": 1},
                }
            },
            {"$sort": {"total": -1}},
        ]
        results = []
        async for doc in self.collection.aggregate(pipeline):
            results.append({
                "category": doc["_id"],
                "total": doc["total"],
                "count": doc["count"],
            })
        return results

    async def check_duplicate(self, company_id: str, date_val, amount: float, description: str) -> bool:
        """Check if a near-duplicate transaction already exists."""
        doc = await self.collection.find_one({
            "company_id": ObjectId(company_id),
            "date": date_val,
            "amount": amount,
            "description": description,
        })
        return doc is not None

    async def count_by_company(self, company_id: str) -> int:
        return await self.collection.count_documents({"company_id": ObjectId(company_id)})


class MonthlyFinancialsRepository:
    """CRUD for the pre-computed monthly_financials cache."""

    def __init__(self, db: AsyncIOMotorDatabase):
        self.collection = db["monthly_financials"]

    async def upsert(self, company_id: str, month: date, data: dict) -> None:
        data["company_id"] = ObjectId(company_id)
        data["month"] = datetime.combine(month, datetime.min.time())
        data["updated_at"] = datetime.utcnow()
        await self.collection.update_one(
            {"company_id": ObjectId(company_id), "month": data["month"]},
            {"$set": data},
            upsert=True,
        )

    async def get_history(self, company_id: str, limit: int = 24) -> List[dict]:
        cursor = (
            self.collection.find({"company_id": ObjectId(company_id)})
            .sort("month", -1)
            .limit(limit)
        )
        results = [_serialize_doc(doc) async for doc in cursor]
        results.reverse()
        return results


class ScenarioRepository:
    """CRUD for simulation scenario audit logs."""

    def __init__(self, db: AsyncIOMotorDatabase):
        self.collection = db["scenarios"]

    async def save(self, data: dict) -> dict:
        data["created_at"] = datetime.utcnow()
        if isinstance(data.get("company_id"), str):
            data["company_id"] = ObjectId(data["company_id"])
        result = await self.collection.insert_one(data)
        data["_id"] = result.inserted_id
        return _serialize_doc(data)

    async def find_by_company(self, company_id: str, limit: int = 20) -> List[dict]:
        cursor = (
            self.collection.find({"company_id": ObjectId(company_id)})
            .sort("created_at", -1)
            .limit(limit)
        )
        return [_serialize_doc(doc) async for doc in cursor]
