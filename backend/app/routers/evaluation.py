from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.services.metrics.gold_labels import evaluate_extraction_benchmark
from app.services.metrics.replay import run_historical_replay

router = APIRouter(tags=["Evaluation & Replay"])


@router.get("/evaluation/metrics")
async def get_evaluation_metrics():
    metrics = evaluate_extraction_benchmark()
    return metrics


@router.get("/replay/results")
async def get_replay_results():
    results = run_historical_replay()
    return results

