"""
FinSight AI — Real-Time Transaction Generator

Generates realistic mock financial transactions for demo purposes.
"""

import random
from datetime import datetime, timedelta
from typing import List
import logging

logger = logging.getLogger(__name__)

REVENUE_TEMPLATES = [
    {"description": "SaaS Subscription Payment", "category": "Revenue", "range": (5000, 50000)},
    {"description": "Enterprise License Fee", "category": "Revenue", "range": (100000, 500000)},
    {"description": "Consulting Services Invoice", "category": "Revenue", "range": (25000, 150000)},
    {"description": "Product Sales Revenue", "category": "Revenue", "range": (10000, 80000)},
    {"description": "API Usage Billing", "category": "Revenue", "range": (3000, 25000)},
    {"description": "Support Plan Subscription", "category": "Revenue", "range": (8000, 35000)},
]

EXPENSE_TEMPLATES = [
    {"description": "AWS Cloud Infrastructure", "category": "Hosting", "range": (15000, 120000)},
    {"description": "Employee Payroll - Engineering", "category": "Payroll", "range": (200000, 800000)},
    {"description": "Employee Payroll - Operations", "category": "Payroll", "range": (100000, 400000)},
    {"description": "Google Ads Campaign", "category": "Marketing", "range": (20000, 150000)},
    {"description": "LinkedIn Advertising", "category": "Marketing", "range": (10000, 60000)},
    {"description": "Slack Business License", "category": "SaaS", "range": (5000, 20000)},
    {"description": "Salesforce CRM License", "category": "SaaS", "range": (15000, 60000)},
    {"description": "Office Rent - Bangalore", "category": "Rent", "range": (80000, 250000)},
    {"description": "Legal Compliance Fee", "category": "Consulting", "range": (15000, 50000)},
    {"description": "Equipment Purchase - Laptops", "category": "Equipment", "range": (50000, 200000)},
    {"description": "GST Payment", "category": "Taxes", "range": (25000, 150000)},
    {"description": "Electricity & Internet Bills", "category": "Utilities", "range": (5000, 25000)},
]

ANOMALY_TEMPLATES = [
    {"description": "Unknown SaaS Vendor Charge", "category": "SaaS", "range": (80000, 200000)},
    {"description": "Duplicate AWS Billing Error", "category": "Hosting", "range": (120000, 300000)},
    {"description": "Unverified Consulting Payment", "category": "Consulting", "range": (200000, 500000)},
]


class TransactionGenerator:
    """Produces realistic mock transactions for real-time demo streaming."""

    ANOMALY_PROBABILITY = 0.05

    def __init__(self):
        self._txn_counter = 0

    def generate_transaction(self) -> dict:
        self._txn_counter += 1
        is_revenue = random.random() < 0.30
        is_anomaly = random.random() < self.ANOMALY_PROBABILITY

        if is_anomaly and not is_revenue:
            template = random.choice(ANOMALY_TEMPLATES)
            amount = -random.randint(*template["range"])
            return {
                "date": datetime.utcnow(),
                "description": template["description"],
                "category": template["category"],
                "amount": amount,
                "account_type": "Operating",
                "is_anomaly": True,
                "anomaly_score": round(random.uniform(0.70, 0.95), 4),
                "anomaly_reason": f"Unusual amount ₹{abs(amount):,} for '{template['category']}'",
            }

        if is_revenue:
            template = random.choice(REVENUE_TEMPLATES)
            amount = random.randint(*template["range"])
        else:
            template = random.choice(EXPENSE_TEMPLATES)
            amount = -random.randint(*template["range"])

        return {
            "date": datetime.utcnow(),
            "description": template["description"],
            "category": template["category"],
            "amount": amount,
            "account_type": "Operating",
            "is_anomaly": False,
            "anomaly_score": 0.0,
            "anomaly_reason": None,
        }

    def generate_historical_batch(self, months: int = 12, per_month: int = 40) -> List[dict]:
        """Generate a batch of historical transactions spanning N months."""
        transactions = []
        base_date = datetime.utcnow() - timedelta(days=months * 30)
        for m in range(months):
            month_date = base_date + timedelta(days=m * 30)
            for _ in range(per_month):
                txn = self.generate_transaction()
                txn["date"] = month_date + timedelta(days=random.randint(0, 28))
                transactions.append(txn)
        transactions.sort(key=lambda t: t["date"])
        return transactions
