from fastapi import APIRouter, HTTPException, Query, Body
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
from app.services.cases.six_cases import SIX_FREIGHT_EXCEPTION_CASES, get_case_by_id, recalculate_case_cost

router = APIRouter(prefix="/cases", tags=["Freight Exception Cases C1-C6"])


class RecalculateRequest(BaseModel):
    delay_minutes: int = 0
    rate_multiplier: float = 1.0


@router.get("")
async def list_cases():
    """List all six canonical freight exception cases (C1-C6) with summary cards."""
    summaries = []
    for c in SIX_FREIGHT_EXCEPTION_CASES:
        summaries.append({
            "case_id": c["case_id"],
            "container_id": c["container_id"],
            "bl_number": c["bl_number"],
            "case_family": c["case_family"],
            "title": c["title"],
            "root_blocker_code": c["root_blocker_code"],
            "blocker_status": c["blocker_status"],
            "jurisdiction": c["jurisdiction"],
            "owner_role": c["owner_role"],
            "sla_countdown": c["sla_countdown"],
            "avoidable_cost_inr": c["cost_waterfall"]["avoidable_cost_inr"],
            "tariff_basis": c["cost_waterfall"]["tariff_basis"]
        })
    return {
        "cases": summaries,
        "count": len(summaries),
        "source": "CANONICAL_FREIGHT_EXCEPTION_FIXTURES",
        "standard": "Quant-A-Maze 3.0 Track IV GENAI-01"
    }


@router.get("/{case_id}")
async def get_case_detail(case_id: str):
    """Get complete 6-step deep fixture for a specific case (C1-C6)."""
    case = get_case_by_id(case_id)
    if not case:
        raise HTTPException(status_code=404, detail=f"Case {case_id} not found")
    return case


@router.post("/{case_id}/recalculate")
async def recalculate_case(case_id: str, payload: RecalculateRequest):
    """
    Deterministic recalculation of avoidable demurrage/detention costs
    in LAB_FIXTURE mode with interactive slider adjustments.
    """
    try:
        return recalculate_case_cost(
            case_id=case_id,
            delay_minutes=payload.delay_minutes,
            rate_multiplier=payload.rate_multiplier
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

