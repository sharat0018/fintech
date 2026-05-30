"""
FinSight AI — Financial Analytics Service

Computes core KPIs: MRR, ARR, burn rate, runway, margins, and the Business Health Score.
All calculations operate on pre-aggregated monthly data from the repository layer.
"""

from typing import List, Dict, Tuple
import math


class AnalyticsService:
    """Stateless service for computing financial KPIs from transaction aggregates."""

    # ── Health Score Weights ─────────────────────────────────────
    WEIGHT_RUNWAY = 0.30
    WEIGHT_GROWTH = 0.25
    WEIGHT_MARGIN = 0.20
    WEIGHT_LIQUIDITY = 0.15
    WEIGHT_STABILITY = 0.10

    def compute_metrics(
        self,
        monthly_aggregates: List[dict],
        category_breakdown: List[dict],
        total_transactions: int,
    ) -> dict:
        """
        Compute all financial metrics from monthly aggregate data.

        Args:
            monthly_aggregates: List of {year, month, total_inflow, total_outflow, net_flow}
            category_breakdown: List of {category, total, count}
            total_transactions: Total number of transactions in the dataset

        Returns:
            Complete metrics dictionary
        """
        if not monthly_aggregates:
            return self._empty_metrics()

        # ── Revenue & Expense Totals ─────────────────────────────
        total_revenue = sum(m["total_inflow"] for m in monthly_aggregates)
        total_expenses = sum(m["total_outflow"] for m in monthly_aggregates)
        net_cash_flow = total_revenue - total_expenses
        num_months = len(monthly_aggregates)

        # ── MRR / ARR ───────────────────────────────────────────
        avg_monthly_revenue = total_revenue / max(num_months, 1)
        current_mrr = monthly_aggregates[-1]["total_inflow"] if monthly_aggregates else 0
        current_arr = current_mrr * 12

        # ── Burn Rate & Runway ───────────────────────────────────
        avg_monthly_expenses = total_expenses / max(num_months, 1)
        monthly_burn_rate = max(avg_monthly_expenses - avg_monthly_revenue, 0)

        # Cash reserves = cumulative net flow
        cash_reserves = sum(m["net_flow"] for m in monthly_aggregates)
        if cash_reserves < 0:
            cash_reserves = abs(cash_reserves) * 0.1  # Fallback estimate

        runway_months = (
            cash_reserves / monthly_burn_rate if monthly_burn_rate > 0 else 36.0
        )
        runway_months = min(runway_months, 36.0)

        # ── Margins ─────────────────────────────────────────────
        gross_profit = total_revenue - total_expenses
        gross_profit_margin = (
            (gross_profit / total_revenue * 100) if total_revenue > 0 else 0
        )

        # ── Growth Rate ──────────────────────────────────────────
        revenue_growth = self._compute_growth_rate(monthly_aggregates)

        # ── Liquidity Ratio ──────────────────────────────────────
        last_month = monthly_aggregates[-1] if monthly_aggregates else {}
        liquidity_ratio = (
            last_month.get("total_inflow", 1) / max(last_month.get("total_outflow", 1), 1)
        )

        # ── Expense Stability ────────────────────────────────────
        expense_stability = self._compute_expense_stability(monthly_aggregates)

        # ── Health Score ─────────────────────────────────────────
        health_score = self._compute_health_score(
            runway_months=runway_months,
            revenue_growth=revenue_growth,
            gross_margin=gross_profit_margin,
            liquidity_ratio=liquidity_ratio,
            expense_stability=expense_stability,
        )
        health_status = self._health_status_label(health_score)

        return {
            "current_mrr": round(current_mrr, 2),
            "current_arr": round(current_arr, 2),
            "total_revenue": round(total_revenue, 2),
            "total_expenses": round(total_expenses, 2),
            "net_cash_flow": round(net_cash_flow, 2),
            "gross_profit_margin": round(gross_profit_margin, 2),
            "monthly_burn_rate": round(monthly_burn_rate, 2),
            "runway_months": round(runway_months, 2),
            "cash_reserves": round(cash_reserves, 2),
            "health_score": health_score,
            "health_status": health_status,
            "revenue_growth_pct": round(revenue_growth, 2),
            "liquidity_ratio": round(liquidity_ratio, 2),
            "expense_stability": round(expense_stability, 2),
            "num_months": num_months,
            "total_transactions": total_transactions,
            "category_breakdown": category_breakdown,
            "monthly_aggregates": monthly_aggregates,
        }

    def _compute_health_score(
        self,
        runway_months: float,
        revenue_growth: float,
        gross_margin: float,
        liquidity_ratio: float,
        expense_stability: float,
    ) -> int:
        """
        Weighted Business Health Score (0-100).

        Formula:
          Score = 0.30 * S_runway + 0.25 * S_growth + 0.20 * S_margin
                + 0.15 * S_liquidity + 0.10 * S_stability
        """
        s_runway = min(100, (runway_months / 18) * 100)
        s_growth = min(100, max(0, revenue_growth + 50))  # Normalize: -50%→0, +50%→100
        s_margin = min(100, max(0, gross_margin))
        s_liquidity = min(100, liquidity_ratio * 50)
        s_stability = expense_stability

        score = (
            self.WEIGHT_RUNWAY * s_runway
            + self.WEIGHT_GROWTH * s_growth
            + self.WEIGHT_MARGIN * s_margin
            + self.WEIGHT_LIQUIDITY * s_liquidity
            + self.WEIGHT_STABILITY * s_stability
        )
        return max(0, min(100, int(round(score))))

    def _compute_growth_rate(self, monthly_aggregates: List[dict]) -> float:
        """Compute revenue growth rate (%) comparing last 3 months vs prior 3."""
        if len(monthly_aggregates) < 6:
            if len(monthly_aggregates) >= 2:
                recent = monthly_aggregates[-1]["total_inflow"]
                prev = monthly_aggregates[-2]["total_inflow"]
                if prev > 0:
                    return ((recent - prev) / prev) * 100
            return 0.0

        recent_3 = sum(m["total_inflow"] for m in monthly_aggregates[-3:])
        prior_3 = sum(m["total_inflow"] for m in monthly_aggregates[-6:-3])
        if prior_3 > 0:
            return ((recent_3 - prior_3) / prior_3) * 100
        return 0.0

    def _compute_expense_stability(self, monthly_aggregates: List[dict]) -> float:
        """Compute expense stability score (0-100). Lower variance = higher score."""
        if len(monthly_aggregates) < 2:
            return 50.0

        expenses = [m["total_outflow"] for m in monthly_aggregates]
        mean_exp = sum(expenses) / len(expenses)
        if mean_exp == 0:
            return 100.0

        variance = sum((e - mean_exp) ** 2 for e in expenses) / len(expenses)
        std_dev = math.sqrt(variance)
        cv = std_dev / mean_exp  # Coefficient of variation

        # CV < 0.1 → very stable (100), CV > 0.5 → very unstable (0)
        stability = max(0, min(100, (1 - cv * 2) * 100))
        return stability

    @staticmethod
    def _health_status_label(score: int) -> str:
        if score >= 80:
            return "Excellent"
        elif score >= 65:
            return "Good"
        elif score >= 45:
            return "Moderate"
        elif score >= 25:
            return "At Risk"
        return "Critical"

    @staticmethod
    def _empty_metrics() -> dict:
        return {
            "current_mrr": 0, "current_arr": 0, "total_revenue": 0,
            "total_expenses": 0, "net_cash_flow": 0, "gross_profit_margin": 0,
            "monthly_burn_rate": 0, "runway_months": 0, "cash_reserves": 0,
            "health_score": 0, "health_status": "Critical",
            "revenue_growth_pct": 0, "liquidity_ratio": 0,
            "expense_stability": 0, "num_months": 0, "total_transactions": 0,
            "category_breakdown": [], "monthly_aggregates": [],
        }
