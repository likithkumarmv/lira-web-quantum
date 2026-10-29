"""
LIRA ResourceLock & Decision Capsule Schemas — PRD v9 Normative Specification
Defines schemas for:
1. Buttonless Resource Work Orders & Custodian Web Commitments.
2. Resource Registry, Leases, and Quarantine Actions.
3. Signed, Versioned, Expiring QpiAI Edge Decision Capsules.
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class ResourceWorkOrderCreateRequest(BaseModel):
    incident_id: Optional[str] = None
    plan_id: Optional[str] = None
    plan_version: int = 1
    resource_id: str
    action_type: str = "CHECKOUT"  # CHECKOUT | RETURN | INSPECTION
    custodian_user_id: str = "USR-MGR"
    target_device_id: str = "LIRA-EDGE-01"


class ResourceWorkOrderCommitRequest(BaseModel):
    auth_challenge: str
    operator_user_id: str
    notes: Optional[str] = None


class ResourceQuarantineRequest(BaseModel):
    defect_notes: str
    inspector_id: str


class ResourceResponse(BaseModel):
    resource_id: str
    resource_type: str
    name: str
    tag_ref: str
    status: str
    current_holder_id: Optional[str] = None
    current_lease_id: Optional[str] = None
    version: int
    location: str
    specs: Dict[str, Any] = Field(default_factory=dict)
    updated_at: str


class ResourceWorkOrderResponse(BaseModel):
    work_order_id: str
    incident_id: Optional[str] = None
    plan_id: Optional[str] = None
    plan_version: int = 1
    resource_id: str
    resource_name: Optional[str] = None
    action_type: str
    custodian_user_id: str
    target_device_id: str
    auth_challenge: str
    status: str  # PENDING_SCAN | TAG_OBSERVED | COMMITTED | REJECTED | CANCELLED
    observed_tag_ref: Optional[str] = None
    scan_observed_at: Optional[str] = None
    committed_at: Optional[str] = None
    rejection_reason: Optional[str] = None
    created_at: str


class DecisionCapsuleCandidate(BaseModel):
    candidate_id: str
    truck_id: str
    slot_id: str
    resource_id: str
    modeled_cost_inr: int
    predicates: Dict[str, Any] = Field(default_factory=dict)
    rank: int


class DecisionCapsuleResponse(BaseModel):
    snapshot_hash: str
    plan_version: int
    solver_run_id: str
    provider: str  # QPIAI_OPT | QPIAI_QCLOUD | HYBRID
    source_origin: str  # LAB_FIXTURE | LIVE_EXTERNAL
    capsule_status: str  # QPIAI_OPT_VALIDATED | QPIAI_OPT_RUNNING | LOCAL_PREVIEW_NOT_AUTHORIZED | NO_FEASIBLE_PLAN | QPIAI_PROVIDER_UNAVAILABLE
    shortlist_candidates: List[DecisionCapsuleCandidate] = Field(default_factory=list)
    exclusion_reasons: Dict[str, str] = Field(default_factory=dict)
    modeled_cost_baseline_inr: int
    modeled_cost_optimal_inr: int
    expires_at: str
    validator_proof_hash: str
    signature: str
    created_at: str

