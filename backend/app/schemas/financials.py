"""
FinSight AI — Pydantic Schemas for Financial Data Models

Comprehensive request/response schemas for the API layer.
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date
from enum import Enum


# ═══════════════════════════════════════════════════════════════════
# ENUMS
# ═══════════════════════════════════════════════════════════════════

class AccountType(str, Enum):
    OPERATING = "Operating"
    INVESTING = "Investing"
    FINANCING = "Financing"


class TransactionCategory(str, Enum):
    REVENUE = "Revenue"
    PAYROLL = "Payroll"
    MARKETING = "Marketing"
    HOSTING = "Hosting"
    SAAS = "SaaS"
    RENT = "Rent"
    UTILITIES = "Utilities"
    CONSULTING = "Consulting"
    EQUIPMENT = "Equipment"
    TRAVEL = "Travel"
    INSURANCE = "Insurance"
    TAXES = "Taxes"
    LOAN_REPAYMENT = "Loan Repayment"
    INVESTMENT = "Investment"
    MISCELLANEOUS = "Miscellaneous"


class RiskSeverity(str, Enum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"
    CRITICAL = "Critical"


class HealthStatus(str, Enum):
    EXCELLENT = "Excellent"
    GOOD = "Good"
    MODERATE = "Moderate"
    AT_RISK = "At Risk"
    CRITICAL = "Critical"


# ═══════════════════════════════════════════════════════════════════
# COMPANY SCHEMAS
# ═══════════════════════════════════════════════════════════════════

class CompanyCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    industry: Optional[str] = None
    currency: str = Field(default="INR", max_length=3)


class CompanyResponse(BaseModel):
    id: str
    name: str
    industry: Optional[str]
    currency: str
    created_at: datetime


# ═══════════════════════════════════════════════════════════════════
# TRANSACTION SCHEMAS
# ═══════════════════════════════════════════════════════════════════

class TransactionBase(BaseModel):
    date: date
    description: str = Field(..., min_length=1)
    category: str
    amount: float
    account_type: str = "Operating"


class SingleTransactionRequest(BaseModel):
    company_id: str
    date: date
    description: str = Field(..., min_length=1)
    category: str
    amount: float
    account_type: str = "Operating"


class TransactionResponse(TransactionBase):
    id: str
    company_id: str
    is_anomaly: bool = False
    anomaly_score: float = 0.0
    anomaly_reason: Optional[str] = None
    created_at: datetime


# ═══════════════════════════════════════════════════════════════════
# FINANCIAL METRICS SCHEMAS
# ═══════════════════════════════════════════════════════════════════

class FinancialMetrics(BaseModel):
    """Core KPI snapshot for a company."""
    current_mrr: float = Field(..., description="Monthly Recurring Revenue")
    current_arr: float = Field(..., description="Annual Recurring Revenue")
    total_revenue: float = Field(..., description="Total revenue this period")
    total_expenses: float = Field(..., description="Total expenses this period")
    net_cash_flow: float = Field(..., description="Revenue minus expenses")
    gross_profit_margin: float = Field(..., description="Gross profit margin %")
    monthly_burn_rate: float = Field(..., description="Average monthly cash burn")
    runway_months: float = Field(..., description="Months of runway remaining")
    cash_reserves: float = Field(..., description="Current cash on hand")
    health_score: int = Field(..., ge=0, le=100, description="Business Health Score 0-100")
    health_status: HealthStatus


class UploadResponse(BaseModel):
    """Response returned after ledger ingestion."""
    status: str = "success"
    company_id: str
    company_name: str
    transactions_processed: int
    duplicates_removed: int
    anomalies_detected: int
    metrics: FinancialMetrics


# ═══════════════════════════════════════════════════════════════════
# FORECASTING SCHEMAS
# ═══════════════════════════════════════════════════════════════════

class ForecastPoint(BaseModel):
    """A single data point in a forecast series."""
    month: str  # e.g. "2026-06"
    value: float
    lower_bound: float
    upper_bound: float


class ForecastResponse(BaseModel):
    """12-month forecast results for a metric."""
    metric_name: str
    current_value: float
    forecast: List[ForecastPoint]
    trend_direction: str  # "increasing", "decreasing", "stable"
    confidence_pct: float


class AllForecastsResponse(BaseModel):
    status: str = "success"
    company_id: str
    revenue_forecast: ForecastResponse
    expense_forecast: ForecastResponse
    cash_flow_forecast: ForecastResponse
    runway_forecast: ForecastResponse


# ═══════════════════════════════════════════════════════════════════
# SIMULATOR SCHEMAS
# ═══════════════════════════════════════════════════════════════════

class SimulationRequest(BaseModel):
    """Input parameters for the Financial Twin Simulator."""
    company_id: str
    hiring_count: int = Field(default=0, ge=0, le=100)
    avg_salary_monthly: float = Field(default=80000.0, ge=0)
    marketing_spend_delta: float = Field(default=0.0, description="Additional monthly marketing")
    pricing_multiplier: float = Field(default=1.0, ge=0.5, le=3.0)
    revenue_growth_pct: float = Field(default=0.0, ge=-100, le=500)
    cost_increase_pct: float = Field(default=0.0, ge=-50, le=200)
    economic_downturn: bool = False
    new_office_monthly_cost: float = Field(default=0.0, ge=0)


class SimulationMetricDelta(BaseModel):
    original: float
    simulated: float
    delta: float
    delta_pct: float


class SimulationResponse(BaseModel):
    status: str = "success"
    company_id: str
    runway: SimulationMetricDelta
    health_score: SimulationMetricDelta
    burn_rate: SimulationMetricDelta
    monthly_revenue: SimulationMetricDelta
    cash_reserves_12m: SimulationMetricDelta
    risk_level: RiskSeverity
    ai_explanation: str
    recommendations: List[str]


# ═══════════════════════════════════════════════════════════════════
# RISK SCHEMAS
# ═══════════════════════════════════════════════════════════════════

class RiskItem(BaseModel):
    risk_type: str
    title: str
    description: str
    severity: RiskSeverity
    probability: float = Field(..., ge=0, le=100)
    impact_score: float = Field(..., ge=0, le=100)
    mitigation: str


class RiskRadarResponse(BaseModel):
    status: str = "success"
    company_id: str
    overall_risk_score: float
    risk_level: RiskSeverity
    risks: List[RiskItem]


# ═══════════════════════════════════════════════════════════════════
# ANOMALY SCHEMAS
# ═══════════════════════════════════════════════════════════════════

class AnomalyItem(BaseModel):
    transaction_id: str
    date: date
    description: str
    category: str
    amount: float
    anomaly_score: float
    anomaly_reason: str
    severity: RiskSeverity


class AnomalyResponse(BaseModel):
    status: str = "success"
    company_id: str
    total_anomalies: int
    anomalies: List[AnomalyItem]


# ═══════════════════════════════════════════════════════════════════
# CHAT / AGENT SCHEMAS
# ═══════════════════════════════════════════════════════════════════

class ChatRequest(BaseModel):
    company_id: str
    prompt: str = Field(..., min_length=1, max_length=2000)
    session_id: Optional[str] = None


class SupportingDataPoint(BaseModel):
    label: str
    value: float


class ChatResponse(BaseModel):
    status: str = "success"
    insight: str
    explanation: str
    business_impact: str
    recommendation: str
    confidence_score: int = Field(..., ge=0, le=100)
    supporting_data: List[SupportingDataPoint]


# ═══════════════════════════════════════════════════════════════════
# REPORT SCHEMAS
# ═══════════════════════════════════════════════════════════════════

class ReportSection(BaseModel):
    title: str
    content: str


class BoardReportResponse(BaseModel):
    status: str = "success"
    company_id: str
    company_name: str
    report_date: str
    executive_summary: str
    sections: List[ReportSection]
    health_score: int
    health_status: HealthStatus
    key_risks: List[RiskItem]
    recommendations: List[str]


class InvestorReadinessResponse(BaseModel):
    status: str = "success"
    company_id: str
    investor_score: int = Field(..., ge=0, le=100)
    funding_readiness: str
    strengths: List[str]
    weaknesses: List[str]
    improvement_plan: List[str]


# ═══════════════════════════════════════════════════════════════════
# WEBSOCKET EVENT SCHEMAS
# ═══════════════════════════════════════════════════════════════════

class WSTransactionEvent(BaseModel):
    event: str  # "transaction_created" | "anomaly_alert"
    data: dict


class WSAgentThought(BaseModel):
    event: str  # "agent_thought" | "agent_response_complete"
    data: dict
