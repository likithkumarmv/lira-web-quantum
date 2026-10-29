from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.errors import LIRAException, lira_exception_handler, generic_http_exception_handler
from app.db.session import engine, Base, AsyncSessionLocal
from app.seed.live_demo import seed_live_demo_data

from app.routers import (
    auth, driver, ingest, incidents, recovery, qpiai, external, calls, edge, evaluation, audit, verification, resource_lock,
    risks, rag, investigations, robustness, cases, demo, copilot, stress, race, forecast
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Initialize Database Tables
    from app.db.session import ensure_db_schema
    await ensure_db_schema()

    # 2. Seed Initial Demo Data
    async with AsyncSessionLocal() as session:
        await seed_live_demo_data(session)

    yield


app = FastAPI(
    title="LIRA Central Backend API",
    description="Logistics Intelligence & Recovery Automation - Central Server for Web Manager, Android Driver App, and ESP32 Edge Device",
    version="v7.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/api/v1/openapi.json"
)

# CORS Middleware for LAN Hotspot & Multi-Device Compatibility
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception Handlers
app.add_exception_handler(LIRAException, lira_exception_handler)
from fastapi import HTTPException
app.add_exception_handler(HTTPException, generic_http_exception_handler)

# Include Routers under /api/v1 prefix
app.include_router(auth.router, prefix="/api/v1")
app.include_router(driver.router, prefix="/api/v1")
app.include_router(ingest.router, prefix="/api/v1")
app.include_router(incidents.router, prefix="/api/v1")
app.include_router(recovery.router, prefix="/api/v1")
app.include_router(qpiai.router, prefix="/api/v1")
app.include_router(external.router, prefix="/api/v1")
app.include_router(calls.router, prefix="/api/v1")
app.include_router(edge.router, prefix="/api/v1")
app.include_router(edge.router, prefix="")
app.include_router(evaluation.router, prefix="/api/v1")
app.include_router(audit.router, prefix="/api/v1")
app.include_router(verification.router, prefix="/api/v1")
app.include_router(resource_lock.router, prefix="/api/v1")
app.include_router(risks.router, prefix="/api/v1")
app.include_router(rag.router, prefix="/api/v1")
app.include_router(investigations.router, prefix="/api/v1")
app.include_router(robustness.router, prefix="/api/v1")
app.include_router(cases.router, prefix="/api/v1")
app.include_router(demo.router, prefix="/api/v1")
app.include_router(copilot.router, prefix="/api/v1")
app.include_router(stress.router, prefix="/api/v1")
app.include_router(race.router, prefix="/api/v1")
app.include_router(forecast.router, prefix="/api/v1")


@app.get("/")
async def root():
    return {
        "name": "LIRA — Logistics Intelligence & Recovery Automation",
        "api_docs": "/docs",
        "health": "/api/v1/health",
        "mode": "LIVE",
        "version": "v10.0"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)

