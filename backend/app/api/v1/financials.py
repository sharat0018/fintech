"""
FinSight AI — Financial REST API Endpoints

Handles ledger uploads, metric retrieval, forecasting, simulation, and reporting.
"""

from fastapi import APIRouter, UploadFile, File, HTTPException
from app.database import Database
from app.repositories.repositories import (
    CompanyRepository, TransactionRepository, ScenarioRepository,
)
from app.services.analytics import AnalyticsService
from app.services.anomaly import AnomalyDetector
from app.services.forecasting import ForecastingEngine
from app.services.simulator import SimulatorEngine
from app.services.generator import TransactionGenerator
from app.agents.orchestrator import AgentOrchestrator
from app.schemas.financials import (
    SimulationRequest, ChatRequest, SingleTransactionRequest,
)
from app.core.websocket_manager import ws_manager
from datetime import datetime
import pandas as pd
import io
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

analytics = AnalyticsService()
anomaly_detector = AnomalyDetector()
forecasting = ForecastingEngine()
simulator = SimulatorEngine()
generator = TransactionGenerator()
orchestrator = AgentOrchestrator()


# ═══════════════════════════════════════════════════════════════════
# UPLOAD & INGEST
# ═══════════════════════════════════════════════════════════════════

@router.post("/financials/upload")
async def upload_financial_data(file: UploadFile = File(...)):
    """
    Upload a CSV/Excel ledger file. The system will parse, deduplicate,
    detect anomalies, and compute all financial KPIs.
    """
    db = Database.db
    company_repo = CompanyRepository(db)
    txn_repo = TransactionRepository(db)

    # Parse file
    content = await file.read()
    try:
        if file.filename.endswith(".xlsx") or file.filename.endswith(".xls"):
            df = pd.read_excel(io.BytesIO(content))
        else:
            df = pd.read_csv(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {str(e)}")

    # Standardize columns
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

    # Map common column names
    col_mapping = {
        "transaction_date": "date", "txn_date": "date",
        "desc": "description", "narration": "description", "particulars": "description",
        "debit": "amount", "credit": "amount", "value": "amount",
        "type": "category", "head": "category", "expense_type": "category",
    }
    df.rename(columns={k: v for k, v in col_mapping.items() if k in df.columns}, inplace=True)

    required = {"date", "description", "amount"}
    if not required.issubset(set(df.columns)):
        raise HTTPException(
            status_code=400,
            detail=f"Missing required columns. Need: {required}. Found: {list(df.columns)}"
        )

    # Clean data
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df = df.dropna(subset=["date", "amount"])
    df["amount"] = pd.to_numeric(df["amount"], errors="coerce").fillna(0)
    if "category" not in df.columns:
        df["category"] = "Miscellaneous"
    if "account_type" not in df.columns:
        df["account_type"] = "Operating"

    # Create or find company
    company = await company_repo.find_or_create("Uploaded Company")
    company_id = company["id"]

    # Convert to transaction dicts
    transactions = []
    duplicates = 0
    for _, row in df.iterrows():
        txn = {
            "company_id": company_id,
            "date": row["date"].to_pydatetime(),
            "description": str(row["description"]),
            "category": str(row.get("category", "Miscellaneous")),
            "amount": float(row["amount"]),
            "account_type": str(row.get("account_type", "Operating")),
        }
        # Deduplication check
        is_dup = await txn_repo.check_duplicate(
            company_id, txn["date"], txn["amount"], txn["description"]
        )
        if is_dup:
            duplicates += 1
            continue
        transactions.append(txn)

    # Run anomaly detection
    if transactions:
        transactions = anomaly_detector.analyze_transactions(transactions)

    # Insert into MongoDB
    anomalies_count = sum(1 for t in transactions if t.get("is_anomaly"))
    await txn_repo.insert_many(transactions)

    # Compute metrics
    monthly_agg = await txn_repo.get_monthly_aggregates(company_id)
    cat_breakdown = await txn_repo.get_category_breakdown(company_id)
    total_count = await txn_repo.count_by_company(company_id)
    metrics = analytics.compute_metrics(monthly_agg, cat_breakdown, total_count)

    return {
        "status": "success",
        "company_id": company_id,
        "company_name": company["name"],
        "transactions_processed": len(transactions),
        "duplicates_removed": duplicates,
        "anomalies_detected": anomalies_count,
        "metrics": {
            "current_mrr": metrics["current_mrr"],
            "current_arr": metrics["current_arr"],
            "total_revenue": metrics["total_revenue"],
            "total_expenses": metrics["total_expenses"],
            "net_cash_flow": metrics["net_cash_flow"],
            "gross_profit_margin": metrics["gross_profit_margin"],
            "monthly_burn_rate": metrics["monthly_burn_rate"],
            "runway_months": metrics["runway_months"],
            "cash_reserves": metrics["cash_reserves"],
            "health_score": metrics["health_score"],
            "health_status": metrics["health_status"],
        },
    }


@router.post("/financials/transactions/create")
async def create_transaction(request: SingleTransactionRequest):
    """
    Ingest a single transaction in real-time.
    Runs anomaly detection, updates MongoDB, and broadcasts via WebSockets.
    """
    db = Database.db
    company_repo = CompanyRepository(db)
    txn_repo = TransactionRepository(db)

    # Verify company exists
    company = await company_repo.find_by_id(request.company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    txn = {
        "company_id": request.company_id,
        "date": datetime.combine(request.date, datetime.min.time()),
        "description": request.description,
        "category": request.category,
        "amount": request.amount,
        "account_type": request.account_type,
    }

    # Run anomaly detection
    txns = anomaly_detector.analyze_transactions([txn])
    processed_txn = txns[0]

    # Save to MongoDB
    saved = await txn_repo.insert_one(processed_txn.copy())

    # Broadcast to all websocket connections subscribed to this company ID
    event_type = "anomaly_alert" if processed_txn.get("is_anomaly") else "transaction_created"
    await ws_manager.broadcast("transactions", {
        "event": event_type,
        "data": {
            "transaction_id": saved.get("id", ""),
            "date": processed_txn["date"].isoformat() if hasattr(processed_txn["date"], "isoformat") else str(processed_txn["date"]),
            "description": processed_txn["description"],
            "category": processed_txn["category"],
            "amount": processed_txn["amount"],
            "is_anomaly": processed_txn["is_anomaly"],
            "anomaly_score": processed_txn.get("anomaly_score", 0),
            "anomaly_reason": processed_txn.get("anomaly_reason"),
        },
    }, company_id=request.company_id)

    return {
        "status": "success",
        "transaction_id": saved.get("id", ""),
        "transaction": {
            "id": saved.get("id", ""),
            "company_id": processed_txn["company_id"],
            "date": processed_txn["date"].isoformat() if hasattr(processed_txn["date"], "isoformat") else str(processed_txn["date"]),
            "description": processed_txn["description"],
            "category": processed_txn["category"],
            "amount": processed_txn["amount"],
            "is_anomaly": processed_txn["is_anomaly"],
            "anomaly_reason": processed_txn.get("anomaly_reason"),
        }
    }


# ═══════════════════════════════════════════════════════════════════
# DASHBOARD METRICS
# ═══════════════════════════════════════════════════════════════════

@router.get("/financials/{company_id}/metrics")
async def get_metrics(company_id: str):
    """Retrieve current financial KPIs for a company."""
    db = Database.db
    txn_repo = TransactionRepository(db)

    monthly_agg = await txn_repo.get_monthly_aggregates(company_id)
    cat_breakdown = await txn_repo.get_category_breakdown(company_id)
    total_count = await txn_repo.count_by_company(company_id)
    metrics = analytics.compute_metrics(monthly_agg, cat_breakdown, total_count)

    return {"status": "success", "company_id": company_id, "metrics": metrics}


@router.get("/financials/{company_id}/transactions")
async def get_transactions(company_id: str, limit: int = 100, skip: int = 0):
    """Retrieve recent transactions for a company."""
    db = Database.db
    txn_repo = TransactionRepository(db)
    txns = await txn_repo.find_by_company(company_id, limit=limit, skip=skip)
    total = await txn_repo.count_by_company(company_id)
    return {"status": "success", "total": total, "transactions": txns}


@router.get("/financials/{company_id}/anomalies")
async def get_anomalies(company_id: str):
    """Retrieve detected anomalies for a company."""
    db = Database.db
    txn_repo = TransactionRepository(db)
    anomalies = await txn_repo.find_anomalies(company_id)
    return {"status": "success", "total": len(anomalies), "anomalies": anomalies}


# ═══════════════════════════════════════════════════════════════════
# FORECASTING
# ═══════════════════════════════════════════════════════════════════

@router.get("/forecast/{company_id}")
async def get_forecast(company_id: str):
    """Generate 12-month forecasts for all key metrics."""
    db = Database.db
    txn_repo = TransactionRepository(db)

    monthly_agg = await txn_repo.get_monthly_aggregates(company_id)
    cat_breakdown = await txn_repo.get_category_breakdown(company_id)
    total_count = await txn_repo.count_by_company(company_id)
    metrics = analytics.compute_metrics(monthly_agg, cat_breakdown, total_count)

    forecasts = forecasting.forecast_all(monthly_agg, metrics.get("cash_reserves", 0))

    return {"status": "success", "company_id": company_id, **forecasts}


# ═══════════════════════════════════════════════════════════════════
# SIMULATOR
# ═══════════════════════════════════════════════════════════════════

@router.post("/simulator/simulate")
async def run_simulation(request: SimulationRequest):
    """Run a Financial Twin simulation against current metrics."""
    db = Database.db
    txn_repo = TransactionRepository(db)
    scenario_repo = ScenarioRepository(db)

    monthly_agg = await txn_repo.get_monthly_aggregates(request.company_id)
    cat_breakdown = await txn_repo.get_category_breakdown(request.company_id)
    total_count = await txn_repo.count_by_company(request.company_id)
    metrics = analytics.compute_metrics(monthly_agg, cat_breakdown, total_count)

    result = simulator.simulate(metrics, request.model_dump())

    # Save scenario to audit log
    await scenario_repo.save({
        "company_id": request.company_id,
        "name": f"Simulation: +{request.hiring_count} hires, mktg ₹{request.marketing_spend_delta:,.0f}",
        "parameters": request.model_dump(),
        "impact": {
            "runway_delta": result["runway"]["delta"],
            "health_delta": result["health_score"]["delta"],
            "burn_delta": result["burn_rate"]["delta"],
        },
    })

    return result


# ═══════════════════════════════════════════════════════════════════
# CHAT / AI CFO
# ═══════════════════════════════════════════════════════════════════

@router.post("/chat/ask")
async def chat_with_cfo(request: ChatRequest):
    """Submit a question to the AI CFO multi-agent system."""
    db = Database.db
    txn_repo = TransactionRepository(db)

    monthly_agg = await txn_repo.get_monthly_aggregates(request.company_id)
    cat_breakdown = await txn_repo.get_category_breakdown(request.company_id)
    total_count = await txn_repo.count_by_company(request.company_id)
    metrics = analytics.compute_metrics(monthly_agg, cat_breakdown, total_count)

    forecast_data = forecasting.forecast_all(monthly_agg, metrics.get("cash_reserves", 0))

    result = await orchestrator.full_analysis(
        metrics=metrics,
        forecast_data=forecast_data,
        query=request.prompt,
    )

    return {"status": "success", **result}


# ═══════════════════════════════════════════════════════════════════
# REPORTS
# ═══════════════════════════════════════════════════════════════════

@router.get("/reports/{company_id}/board")
async def generate_board_report(company_id: str):
    """Generate an executive board report."""
    db = Database.db
    company_repo = CompanyRepository(db)
    txn_repo = TransactionRepository(db)

    company = await company_repo.find_by_id(company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    monthly_agg = await txn_repo.get_monthly_aggregates(company_id)
    cat_breakdown = await txn_repo.get_category_breakdown(company_id)
    total_count = await txn_repo.count_by_company(company_id)
    metrics = analytics.compute_metrics(monthly_agg, cat_breakdown, total_count)
    forecasts = forecasting.forecast_all(monthly_agg, metrics.get("cash_reserves", 0))

    from datetime import date
    return {
        "status": "success",
        "company_id": company_id,
        "company_name": company["name"],
        "report_date": date.today().isoformat(),
        "executive_summary": f"{company['name']} has a Business Health Score of {metrics['health_score']}/100 ({metrics['health_status']}). "
                             f"Current MRR is ₹{metrics['current_mrr']:,.0f} with a burn rate of ₹{metrics['monthly_burn_rate']:,.0f}/month. "
                             f"Runway stands at {metrics['runway_months']:.1f} months.",
        "sections": [
            {"title": "Revenue Performance", "content": f"Total revenue: ₹{metrics['total_revenue']:,.0f}. MRR: ₹{metrics['current_mrr']:,.0f}. ARR: ₹{metrics['current_arr']:,.0f}."},
            {"title": "Expense Analysis", "content": f"Total expenses: ₹{metrics['total_expenses']:,.0f}. Monthly burn: ₹{metrics['monthly_burn_rate']:,.0f}."},
            {"title": "Cash Position", "content": f"Cash reserves: ₹{metrics['cash_reserves']:,.0f}. Runway: {metrics['runway_months']:.1f} months."},
            {"title": "Profitability", "content": f"Gross profit margin: {metrics['gross_profit_margin']:.1f}%. Net cash flow: ₹{metrics['net_cash_flow']:,.0f}."},
        ],
        "health_score": metrics["health_score"],
        "health_status": metrics["health_status"],
        "key_metrics": metrics,
        "forecasts": forecasts,
    }


@router.get("/reports/{company_id}/investor")
async def generate_investor_report(company_id: str):
    """Generate an investor readiness assessment."""
    db = Database.db
    company_repo = CompanyRepository(db)
    txn_repo = TransactionRepository(db)

    company = await company_repo.find_by_id(company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    monthly_agg = await txn_repo.get_monthly_aggregates(company_id)
    cat_breakdown = await txn_repo.get_category_breakdown(company_id)
    total_count = await txn_repo.count_by_company(company_id)
    metrics = analytics.compute_metrics(monthly_agg, cat_breakdown, total_count)

    health = metrics["health_score"]
    runway = metrics["runway_months"]
    growth = metrics.get("revenue_growth_pct", 0)

    # Calculate investor score
    investor_score = int(min(100, health * 0.4 + min(runway / 18 * 100, 100) * 0.3 + min(max(growth + 50, 0), 100) * 0.3))

    if investor_score >= 75:
        readiness = "Strong — Ready for fundraising"
    elif investor_score >= 55:
        readiness = "Moderate — Address gaps before fundraising"
    else:
        readiness = "Weak — Significant improvements needed"

    strengths = []
    weaknesses = []
    improvements = []

    if health >= 70:
        strengths.append("Strong business health score indicating operational stability")
    else:
        weaknesses.append("Health score below optimal levels for investor confidence")
        improvements.append("Focus on improving profitability and reducing burn rate")

    if runway >= 12:
        strengths.append("Healthy runway providing operational buffer")
    else:
        weaknesses.append(f"Runway at {runway:.1f} months — investors prefer 12+ months")
        improvements.append("Extend runway through cost optimization or bridge funding")

    if growth > 10:
        strengths.append(f"Strong revenue growth at {growth:.1f}%")
    else:
        weaknesses.append("Revenue growth below investor expectations")
        improvements.append("Accelerate growth through new channels or product expansion")

    return {
        "status": "success",
        "company_id": company_id,
        "company_name": company["name"],
        "investor_score": investor_score,
        "funding_readiness": readiness,
        "strengths": strengths,
        "weaknesses": weaknesses,
        "improvement_plan": improvements,
        "metrics_snapshot": {
            "health_score": health,
            "runway_months": runway,
            "mrr": metrics["current_mrr"],
            "growth_pct": growth,
            "burn_rate": metrics["monthly_burn_rate"],
        },
    }


# ═══════════════════════════════════════════════════════════════════
# SEED / DEMO DATA
# ═══════════════════════════════════════════════════════════════════

@router.post("/demo/seed")
async def seed_demo_data():
    """Seed the database with 12 months of historical demo transactions."""
    db = Database.db
    company_repo = CompanyRepository(db)
    txn_repo = TransactionRepository(db)

    company = await company_repo.find_or_create("Acme Ventures Pvt Ltd", industry="SaaS")
    company_id = company["id"]

    # Generate 12 months of history
    transactions = generator.generate_historical_batch(months=12, per_month=40)
    for txn in transactions:
        txn["company_id"] = company_id

    # Run anomaly detection on the batch
    transactions = anomaly_detector.analyze_transactions(transactions)

    # Insert
    count = await txn_repo.insert_many(transactions)

    # Compute metrics
    monthly_agg = await txn_repo.get_monthly_aggregates(company_id)
    cat_breakdown = await txn_repo.get_category_breakdown(company_id)
    total_count = await txn_repo.count_by_company(company_id)
    metrics = analytics.compute_metrics(monthly_agg, cat_breakdown, total_count)

    return {
        "status": "success",
        "company_id": company_id,
        "company_name": company["name"],
        "transactions_seeded": count,
        "metrics": {
            "health_score": metrics["health_score"],
            "health_status": metrics["health_status"],
            "runway_months": metrics["runway_months"],
            "mrr": metrics["current_mrr"],
            "burn_rate": metrics["monthly_burn_rate"],
        },
    }


@router.get("/companies")
async def list_companies():
    """List all registered companies."""
    db = Database.db
    company_repo = CompanyRepository(db)
    companies = await company_repo.list_all()
    return {"status": "success", "companies": companies}
