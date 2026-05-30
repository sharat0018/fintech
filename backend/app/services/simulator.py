"""
FinSight AI — Financial Twin Simulator Engine

Creates a digital twin of the business financial model and simulates
the impact of strategic decisions on key metrics.
"""

from typing import List, Dict
import math


class SimulatorEngine:
    """
    Projects the 12-month financial impact of business decisions.

    Supported Scenarios:
        - Hiring employees (salary burden)
        - Marketing spend adjustments (with ROI multiplier)
        - Pricing changes (revenue impact)
        - Revenue growth/decline
        - Cost increases
        - Economic downturns
        - New office openings
    """

    # ── Default Assumptions ──────────────────────────────────────
    MARKETING_ROI_MULTIPLIER = 2.8    # ₹1 marketing → ₹2.80 revenue over 6 months
    MARKETING_RAMP_MONTHS = 4         # Months for marketing ROI to materialize
    ECONOMIC_DOWNTURN_REVENUE_CUT = 0.25  # 25% revenue reduction
    ECONOMIC_DOWNTURN_COST_INCREASE = 0.05  # 5% cost increase

    def simulate(self, current_metrics: dict, params: dict) -> dict:
        """
        Run a financial simulation against current metrics.

        Args:
            current_metrics: Current company KPIs from AnalyticsService
            params: SimulationRequest parameters

        Returns:
            Complete simulation response with deltas and AI explanation
        """
        # ── Extract Current State ────────────────────────────────
        orig_burn = current_metrics.get("monthly_burn_rate", 0)
        orig_revenue = current_metrics.get("current_mrr", 0)
        orig_expenses = current_metrics.get("total_expenses", 0) / max(current_metrics.get("num_months", 1), 1)
        orig_runway = current_metrics.get("runway_months", 0)
        orig_health = current_metrics.get("health_score", 0)
        orig_cash = current_metrics.get("cash_reserves", 0)

        # ── Calculate New Monthly Costs ──────────────────────────
        hiring_cost = params.get("hiring_count", 0) * params.get("avg_salary_monthly", 80000)
        marketing_delta = params.get("marketing_spend_delta", 0)
        office_cost = params.get("new_office_monthly_cost", 0)
        cost_increase_pct = params.get("cost_increase_pct", 0) / 100

        new_monthly_cost_increase = hiring_cost + marketing_delta + office_cost
        new_expenses = orig_expenses * (1 + cost_increase_pct) + new_monthly_cost_increase

        # ── Calculate New Revenue ────────────────────────────────
        pricing_mult = params.get("pricing_multiplier", 1.0)
        revenue_growth_pct = params.get("revenue_growth_pct", 0) / 100

        # Marketing-driven revenue (delayed ROI)
        marketing_revenue_boost = (
            marketing_delta * self.MARKETING_ROI_MULTIPLIER / self.MARKETING_RAMP_MONTHS
        )

        new_revenue = orig_revenue * pricing_mult * (1 + revenue_growth_pct) + marketing_revenue_boost

        # ── Economic Downturn Scenario ───────────────────────────
        if params.get("economic_downturn", False):
            new_revenue *= (1 - self.ECONOMIC_DOWNTURN_REVENUE_CUT)
            new_expenses *= (1 + self.ECONOMIC_DOWNTURN_COST_INCREASE)

        # ── Derived Metrics ──────────────────────────────────────
        new_burn = max(0, new_expenses - new_revenue)
        new_runway = orig_cash / new_burn if new_burn > 0 else 36.0
        new_runway = min(36.0, new_runway)

        # ── 12-Month Cash Projection ─────────────────────────────
        original_cash_12m = orig_cash + (orig_revenue - orig_expenses) * 12
        simulated_cash_12m = orig_cash + (new_revenue - new_expenses) * 12

        # ── New Health Score ─────────────────────────────────────
        new_health = self._recalculate_health(
            runway=new_runway,
            revenue_growth=(new_revenue - orig_revenue) / max(orig_revenue, 1) * 100,
            margin=(new_revenue - new_expenses) / max(new_revenue, 1) * 100,
            liquidity=new_revenue / max(new_expenses, 1),
            stability=85 if new_monthly_cost_increase == 0 else 60,
        )

        # ── Risk Assessment ──────────────────────────────────────
        risk_level = self._assess_risk(new_runway, new_burn, orig_burn, new_health)

        # ── AI Explanation ───────────────────────────────────────
        explanation = self._generate_explanation(
            params, orig_revenue, new_revenue, orig_expenses, new_expenses,
            orig_runway, new_runway, orig_burn, new_burn,
        )

        # ── Recommendations ──────────────────────────────────────
        recommendations = self._generate_recommendations(
            params, new_runway, new_burn, orig_burn, new_revenue, orig_revenue,
        )

        return {
            "status": "success",
            "company_id": params.get("company_id", ""),
            "runway": self._delta(orig_runway, new_runway),
            "health_score": self._delta(orig_health, new_health),
            "burn_rate": self._delta(orig_burn, new_burn),
            "monthly_revenue": self._delta(orig_revenue, new_revenue),
            "cash_reserves_12m": self._delta(original_cash_12m, simulated_cash_12m),
            "risk_level": risk_level,
            "ai_explanation": explanation,
            "recommendations": recommendations,
        }

    def _delta(self, original: float, simulated: float) -> dict:
        delta = simulated - original
        delta_pct = (delta / original * 100) if original != 0 else 0
        return {
            "original": round(original, 2),
            "simulated": round(simulated, 2),
            "delta": round(delta, 2),
            "delta_pct": round(delta_pct, 2),
        }

    def _recalculate_health(self, runway, revenue_growth, margin, liquidity, stability):
        s_runway = min(100, (runway / 18) * 100)
        s_growth = min(100, max(0, revenue_growth + 50))
        s_margin = min(100, max(0, margin))
        s_liquidity = min(100, liquidity * 50)
        s_stability = stability
        score = 0.30 * s_runway + 0.25 * s_growth + 0.20 * s_margin + 0.15 * s_liquidity + 0.10 * s_stability
        return max(0, min(100, int(round(score))))

    def _assess_risk(self, runway, new_burn, orig_burn, health):
        if runway < 3 or health < 25:
            return "Critical"
        if runway < 6 or health < 45:
            return "High"
        if new_burn > orig_burn * 1.3 or health < 65:
            return "Medium"
        return "Low"

    def _generate_explanation(self, params, orig_rev, new_rev, orig_exp, new_exp,
                               orig_run, new_run, orig_burn, new_burn):
        parts = []

        if params.get("hiring_count", 0) > 0:
            cost = params["hiring_count"] * params.get("avg_salary_monthly", 80000)
            parts.append(
                f"Hiring {params['hiring_count']} employee(s) adds ₹{cost:,.0f}/month to payroll."
            )

        if params.get("marketing_spend_delta", 0) > 0:
            parts.append(
                f"Increasing marketing by ₹{params['marketing_spend_delta']:,.0f}/month. "
                f"Expected ROI materializes over {self.MARKETING_RAMP_MONTHS} months."
            )

        if params.get("pricing_multiplier", 1.0) != 1.0:
            pct = (params["pricing_multiplier"] - 1) * 100
            parts.append(f"Pricing adjustment of {pct:+.1f}% applied to recurring revenue.")

        if params.get("economic_downturn", False):
            parts.append(
                f"Economic downturn scenario: Revenue reduced by {self.ECONOMIC_DOWNTURN_REVENUE_CUT*100:.0f}%, "
                f"costs increased by {self.ECONOMIC_DOWNTURN_COST_INCREASE*100:.0f}%."
            )

        delta_run = new_run - orig_run
        if delta_run < 0:
            parts.append(f"Runway decreases by {abs(delta_run):.1f} months (from {orig_run:.1f} to {new_run:.1f}).")
        else:
            parts.append(f"Runway improves by {delta_run:.1f} months (from {orig_run:.1f} to {new_run:.1f}).")

        return " ".join(parts)

    def _generate_recommendations(self, params, runway, new_burn, orig_burn, new_rev, orig_rev):
        recs = []

        if runway < 6:
            recs.append("⚠️ Critical: Runway is below 6 months. Consider deferring non-essential hiring.")

        if new_burn > orig_burn * 1.5:
            recs.append("Burn rate increased significantly. Review expense categories for optimization.")

        if params.get("hiring_count", 0) > 2:
            recs.append("Consider phased hiring (1-2 per quarter) to manage cash flow impact.")

        if params.get("marketing_spend_delta", 0) > 0 and runway < 9:
            recs.append("Marketing ROI takes months to materialize. Ensure sufficient runway to cover the ramp period.")

        if new_rev > orig_rev * 1.1:
            recs.append("Revenue growth is strong. Reinvest strategically in high-ROI channels.")

        if not recs:
            recs.append("This scenario maintains healthy financial metrics. Proceed with measured execution.")

        return recs
