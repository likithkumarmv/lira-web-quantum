from typing import List, Optional, Any
from pydantic import BaseModel, Field
from app.schemas.evidence import CandidateBlocker


class BlockerNodeSchema(BaseModel):
    node_id: str
    incident_id: str
    container_id: str
    code: str
    claim: str
    quote: Optional[str] = None
    start_char: int = 0
    end_char: int = 0
    authority_tier: str = "T2"
    status: str = "NEEDS_VERIFICATION"
    responsible_role: str = "CUSTOMS_BROKER"
    evidence_id: Optional[str] = None


class DependencyEdgeSchema(BaseModel):
    edge_id: str
    incident_id: str
    source_node_id: str
    target_node_id: str
    relationship_type: str = "BLOCKS"


class IncidentItem(BaseModel):
    incident_id: str
    container_id: str
    title: str
    severity: str
    status: str
    root_blocker_code: str
    owner_role: str
    action_deadline: str
    projected_avoidable_cost_inr: int
    do_nothing_cost_inr: int
    has_hard_blocker: bool = False
    evidence_count: int = 0
    updated_at: str


class IncidentDetailResponse(BaseModel):
    incident_id: str
    container_id: str
    title: str
    severity: str
    status: str
    root_blocker_code: str
    owner_role: str
    action_deadline: str
    projected_avoidable_cost_inr: int
    do_nothing_cost_inr: int
    nodes: List[BlockerNodeSchema]
    edges: List[DependencyEdgeSchema]
    container_details: dict
    created_at: str
    updated_at: str


class VerifyRequest(BaseModel):
    action_type: str = "REQUEST_BROKER_AFFIDAVIT"
    target_role: str = "CUSTOMS_BROKER"
    notes: Optional[str] = None


class VerifyResponse(BaseModel):
    task_id: str
    incident_id: str
    status: str
    message: str

