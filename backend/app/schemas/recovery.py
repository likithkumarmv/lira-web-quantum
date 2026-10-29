from typing import List, Optional, Any
from pydantic import BaseModel, Field


class PlanAlternative(BaseModel):
    plan_id: str
    plan_code: str  # PLAN-A, PLAN-B, PLAN-C
    status: str
    solver_source: str  # QPIAI_QCLOUD_QAOA, QPIAI_OPT_QUBO, FALLBACK_CLASSICAL
    truck_id: str
    slot_id: str
    slot_start: str
    slot_end: str
    checkpoint_id: str
    avoidable_cost_inr: int
    net_cost_inr: int
    feasibility_score: float
    feasible: bool
    constraint_violations: List[str]
    strategy_summary: str


class RecoveryAlternativesResponse(BaseModel):
    incident_id: str
    wave: int
    do_nothing_cost_inr: int
    alternatives: List[PlanAlternative]
    evaluated_at: str


class ApprovePlanRequest(BaseModel):
    reason: str
    manager_role: str = "DISPATCHER"


class ApprovePlanResponse(BaseModel):
    accepted: bool
    plan_id: str
    plan_code: str
    assignment_id: str
    status: str
    driver_notified: bool
    edge_notified: bool
    message: str

