"""
FinSight AI — WebSocket API Endpoints

Real-time transaction streaming and multi-agent thought broadcasting.
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.core.websocket_manager import ws_manager
from app.services.generator import TransactionGenerator
from app.database import Database
from app.repositories.repositories import TransactionRepository, CompanyRepository
from app.services.analytics import AnalyticsService
from app.services.forecasting import ForecastingEngine
from app.agents.orchestrator import AgentOrchestrator
from app.core.config import settings
import asyncio
import json
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

generator = TransactionGenerator()
analytics = AnalyticsService()
forecasting = ForecastingEngine()
orchestrator = AgentOrchestrator()


@router.websocket("/ws/transactions")
async def ws_transactions(websocket: WebSocket, company_id: str = None):
    """
    Real-time transaction stream.
    Generates and broadcasts mock transactions at configured intervals ONLY for demo companies.
    For live companies, remains open for real-time pushed feed events.
    """
    db = Database.db
    company_repo = CompanyRepository(db)
    txn_repo = TransactionRepository(db)

    # Ensure company exists
    if not company_id:
        company = await company_repo.find_or_create(settings.GENERATOR_COMPANY_NAME)
        company_id = company["id"]
    else:
        company = await company_repo.find_by_id(company_id)
        if not company:
            company = await company_repo.find_or_create(settings.GENERATOR_COMPANY_NAME)
            company_id = company["id"]

    await ws_manager.connect(websocket, "transactions", company_id=company_id)
    try:
        is_demo = (company.get("name") == settings.GENERATOR_COMPANY_NAME)

        if is_demo:
            while True:
                # Generate a new transaction
                txn = generator.generate_transaction()
                txn["company_id"] = company_id

                # Save to MongoDB
                saved = await txn_repo.insert_one(txn.copy())

                # Broadcast to all connected clients on this company
                event_type = "anomaly_alert" if txn.get("is_anomaly") else "transaction_created"
                await ws_manager.broadcast("transactions", {
                    "event": event_type,
                    "data": {
                        "transaction_id": saved.get("id", ""),
                        "date": txn["date"].isoformat() if hasattr(txn["date"], "isoformat") else str(txn["date"]),
                        "description": txn["description"],
                        "category": txn["category"],
                        "amount": txn["amount"],
                        "is_anomaly": txn["is_anomaly"],
                        "anomaly_score": txn.get("anomaly_score", 0),
                        "anomaly_reason": txn.get("anomaly_reason"),
                    },
                }, company_id=company_id)

                await asyncio.sleep(settings.GENERATOR_INTERVAL_SECONDS)
        else:
            # For real uploaded company, keep connection open for live API/webhook ingestion feeds
            while True:
                await asyncio.sleep(15)
                try:
                    await websocket.send_json({"event": "ping"})
                except Exception:
                    break

    except WebSocketDisconnect:
        await ws_manager.disconnect(websocket, "transactions")
    except Exception as e:
        logger.error(f"Transaction WS error: {e}")
        await ws_manager.disconnect(websocket, "transactions")


@router.websocket("/ws/agents")
async def ws_agents(websocket: WebSocket, company_id: str = None):
    """
    Multi-agent analysis stream.
    Clients send analysis requests, agents stream their thinking in real-time.
    """
    await ws_manager.connect(websocket, "agents", company_id=company_id)
    try:
        while True:
            # Wait for client to request analysis
            raw = await websocket.receive_text()
            data = json.loads(raw)
            action = data.get("action", "analyze_ledger")
            company_id = data.get("company_id")

            if not company_id:
                await ws_manager.send_personal(websocket, {
                    "event": "error",
                    "data": {"message": "company_id is required"}
                })
                continue

            # Build emit function to stream thoughts to this client
            async def emit_thought(agent: str, status: str, message: str):
                await ws_manager.send_personal(websocket, {
                    "event": "agent_thought",
                    "data": {
                        "agent": agent,
                        "status": status,
                        "message": message,
                    }
                })

            # Fetch current metrics
            db = Database.db
            txn_repo = TransactionRepository(db)
            monthly_agg = await txn_repo.get_monthly_aggregates(company_id)
            cat_breakdown = await txn_repo.get_category_breakdown(company_id)
            total_count = await txn_repo.count_by_company(company_id)

            metrics = analytics.compute_metrics(monthly_agg, cat_breakdown, total_count)
            forecast_data = forecasting.forecast_all(
                monthly_agg, metrics.get("cash_reserves", 0)
            )

            # Run multi-agent analysis with streaming thoughts
            result = await orchestrator.full_analysis(
                metrics=metrics,
                forecast_data=forecast_data,
                query=data.get("query", "Analyze current financial position"),
                emit_fn=emit_thought,
            )

            # Send final consolidated result
            await ws_manager.send_personal(websocket, {
                "event": "agent_response_complete",
                "data": result,
            })

    except WebSocketDisconnect:
        await ws_manager.disconnect(websocket, "agents")
    except Exception as e:
        logger.error(f"Agent WS error: {e}")
        await ws_manager.disconnect(websocket, "agents")
