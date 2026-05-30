"""
FinSight AI — FastAPI Application Entry Point

Configures the FastAPI application with CORS, lifespan events,
and route registrations.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from app.core.config import settings
from app.database import Database
from app.api.v1.financials import router as financials_router
from app.api.v1.websockets import router as websockets_router

# ── Logging Configuration ────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s │ %(name)-25s │ %(levelname)-7s │ %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


# ── Application Lifespan ─────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage startup and shutdown events."""
    logger.info("=" * 60)
    logger.info(f"  {settings.APP_NAME} v{settings.APP_VERSION}")
    logger.info(f"  Autonomous CFO Operating System")
    logger.info("=" * 60)

    # Startup: Connect to MongoDB
    await Database.connect()
    logger.info("All systems online.")

    yield

    # Shutdown: Close MongoDB connection
    await Database.disconnect()
    logger.info("Shutdown complete.")


# ── FastAPI Application ──────────────────────────────────────────

app = FastAPI(
    title=settings.APP_NAME,
    description="Autonomous CFO Operating System — Financial Intelligence, Forecasting, and Decision Simulation",
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS Middleware ──────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Route Registration ──────────────────────────────────────────

app.include_router(financials_router, prefix="/api/v1", tags=["Financial Intelligence"])
app.include_router(websockets_router, prefix="/api/v1", tags=["Real-Time Streams"])


# ── Health Check ─────────────────────────────────────────────────

@app.get("/", tags=["System"])
async def root():
    return {
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "operational",
        "description": "Autonomous CFO Operating System",
    }


@app.get("/health", tags=["System"])
async def health_check():
    db_status = "connected" if Database.client else "disconnected"
    return {
        "status": "healthy",
        "database": db_status,
        "websocket_channels": ["transactions", "agents"],
    }
