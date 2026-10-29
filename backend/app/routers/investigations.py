from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.db.models import InvestigationRunModel, EdgeScanRequestModel
from app.services.qpiai.investigation_director import (
    run_qpiai_investigation_director, CANDIDATE_INVESTIGATION_ACTIONS
)

router = APIRouter(prefix="/investigations", tags=["QpiAI Investigation Director"])


class InvestigationOptimizeRequest(BaseModel):
    incident_id: str = "INC-C102"
    device_id: str = "LIRA-EDGE-01"
    budget_k: int = 2


@router.post("/optimize")
async def optimize_investigation_tasks(
    req: InvestigationOptimizeRequest,
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    result = await run_qpiai_investigation_director(
        db=db,
        incident_id=req.incident_id,
        device_id=req.device_id,
        budget_k=req.budget_k
    )
    return result


@router.get("/actions")
async def get_candidate_actions():
    return {
        "count": len(CANDIDATE_INVESTIGATION_ACTIONS),
        "items": CANDIDATE_INVESTIGATION_ACTIONS
    }


@router.get("/{investigation_id}")
async def get_investigation_run(
    investigation_id: str,
    db: AsyncSession = Depends(get_db)
):
    run = await db.get(InvestigationRunModel, investigation_id)
    if not run:
        raise HTTPException(status_code=404, detail="Investigation run not found")
    return {
        "investigation_id": run.investigation_id,
        "incident_id": run.incident_id,
        "solver_mode": run.solver_mode,
        "status": run.status,
        "selected_action_ids": run.selected_action_ids,
        "why_this_check_first": run.why_this_check_first,
        "classical_comparator": run.classical_comparator,
        "runtime_ms": run.runtime_ms,
        "created_at": run.created_at
    }

