"""LedgerSync FastAPI application entry point."""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db import init_db
from app.routes import files, runs, results

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database schema on startup."""
    logger.info("Initializing database schema…")
    try:
        init_db()
        logger.info("Database schema ready.")
    except Exception as e:
        logger.error("Failed to initialize DB: %s", e)
    yield


app = FastAPI(
    title="LedgerSync API",
    description="Mini Banking Transaction Reconciliation System",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow Next.js dev server and production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(files.router)
app.include_router(runs.router)
app.include_router(results.router)


@app.get("/health", tags=["health"])
def health():
    return {"status": "ok"}
