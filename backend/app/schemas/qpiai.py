from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field


class SolverRunResponse(BaseModel):
    run_id: str
    incident_id: str
    formulation_hash: str
    variables_count: int
    constraints_count: int
    provider_backend: str
    mode: str  # LIVE_QCLOUD | LOCAL_SIMULATOR | MOCK | CLASSICAL_FALLBACK
    shots: int
    execution_time_ms: int
    feasible_count: int
    best_energy: float
    qaoa_distribution: Dict[str, float]
    raw_metadata: Dict[str, Any]
    circuit_depth: Optional[int] = 0
    gate_counts: Optional[Dict[str, Any]] = None
    subspace_feasibility_ratio: Optional[float] = 1.0
    problem_hash: Optional[str] = None
    fallback_status: Optional[str] = "LIVE_QCLOUD"
    sdk_version: Optional[str] = "0.7.5"
    degree: Optional[int] = 3
    cubic_terms_count: Optional[int] = 0
    created_at: str


class TriggerSolveRequest(BaseModel):
    prefer_quantum: bool = True
    wave: int = 1


class TriggerSolveResponse(BaseModel):
    run_id: str
    incident_id: str
    status: str
    provider_mode: str
    solver_source: str
    alternatives_generated: int
    best_avoidable_cost_inr: int
    message: str


class HUBOFormulationResponse(BaseModel):
    incident_id: str
    degree: int = 3
    variable_names: List[str]
    pruned_triples_count: int
    linear_vector: Dict[str, float]
    quadratic_matrix: List[List[float]]
    cubic_terms: List[Dict[str, Any]]
    slot_swap_ledger: List[Dict[str, Any]] = Field(default_factory=list)
    polynomial_dict_sample: Dict[str, float]
    formulation_hash: str
