from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class EdgeEventRequest(BaseModel):
    device_id: str
    event_type: str  # SCAN_OBSERVED | RFID_TAG_OBSERVED | RFID_MISMATCH | OPERATOR_CONFIRMED | EXCEPTION_REPORTED | PHYSICAL_NO_SHOW
    assignment_id: Optional[str] = None
    container_id: Optional[str] = None
    truck_id: Optional[str] = None
    rfid_token: Optional[str] = None
    rfid_match: bool = False
    bay_present: bool = True
    observed_at: Optional[str] = None
    sequence: int = 1
    device_seq: Optional[int] = None
    nonce: Optional[str] = None
    # v9 ResourceLock fields
    work_order_id: Optional[str] = None
    tag_ref: Optional[str] = None
    # Legacy v7 fields (retained for backward compatibility)
    operator_action: Optional[str] = None
    exception_code: Optional[str] = None
    eeprom_sector4_dump: Optional[str] = None
    rolling_ratchet_counter: Optional[int] = None
    touch_signature_hash: Optional[str] = None
    mean_z_pressure: Optional[float] = None
    qr_custody_token: Optional[str] = None
    edge_qaoa_bitstring_matched: Optional[str] = None
    signature: Optional[str] = None


class EdgeEventResponse(BaseModel):
    accepted: bool
    event_id: str
    verified: bool
    action_triggered: Optional[str] = None
    checkpoint_state: str = "NORMAL"
    work_order_status: Optional[str] = None
    proof_of_readiness_stamped: bool = False
    cloned_tag_detected: bool = False
    message: str


class EdgeTFTStateResponse(BaseModel):
    device_id: str
    online: bool
    hardware_profile: str = "ESP32_DEV_V1_ILI9341_DISPLAY_ONLY_RC522_V9"
    checkpoint_label: str = "Yard Marshal Pre-Gate Display Terminal (RC522 Scan Only — Web-Gated Authorization)"
    screen_view: str = "RESOURCE_LOCK_STATUS"
    display_header: str = "LIRA RESOURCELOCK v9"
    display_lines: List[str] = Field(default_factory=list)
    prompt_tag: bool = False
    tag_observed: bool = False
    awaiting_web_confirmation: bool = False
    active_work_order_id: Optional[str] = None
    rfid_uid_expected: str = "TAG_07"
    assignment_id: Optional[str] = None
    container_id: Optional[str] = None
    truck_id: Optional[str] = None
    slot_start: Optional[str] = None
    free_time_deadline: Optional[str] = None
    approval_state: str = "NO_ASSIGNMENT"
    customs_release: str = "CONFIRMED"
    physical_state: str = "EXPECTED"
    risk_label: str = "LOW"
    risk_reason: str = "NORMAL_OPERATIONS"
    qpiai_state: str = "IDLE"
    last_event_at: Optional[str] = None
    server_received_at: Optional[str] = None

    # Decision Capsule & Preview Policy (Evaluated server-side, pre-cached for TFT preview)
    decision_capsule_status: str = "QPIAI_OPT_VALIDATED"
    edge_qaoa_policy_table: List[Dict[str, Any]] = Field(default_factory=list)
    slot_swap_arbitrage_active: bool = True
    rebate_awarded_c208_inr: int = 3000


class EdgeSimulationRequest(BaseModel):
    device_id: str = "LIRA-EDGE-01"
    event_type: str = "RFID_MISMATCH"  # RFID_MISMATCH | EXCEPTION_REPORTED | PHYSICAL_NO_SHOW | OPERATOR_CONFIRMED | STAGING_EVIDENCED
    rfid_token: Optional[str] = "WRONG_TAG_99"
    rfid_match: bool = False
    operator_action: Optional[str] = None
    exception_code: Optional[str] = None
    eeprom_sector4_dump: Optional[str] = None
    rolling_ratchet_counter: Optional[int] = None
    touch_signature_hash: Optional[str] = None
    mean_z_pressure: Optional[float] = None
    qr_custody_token: Optional[str] = None
    edge_qaoa_bitstring_matched: Optional[str] = None
