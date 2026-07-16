"""Katha Story Generator - FastAPI Application."""

import logging
from contextlib import asynccontextmanager
from functools import lru_cache

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from katha.core.config import Settings
from katha.core.dependencies import get_db

logger = logging.getLogger(__name__)


@lru_cache
def get_settings() -> Settings:
    return Settings()


def _get_r2_client():
    """Lazily create R2 client. Returns None if R2 is not configured."""
    settings = get_settings()
    if not settings.R2_ACCESS_KEY_ID or not settings.R2_ENDPOINT_URL:
        return None
    from katha.integrations.r2_storage import R2Client

    return R2Client(settings)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    logger.info("Katha backend starting up")
    yield
    logger.info("Katha backend shutting down")


settings = get_settings()

app = FastAPI(
    title="Katha Story Generator",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    """Health check endpoint. Returns 200 if healthy, 503 if degraded."""
    checks: dict[str, str] = {}

    # Check database
    try:
        async for session in get_db():
            await session.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception:
        logger.exception("Database health check failed")
        checks["database"] = "unavailable"

    # Check R2 storage (lazy — skips if not configured)
    try:
        r2_client = _get_r2_client()
        if r2_client is None:
            checks["r2"] = "unavailable"
        else:
            r2_ok = r2_client.check_connection()
            checks["r2"] = "ok" if r2_ok else "unavailable"
    except Exception:
        logger.exception("R2 health check failed")
        checks["r2"] = "unavailable"

    all_ok = all(v == "ok" for v in checks.values())

    return JSONResponse(
        status_code=200 if all_ok else 503,
        content={
            "status": "healthy" if all_ok else "degraded",
            "checks": checks,
            "version": "0.1.0",
        },
    )
