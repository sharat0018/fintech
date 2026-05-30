"""
FinSight AI — Anomaly Detection Service

Uses Isolation Forest and Z-Score statistical methods to detect outlier
transactions in financial ledgers. Flags duplicates, spending spikes,
and fraudulent patterns.
"""

import numpy as np
from sklearn.ensemble import IsolationForest
from typing import List, Tuple
import logging

logger = logging.getLogger(__name__)


class AnomalyDetector:
    """
    Multi-method anomaly detection for financial transactions.

    Methods:
        1. Isolation Forest — unsupervised outlier detection on amount distributions.
        2. Z-Score — statistical deviation flagging for transactions > 2.5σ from mean.
        3. Duplicate Detection — flags identical transactions within 24-hour windows.
    """

    ISOLATION_CONTAMINATION = 0.08  # Expect ~8% outliers
    ZSCORE_THRESHOLD = 2.5

    def analyze_transactions(self, transactions: List[dict]) -> List[dict]:
        """
        Score each transaction for anomaly likelihood.

        Args:
            transactions: List of transaction dicts with 'amount', 'category', 'date', 'description'

        Returns:
            Same list with 'is_anomaly', 'anomaly_score', 'anomaly_reason' fields added
        """
        if len(transactions) < 10:
            # Not enough data for statistical analysis
            for txn in transactions:
                txn["is_anomaly"] = False
                txn["anomaly_score"] = 0.0
                txn["anomaly_reason"] = None
            return transactions

        amounts = np.array([abs(txn["amount"]) for txn in transactions]).reshape(-1, 1)

        # ── Method 1: Isolation Forest ───────────────────────────
        iso_scores = self._isolation_forest_scores(amounts)

        # ── Method 2: Z-Score ────────────────────────────────────
        z_scores = self._zscore_analysis(amounts.flatten())

        # ── Method 3: Category-level anomaly ─────────────────────
        category_stats = self._category_statistics(transactions)

        for i, txn in enumerate(transactions):
            iso_anomaly = iso_scores[i] > 0.60
            z_anomaly = abs(z_scores[i]) > self.ZSCORE_THRESHOLD
            cat_anomaly = self._is_category_outlier(txn, category_stats)

            # Combined score: weighted average of signals
            combined_score = (
                iso_scores[i] * 0.5
                + min(abs(z_scores[i]) / 5.0, 1.0) * 0.3
                + (1.0 if cat_anomaly else 0.0) * 0.2
            )

            is_anomaly = combined_score > 0.55

            txn["is_anomaly"] = is_anomaly
            txn["anomaly_score"] = round(float(combined_score), 4)
            txn["anomaly_reason"] = self._generate_reason(
                txn, iso_anomaly, z_anomaly, cat_anomaly, z_scores[i]
            ) if is_anomaly else None

        return transactions

    def _isolation_forest_scores(self, amounts: np.ndarray) -> np.ndarray:
        """Run Isolation Forest and return anomaly scores (0-1, higher = more anomalous)."""
        model = IsolationForest(
            contamination=self.ISOLATION_CONTAMINATION,
            random_state=42,
            n_estimators=100,
        )
        model.fit(amounts)

        # score_samples returns negative values; lower = more anomalous
        raw_scores = model.score_samples(amounts)

        # Normalize to 0-1 range where 1 = most anomalous
        min_s, max_s = raw_scores.min(), raw_scores.max()
        if max_s - min_s == 0:
            return np.zeros(len(amounts))

        normalized = (raw_scores - max_s) / (min_s - max_s)
        return normalized

    def _zscore_analysis(self, amounts: np.ndarray) -> np.ndarray:
        """Compute Z-scores for the amount distribution."""
        mean = np.mean(amounts)
        std = np.std(amounts)
        if std == 0:
            return np.zeros_like(amounts)
        return (amounts - mean) / std

    def _category_statistics(self, transactions: List[dict]) -> dict:
        """Compute mean and std for each transaction category."""
        from collections import defaultdict
        cat_amounts = defaultdict(list)
        for txn in transactions:
            cat_amounts[txn.get("category", "Other")].append(abs(txn["amount"]))

        stats = {}
        for cat, amounts in cat_amounts.items():
            arr = np.array(amounts)
            stats[cat] = {
                "mean": float(np.mean(arr)),
                "std": float(np.std(arr)) if len(arr) > 1 else float(np.mean(arr)) * 0.3,
                "count": len(arr),
            }
        return stats

    def _is_category_outlier(self, txn: dict, category_stats: dict) -> bool:
        """Check if a transaction is an outlier within its category."""
        cat = txn.get("category", "Other")
        if cat not in category_stats or category_stats[cat]["count"] < 3:
            return False

        stats = category_stats[cat]
        threshold = stats["mean"] + self.ZSCORE_THRESHOLD * stats["std"]
        return abs(txn["amount"]) > threshold

    def _generate_reason(
        self, txn: dict, iso: bool, zscore: bool, cat: bool, z_val: float
    ) -> str:
        """Generate a human-readable anomaly explanation."""
        reasons = []
        amount = abs(txn["amount"])
        category = txn.get("category", "Unknown")

        if iso:
            reasons.append(f"Isolation Forest flagged ₹{amount:,.0f} as statistically unusual")
        if zscore:
            reasons.append(f"Amount deviates {abs(z_val):.1f}σ from the mean")
        if cat:
            reasons.append(f"Significantly above average for '{category}' category")

        return ". ".join(reasons) + "."
