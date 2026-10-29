from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, Any
from app.db.session import get_db
from app.services.qpiai.robustness_sandbox import evaluate_robustness_sandbox

router = APIRouter(prefix="/robustness", tags=["QpiAI Robustness Sandbox"])


@router.get("/scenarios")
async def get_robustness_scenarios(
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    return await evaluate_robustness_sandbox(db)


@router.post("/evaluate")
async def run_robustness_evaluation(
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    return await evaluate_robustness_sandbox(db)

