from typing import List, Optional, Any
from pydantic import BaseModel, Field


class AssignmentItem(BaseModel):
    assignment_id: str
    plan_id: str
    container_id: str
    truck_id: str
    slot_id: str
    slot_start: str
    slot_end: str
    checkpoint_id: str
    status: str  # APPROVED | ACKNOWLEDGED | REASSIGNED | STAGING_EVIDENCED | PHYSICAL_NO_SHOW | CANCELLED
    driver_ack_state: str  # PENDING | ACKNOWLEDGED | CANNOT_COMPLY
    physical_state: str  # EXPECTED | RFID_MISMATCH | BAY_ABSENT_WARNING | PHYSICAL_NO_SHOW | STAGING_EVIDENCED
    reason_code: str
    reason_text: str
    customs_release: str
    deadline: str
    projected_avoidable_cost_inr: int
    evidence_ids: List[str]
    assignment_kind: Optional[str] = "ACTIVE"
    origin: Optional[str] = "DISPATCHER"
    updated_at: str


class DriverAssignmentsResponse(BaseModel):
    items: List[AssignmentItem]
    updated_at: str


class DriverAckRequest(BaseModel):
    action: str  # ACKNOWLEDGE | CANNOT_COMPLY
    reason: Optional[str] = None


class DriverAckResponse(BaseModel):
    accepted: bool
    assignment_id: str
    driver_ack_state: str
    event_id: str


class DriverEtaRequest(BaseModel):
    truck_id: str
    eta: str
    reason: Optional[str] = "TRAFFIC"
    source: Optional[str] = "DRIVER_SELF_REPORT"


class DriverEtaResponse(BaseModel):
    accepted: bool
    event_id: str
    recovery_status: str


class DisruptionItem(BaseModel):
    event_id: str
    type: str
    trust_state: str  # FORECAST_RISK | CONFIRMED_DISRUPTION | CANCELLED
    severity: str
    title: str
    source_label: str
    affected_trucks: List[str]
    starts_at: str
    ends_at: str
    updated_at: str


class DriverDisruptionsResponse(BaseModel):
    items: List[DisruptionItem]


class DriverEventItem(BaseModel):
    event_id: str
    sequence: int
    type: str
    assignment_id: Optional[str] = None
    created_at: str
    payload: dict


class DriverEventsResponse(BaseModel):
    items: List[DriverEventItem]
    next_sequence: int


class CheckpointStatusResponse(BaseModel):
    assignment_id: str
    device_id: str
    state: str
    rfid_state: str
    bay_present: bool
    last_event_at: Optional[str] = None

