"""
FinSight AI — Statistical Forecasting Engine

Implements linear trend regression with seasonal decomposition for
12-month financial projections (revenue, expenses, cash flow, runway).
"""

import numpy as np
from typing import List, Dict, Tuple
from datetime import date, timedelta
import logging

logger = logging.getLogger(__name__)


class ForecastingEngine:
    """
    Time-series forecasting using linear regression with seasonal adjustments.

    Model:  y(t) = β₀ + β₁·t + S(t) + ε
    Where:
        β₀, β₁ = intercept and slope from OLS regression
        S(t)   = monthly seasonal component (deviation from trend)
        ε      = residual noise
    """

    FORECAST_MONTHS = 12
    CONFIDENCE_MULTIPLIER = 1.96  # 95% confidence interval

    def forecast_metric(
        self,
        monthly_values: List[float],
        metric_name: str,
        start_date: date = None,
    ) -> dict:
        """
        Generate a 12-month forecast for a single metric.

        Args:
            monthly_values: Historical monthly values (oldest first)
            metric_name: Name of the metric being forecasted
            start_date: Starting month for forecasted values

        Returns:
            Forecast response dict with points, trend direction, and confidence
        """
        if not monthly_values or len(monthly_values) < 3:
            return self._empty_forecast(metric_name)

        values = np.array(monthly_values, dtype=float)
        n = len(values)
        t = np.arange(n)

        # ── Linear Regression (OLS) ──────────────────────────────
        slope, intercept = self._linear_regression(t, values)

        # ── Seasonal Component ───────────────────────────────────
        trend_line = intercept + slope * t
        residuals = values - trend_line
        seasonal = self._extract_seasonality(residuals)

        # ── Forecast Calculation ─────────────────────────────────
        forecast_points = []
        if start_date is None:
            start_date = date.today().replace(day=1)

        # Compute residual std for confidence intervals
        residual_std = float(np.std(residuals)) if len(residuals) > 1 else abs(np.mean(values)) * 0.1

        for i in range(self.FORECAST_MONTHS):
            future_t = n + i
            month_idx = (future_t) % 12
            seasonal_adj = seasonal[month_idx] if len(seasonal) > month_idx else 0

            predicted = intercept + slope * future_t + seasonal_adj

            # Widening confidence intervals for further projections
            uncertainty = residual_std * self.CONFIDENCE_MULTIPLIER * (1 + i * 0.1)
            lower = max(0, predicted - uncertainty)
            upper = predicted + uncertainty

            forecast_month = self._add_months(start_date, i + 1)

            forecast_points.append({
                "month": forecast_month.strftime("%Y-%m"),
                "value": round(float(max(0, predicted)), 2),
                "lower_bound": round(float(lower), 2),
                "upper_bound": round(float(upper), 2),
            })

        # ── Trend Direction ──────────────────────────────────────
        if slope > 0.01 * np.mean(values):
            trend = "increasing"
        elif slope < -0.01 * np.mean(values):
            trend = "decreasing"
        else:
            trend = "stable"

        # ── Confidence Percentage ────────────────────────────────
        # Based on data density and fit quality
        r_squared = self._r_squared(t, values, slope, intercept)
        confidence = min(95, max(40, int(r_squared * 100)))

        return {
            "metric_name": metric_name,
            "current_value": round(float(values[-1]), 2),
            "forecast": forecast_points,
            "trend_direction": trend,
            "confidence_pct": confidence,
        }

    def forecast_all(self, monthly_aggregates: List[dict], cash_reserves: float) -> dict:
        """
        Generate forecasts for revenue, expenses, cash flow, and runway.

        Args:
            monthly_aggregates: List of {total_inflow, total_outflow, net_flow}
            cash_reserves: Current estimated cash on hand

        Returns:
            Dictionary containing all forecast results
        """
        if not monthly_aggregates:
            return {
                "revenue_forecast": self._empty_forecast("Revenue"),
                "expense_forecast": self._empty_forecast("Expenses"),
                "cash_flow_forecast": self._empty_forecast("Net Cash Flow"),
                "runway_forecast": self._empty_forecast("Runway (Months)"),
            }

        revenues = [m["total_inflow"] for m in monthly_aggregates]
        expenses = [m["total_outflow"] for m in monthly_aggregates]
        net_flows = [m["net_flow"] for m in monthly_aggregates]

        rev_forecast = self.forecast_metric(revenues, "Revenue")
        exp_forecast = self.forecast_metric(expenses, "Expenses")
        cf_forecast = self.forecast_metric(net_flows, "Net Cash Flow")

        # ── Runway Forecast ──────────────────────────────────────
        # Project runway at each future month based on projected burn
        runway_values = []
        running_cash = cash_reserves
        for i in range(self.FORECAST_MONTHS):
            projected_net = cf_forecast["forecast"][i]["value"]
            running_cash += projected_net
            projected_burn = exp_forecast["forecast"][i]["value"] - rev_forecast["forecast"][i]["value"]
            if projected_burn > 0:
                runway_m = running_cash / projected_burn
            else:
                runway_m = 36.0
            runway_values.append(min(36.0, max(0, runway_m)))

        runway_forecast = {
            "metric_name": "Runway (Months)",
            "current_value": round(cash_reserves / max(expenses[-1] - revenues[-1], 1), 2) if expenses and revenues else 0,
            "forecast": [
                {
                    "month": cf_forecast["forecast"][i]["month"],
                    "value": round(runway_values[i], 2),
                    "lower_bound": round(max(0, runway_values[i] - 2), 2),
                    "upper_bound": round(min(36, runway_values[i] + 2), 2),
                }
                for i in range(self.FORECAST_MONTHS)
            ],
            "trend_direction": "decreasing" if runway_values[-1] < runway_values[0] else "increasing",
            "confidence_pct": 70,
        }

        return {
            "revenue_forecast": rev_forecast,
            "expense_forecast": exp_forecast,
            "cash_flow_forecast": cf_forecast,
            "runway_forecast": runway_forecast,
        }

    # ── Private Helpers ──────────────────────────────────────────

    @staticmethod
    def _linear_regression(x: np.ndarray, y: np.ndarray) -> Tuple[float, float]:
        """Ordinary Least Squares linear regression. Returns (slope, intercept)."""
        n = len(x)
        x_mean = np.mean(x)
        y_mean = np.mean(y)
        numerator = np.sum((x - x_mean) * (y - y_mean))
        denominator = np.sum((x - x_mean) ** 2)
        if denominator == 0:
            return 0.0, float(y_mean)
        slope = float(numerator / denominator)
        intercept = float(y_mean - slope * x_mean)
        return slope, intercept

    @staticmethod
    def _extract_seasonality(residuals: np.ndarray) -> List[float]:
        """Extract monthly seasonal pattern from residuals."""
        n = len(residuals)
        seasonal = [0.0] * 12
        counts = [0] * 12
        for i, r in enumerate(residuals):
            month_idx = i % 12
            seasonal[month_idx] += float(r)
            counts[month_idx] += 1
        for i in range(12):
            if counts[i] > 0:
                seasonal[i] /= counts[i]
        return seasonal

    @staticmethod
    def _r_squared(x: np.ndarray, y: np.ndarray, slope: float, intercept: float) -> float:
        """Compute R² goodness-of-fit metric."""
        y_pred = intercept + slope * x
        ss_res = np.sum((y - y_pred) ** 2)
        ss_tot = np.sum((y - np.mean(y)) ** 2)
        if ss_tot == 0:
            return 1.0
        return max(0, 1 - ss_res / ss_tot)

    @staticmethod
    def _add_months(d: date, months: int) -> date:
        """Add N months to a date."""
        month = d.month + months
        year = d.year + (month - 1) // 12
        month = (month - 1) % 12 + 1
        return date(year, month, 1)

    @staticmethod
    def _empty_forecast(name: str) -> dict:
        return {
            "metric_name": name,
            "current_value": 0,
            "forecast": [],
            "trend_direction": "stable",
            "confidence_pct": 0,
        }
