import datetime
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, Text, DateTime, JSON, ForeignKey, Enum
)
from sqlalchemy.orm import relationship
from app.db.session import Base


def utcnow_iso():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


class UserModel(Base):
    __tablename__ = "users"

    id = Column(String(64), primary_key=True)
    user_code = Column(String(64), unique=True, index=True, nullable=False)
    role = Column(String(32), default="DRIVER")  # DRIVER, DISPATCHER, OPS_MANAGER, AUDITOR
    display_name = Column(String(128))
    truck_id = Column(String(32), nullable=True)
    active = Column(Boolean, default=True)
    created_at = Column(String(64), default=utcnow_iso)


class TruckModel(Base):
    __tablename__ = "trucks"

    truck_id = Column(String(32), primary_key=True, index=True)
    driver_id = Column(String(64), nullable=True)
    capacity_teu = Column(Integer, default=2)
    payload_capacity_kg = Column(Float, default=28000.0)
    driver_hours_used = Column(Float, default=4.0)
    driver_hours_max = Column(Float, default=10.0)
    location_lat = Column(Float, default=18.94)
    location_lng = Column(Float, default=72.95)
    location_eta = Column(String(64), nullable=True)
    availability = Column(String(32), default="AVAILABLE")  # AVAILABLE, IN_TRANSIT, DELAYED, OFF_DUTY
    updated_at = Column(String(64), default=utcnow_iso)


class ContainerModel(Base):
    __tablename__ = "containers"

    container_id = Column(String(32), primary_key=True, index=True)
    size_ft = Column(Integer, default=40)  # 20 or 40
    cargo_type = Column(String(64), default="GENERAL_CARGO")
    weight_kg = Column(Float, default=22500.0)
    special_handling = Column(String(64), default="STANDARD")
    release_state = Column(String(32), default="NEEDS_VERIFICATION")  # UNCONFIRMED, NEEDS_VERIFICATION, CONFIRMED
    free_time_deadline = Column(String(64), nullable=False)
    delivery_deadline = Column(String(64), nullable=False)
    demurrage_rate_per_hr = Column(Integer, default=3000)
    late_delivery_penalty_per_hr = Column(Integer, default=5000)
    proof_of_readiness_status = Column(String(64), default="NOT_STAMPED")  # HARDWARE_PROOF_OF_READINESS_VERIFIED
    statutory_immunity_dossier = Column(JSON, default=dict)
    assigned_slot_id = Column(String(32), nullable=True)
    slot_yield_rebate_inr = Column(Integer, default=0)
    updated_at = Column(String(64), default=utcnow_iso)


class SlotModel(Base):
    __tablename__ = "slots"

    slot_id = Column(String(32), primary_key=True, index=True)
    bay_number = Column(String(32), default="BAY-01")
    start_at = Column(String(64), nullable=False)
    end_at = Column(String(64), nullable=False)
    bay_capacity = Column(Integer, default=1)
    eligible_equipment = Column(String(64), default="CHASSIS_40FT")
    confirmed_status = Column(String(32), default="CONFIRMED")  # CONFIRMED, TENTATIVE, CANCELLED
    updated_at = Column(String(64), default=utcnow_iso)


class ShipmentModel(Base):
    __tablename__ = "shipments"

    shipment_id = Column(String(64), primary_key=True, index=True)
    container_id = Column(String(32), ForeignKey("containers.container_id"), nullable=False)
    bill_of_lading_alias = Column(String(64), index=True)
    importer_name = Column(String(128))
    customs_broker = Column(String(128))
    created_at = Column(String(64), default=utcnow_iso)


class EvidenceRecordModel(Base):
    __tablename__ = "evidence_records"

    evidence_id = Column(String(64), primary_key=True, index=True)
    container_id = Column(String(32), index=True, nullable=True)
    source_id = Column(String(64), nullable=False)
    source_type = Column(String(32), default="EMAIL")  # EMAIL, PDF, EDI, PHONE_CONFIRMATION, IOT_SENSOR
    tier = Column(String(16), default="T2")  # T1 (Official EDI/Port), T2 (Carrier/Broker email), T3 (Driver self-report)
    quote = Column(Text, nullable=False)
    start_char = Column(Integer, default=0)
    end_char = Column(Integer, default=0)
    raw_source_text = Column(Text, nullable=True)
    source_hash = Column(String(64), nullable=True)
    observed_at = Column(String(64), default=utcnow_iso)
    freshness_minutes = Column(Integer, default=10)
    claims = Column(JSON, default=list)
    created_at = Column(String(64), default=utcnow_iso)


class IncidentModel(Base):
    __tablename__ = "incidents"

    incident_id = Column(String(64), primary_key=True, index=True)
    container_id = Column(String(32), ForeignKey("containers.container_id"), index=True, nullable=False)
    title = Column(String(256), nullable=False)
    severity = Column(String(32), default="HIGH")  # CRITICAL, HIGH, MEDIUM, LOW
    status = Column(String(32), default="OPEN")  # OPEN, NEEDS_VERIFICATION, SOLVING, RESOLVED, CANCELLED
    root_blocker_code = Column(String(64), default="DOCUMENT_MISMATCH")
    owner_role = Column(String(64), default="CUSTOMS_BROKER")
    action_deadline = Column(String(64), nullable=False)
    projected_avoidable_cost_inr = Column(Integer, default=0)
    do_nothing_cost_inr = Column(Integer, default=0)
    created_at = Column(String(64), default=utcnow_iso)
    updated_at = Column(String(64), default=utcnow_iso)


class BlockerNodeModel(Base):
    __tablename__ = "blocker_nodes"

    node_id = Column(String(64), primary_key=True, index=True)
    incident_id = Column(String(64), ForeignKey("incidents.incident_id"), index=True, nullable=False)
    container_id = Column(String(32), nullable=False)
    code = Column(String(64), nullable=False)
    claim = Column(Text, nullable=False)
    quote = Column(Text, nullable=True)
    start_char = Column(Integer, default=0)
    end_char = Column(Integer, default=0)
    authority_tier = Column(String(16), default="T2")
    status = Column(String(32), default="NEEDS_VERIFICATION")  # NEEDS_VERIFICATION, HARD_BLOCKER, CLEARED
    responsible_role = Column(String(64), default="CUSTOMS_BROKER")
    evidence_id = Column(String(64), nullable=True)
    created_at = Column(String(64), default=utcnow_iso)


class DependencyEdgeModel(Base):
    __tablename__ = "dependency_edges"

    edge_id = Column(String(64), primary_key=True)
    incident_id = Column(String(64), ForeignKey("incidents.incident_id"), index=True, nullable=False)
    source_node_id = Column(String(64), nullable=False)
    target_node_id = Column(String(64), nullable=False)
    relationship_type = Column(String(32), default="BLOCKS")


class ExternalEventModel(Base):
    __tablename__ = "external_events"

    event_id = Column(String(64), primary_key=True, index=True)
    type = Column(String(64), nullable=False)  # HEAVY_RAIN, PORT_CONGESTION, PORT_CLOSURE, TRAFFIC_JAM
    trust_state = Column(String(32), default="FORECAST_RISK")  # FORECAST_RISK, CONFIRMED_DISRUPTION, CANCELLED
    severity = Column(String(32), default="HIGH")  # LOW, MEDIUM, HIGH, CRITICAL
    title = Column(String(256), nullable=False)
    source_label = Column(String(128), default="Weather feed / DEMO")
    geography = Column(String(128), default="Nhava Sheva Approach Road")
    starts_at = Column(String(64), nullable=False)
    ends_at = Column(String(64), nullable=False)
    affected_trucks = Column(JSON, default=list)
    affected_slots = Column(JSON, default=list)
    is_simulated = Column(Boolean, default=False)
    created_at = Column(String(64), default=utcnow_iso)
    updated_at = Column(String(64), default=utcnow_iso)


class RecoveryPlanModel(Base):
    __tablename__ = "recovery_plans"

    plan_id = Column(String(64), primary_key=True, index=True)
    incident_id = Column(String(64), ForeignKey("incidents.incident_id"), index=True, nullable=False)
    wave = Column(Integer, default=1)
    plan_code = Column(String(32), default="PLAN-A")  # PLAN-A, PLAN-B, PLAN-C, PLAN-R1, PLAN-R2
    status = Column(String(32), default="GENERATED")  # GENERATED, RECOMMENDED, APPROVED, REJECTED, REPLACED, EXECUTED
    solver_source = Column(String(64), default="QPIAI_QCLOUD_QAOA")  # QPIAI_QCLOUD_QAOA, QPIAI_OPT_QUBO, FALLBACK_CLASSICAL
    avoidable_cost_inr = Column(Integer, default=0)
    net_cost_inr = Column(Integer, default=0)
    feasibility_score = Column(Float, default=1.0)
    constraint_violations = Column(JSON, default=list)
    strategy_summary = Column(Text, nullable=True)
    approved_by = Column(String(64), nullable=True)
    approved_at = Column(String(64), nullable=True)
    approval_reason = Column(Text, nullable=True)
    created_at = Column(String(64), default=utcnow_iso)


class AssignmentModel(Base):
    __tablename__ = "assignments"

    assignment_id = Column(String(64), primary_key=True, index=True)
    plan_id = Column(String(64), ForeignKey("recovery_plans.plan_id"), index=True, nullable=False)
    container_id = Column(String(32), ForeignKey("containers.container_id"), nullable=False)
    truck_id = Column(String(32), ForeignKey("trucks.truck_id"), nullable=False)
    slot_id = Column(String(32), ForeignKey("slots.slot_id"), nullable=False)
    slot_start = Column(String(64), nullable=False)
    slot_end = Column(String(64), nullable=False)
    checkpoint_id = Column(String(64), default="LIRA-EDGE-01")
    status = Column(String(32), default="APPROVED")  # APPROVED | ACKNOWLEDGED | REASSIGNED | STAGING_EVIDENCED | PHYSICAL_NO_SHOW | CANCELLED
    driver_ack_state = Column(String(32), default="PENDING")  # PENDING | ACKNOWLEDGED | CANNOT_COMPLY
    physical_state = Column(String(32), default="EXPECTED")  # EXPECTED | RFID_MISMATCH | BAY_ABSENT_WARNING | PHYSICAL_NO_SHOW | STAGING_EVIDENCED
    reason_code = Column(String(64), default="OPTIMIZED_DISPATCH")
    reason_text = Column(Text, default="Assigned optimal recovery slot and truck")
    customs_release = Column(String(32), default="CONFIRMED")
    deadline = Column(String(64), nullable=False)
    projected_avoidable_cost_inr = Column(Integer, default=0)
    evidence_ids = Column(JSON, default=list)
    assignment_kind = Column(String(32), default="ACTIVE")  # ACTIVE | RESERVE_STANDBY
    origin = Column(String(32), default="DISPATCHER")  # LIVE_CALL | COPILOT | STRESS_PROMOTED | DISPATCHER | STATION_BRANCH
    updated_at = Column(String(64), default=utcnow_iso)


class DriverEventModel(Base):
    __tablename__ = "driver_events"

    event_id = Column(String(64), primary_key=True, index=True)
    sequence = Column(Integer, autoincrement=True, unique=True, index=True)
    truck_id = Column(String(32), index=True, nullable=False)
    assignment_id = Column(String(64), nullable=True)
    type = Column(String(64), nullable=False)  # PLAN_REPLACED, ASSIGNMENT_READY, DISRUPTION_ALERT, ACK_RECORDED
    payload = Column(JSON, default=dict)
    created_at = Column(String(64), default=utcnow_iso)


class EdgeDeviceModel(Base):
    __tablename__ = "edge_devices"

    device_id = Column(String(64), primary_key=True, index=True)
    name = Column(String(128), default="Gate & Bay Staging Verifier")
    location = Column(String(128), default="Terminal Bay 01 Checkpoint")
    hmac_key = Column(String(128), default="edge_hmac_secret_key_lira_01")
    is_online = Column(Boolean, default=True)
    last_heartbeat = Column(String(64), default=utcnow_iso)
    last_sequence = Column(Integer, default=0)
    last_ratchet_counter = Column(Integer, default=100)
    # v9 ResourceLock & Buttonless fields
    active_work_order_id = Column(String(64), nullable=True)
    active_challenge = Column(String(64), nullable=True)
    challenge_expires_at = Column(String(64), nullable=True)
    current_display_state = Column(JSON, default=dict)
    decision_capsule = Column(JSON, default=dict)


class EdgeEventModel(Base):
    __tablename__ = "edge_events"

    event_id = Column(String(64), primary_key=True, index=True)
    device_id = Column(String(64), ForeignKey("edge_devices.device_id"), index=True, nullable=False)
    event_type = Column(String(64), nullable=False)  # SCAN_OBSERVED, RFID_TAG_OBSERVED, RFID_MISMATCH, etc.
    assignment_id = Column(String(64), nullable=True)
    container_id = Column(String(32), nullable=True)
    truck_id = Column(String(32), nullable=True)
    rfid_token = Column(String(64), nullable=True)
    rfid_match = Column(Boolean, default=False)
    bay_present = Column(Boolean, default=True)
    observed_at = Column(String(64), default=utcnow_iso)
    sequence = Column(Integer, default=0)
    device_seq = Column(Integer, default=0)
    nonce = Column(String(64), nullable=True)
    # v9 ResourceLock fields
    work_order_id = Column(String(64), nullable=True)
    tag_ref = Column(String(64), nullable=True)
    action_result = Column(String(64), nullable=True)
    # Historical v7 fields retained for legacy compatibility
    operator_action = Column(String(32), nullable=True)  # Legacy v7
    exception_code = Column(String(64), nullable=True)
    eeprom_sector4_dump = Column(String(128), nullable=True)  # Legacy v7
    rolling_ratchet_counter = Column(Integer, default=0)
    touch_signature_hash = Column(String(128), nullable=True)  # Legacy v7
    mean_z_pressure = Column(Float, default=0.0)  # Legacy v7
    qr_custody_token = Column(String(128), nullable=True)
    edge_qaoa_bitstring_matched = Column(String(32), nullable=True)
    signature = Column(String(128), nullable=True)
    verified = Column(Boolean, default=False)
    server_received_at = Column(String(64), default=utcnow_iso)
    created_at = Column(String(64), default=utcnow_iso)


class AuditEventModel(Base):
    __tablename__ = "audit_events"

    audit_id = Column(String(64), primary_key=True, index=True)
    correlation_id = Column(String(64), index=True)
    event_type = Column(String(64), nullable=False)
    entity_type = Column(String(64), nullable=False)
    entity_id = Column(String(64), nullable=False)
    actor = Column(String(64), default="SYSTEM")
    description = Column(Text, nullable=False)
    details = Column(JSON, default=dict)
    timestamp = Column(String(64), default=utcnow_iso)


class CallJobModel(Base):
    __tablename__ = "call_jobs"

    call_id = Column(String(64), primary_key=True, index=True)
    incident_id = Column(String(64), index=True, nullable=False)
    truck_id = Column(String(32), nullable=True)
    phone_number = Column(String(32), default="+919876543210")
    recipient_name = Column(String(64), default="Driver T04")
    provider = Column(String(32), default="BOLNA")  # BOLNA, SARVAM
    status = Column(String(32), default="INITIATED")  # INITIATED, IN_PROGRESS, COMPLETED, FAILED
    extracted_eta = Column(String(64), nullable=True)
    extracted_availability = Column(String(32), nullable=True)
    transcript = Column(Text, nullable=True)
    raw_payload = Column(JSON, default=dict)
    created_at = Column(String(64), default=utcnow_iso)


class SolverRunModel(Base):
    __tablename__ = "solver_runs"

    run_id = Column(String(64), primary_key=True, index=True)
    incident_id = Column(String(64), index=True, nullable=False)
    formulation_hash = Column(String(64), nullable=False)
    variables_count = Column(Integer, default=12)
    constraints_count = Column(Integer, default=8)
    provider_backend = Column(String(64), default="QPIAI_QCLOUD")
    mode = Column(String(32), default="MOCK")  # MOCK, SIMULATOR, QPU, UNAVAILABLE
    shots = Column(Integer, default=1024)
    execution_time_ms = Column(Integer, default=342)
    feasible_count = Column(Integer, default=3)
    best_energy = Column(Float, default=-18400.0)
    qaoa_distribution = Column(JSON, default=dict)
    raw_metadata = Column(JSON, default=dict)
    created_at = Column(String(64), default=utcnow_iso)


class GoldLabelModel(Base):
    __tablename__ = "gold_labels"

    label_id = Column(String(64), primary_key=True, index=True)
    document_name = Column(String(128), nullable=False)
    text_snippet = Column(Text, nullable=False)
    has_blocker = Column(Boolean, default=False)
    blocker_type = Column(String(64), nullable=True)
    is_distractor = Column(Boolean, default=False)
    is_stale = Column(Boolean, default=False)
    expected_status = Column(String(32), default="NON_BLOCKING")  # NEEDS_VERIFICATION, HARD_BLOCKER, NON_BLOCKING
    ground_truth_quote = Column(Text, nullable=True)
    created_at = Column(String(64), default=utcnow_iso)


class VerificationTaskModel(Base):
    __tablename__ = "verification_tasks"

    task_id = Column(String(64), primary_key=True, index=True)
    incident_id = Column(String(64), ForeignKey("incidents.incident_id"), index=True, nullable=False)
    container_id = Column(String(32), index=True, nullable=False)
    blocker_code = Column(String(64), nullable=False)
    question = Column(Text, nullable=False)
    target_role = Column(String(64), default="DISPATCHER")  # DISPATCHER, CUSTOMS_BROKER, SHIPPING_LINE_AGENT, DRIVER
    target_contact = Column(String(64), nullable=True)
    status = Column(String(32), default="PENDING")  # PENDING, IN_PROGRESS, RESOLVED, ESCALATED
    evidence_tier = Column(String(16), default="T4")
    deadline = Column(String(64), nullable=False)
    assigned_owner = Column(String(64), default="DISPATCHER")
    resolved_claim = Column(Text, nullable=True)
    created_at = Column(String(64), default=utcnow_iso)
    updated_at = Column(String(64), default=utcnow_iso)


# =============================================================================
# v9 ResourceLock Models (Buttonless Cyber-Physical Asset Security)
# =============================================================================

class ResourceRegistryModel(Base):
    __tablename__ = "resource_registry"

    resource_id = Column(String(64), primary_key=True, index=True)
    resource_type = Column(String(64), nullable=False)  # CHASSIS_40FT, REEFER_GENSET, PRIME_MOVER, BAY_SLOT
    name = Column(String(128))
    tag_ref = Column(String(64), index=True, nullable=False)  # RFID Tag UID mapped to this resource
    status = Column(String(32), default="INSPECTED_AVAILABLE", index=True)
    # Statuses: RESERVED, CHECKED_OUT, RETURN_PENDING, INSPECTED_AVAILABLE, QUARANTINED, PENDING_RECONCILIATION
    current_holder_id = Column(String(64), nullable=True)
    current_lease_id = Column(String(64), nullable=True)
    version = Column(Integer, default=1, nullable=False)  # Version-aware atomic check-out counter
    location = Column(String(128), default="JNPA Pre-Gate Yard 01")
    specs = Column(JSON, default=dict)
    created_at = Column(String(64), default=utcnow_iso)
    updated_at = Column(String(64), default=utcnow_iso)


class OperatorSessionModel(Base):
    __tablename__ = "operator_sessions"

    session_id = Column(String(64), primary_key=True, index=True)
    user_id = Column(String(64), index=True, nullable=False)
    role = Column(String(32), default="OPS_MANAGER")  # OPS_MANAGER, DISPATCHER, CUSTODIAN
    auth_challenge = Column(String(64), nullable=False)  # Short-lived authorization challenge token
    challenge_expires_at = Column(String(64), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(String(64), default=utcnow_iso)


class ResourceWorkOrderModel(Base):
    __tablename__ = "resource_work_orders"

    work_order_id = Column(String(64), primary_key=True, index=True)
    incident_id = Column(String(64), nullable=True)
    plan_id = Column(String(64), nullable=True)
    plan_version = Column(Integer, default=1)
    resource_id = Column(String(64), ForeignKey("resource_registry.resource_id"), nullable=False)
    action_type = Column(String(32), default="CHECKOUT")  # CHECKOUT, RETURN, INSPECTION
    custodian_user_id = Column(String(64), nullable=False)
    target_device_id = Column(String(64), default="LIRA-EDGE-01")
    auth_challenge = Column(String(64), nullable=False)
    status = Column(String(32), default="PENDING_SCAN", index=True)
    # Status: DRAFT, PENDING_SCAN, TAG_OBSERVED, COMMITTED, REJECTED, CANCELLED
    observed_tag_ref = Column(String(64), nullable=True)
    scan_event_id = Column(String(64), nullable=True)
    scan_observed_at = Column(String(64), nullable=True)
    committed_at = Column(String(64), nullable=True)
    rejection_reason = Column(String(64), nullable=True)
    created_at = Column(String(64), default=utcnow_iso)
    updated_at = Column(String(64), default=utcnow_iso)


class ResourceLeaseModel(Base):
    __tablename__ = "resource_leases"

    lease_id = Column(String(64), primary_key=True, index=True)
    resource_id = Column(String(64), ForeignKey("resource_registry.resource_id"), nullable=False)
    work_order_id = Column(String(64), nullable=False)
    holder_user_id = Column(String(64), nullable=False)
    container_id = Column(String(32), nullable=True)
    status = Column(String(32), default="ACTIVE")  # ACTIVE, RETURNED, BREACHED, QUARANTINED
    checkout_at = Column(String(64), default=utcnow_iso)
    due_at = Column(String(64), nullable=False)
    returned_at = Column(String(64), nullable=True)


class ResourceInspectionModel(Base):
    __tablename__ = "resource_inspections"

    inspection_id = Column(String(64), primary_key=True, index=True)
    resource_id = Column(String(64), ForeignKey("resource_registry.resource_id"), nullable=False)
    inspector_id = Column(String(64), nullable=False)
    result = Column(String(32), default="PASSED")  # PASSED, FAILED_QUARANTINE, MAINTENANCE_REQUIRED
    notes = Column(Text, nullable=True)
    created_at = Column(String(64), default=utcnow_iso)


class ResourceTransactionModel(Base):
    __tablename__ = "resource_transactions"

    transaction_id = Column(String(64), primary_key=True, index=True)
    work_order_id = Column(String(64), nullable=False, index=True)
    resource_id = Column(String(64), nullable=False, index=True)
    event_type = Column(String(64), nullable=False)  # CHECKOUT_COMMITTED, CHECKOUT_REJECTED, QUARANTINED, RETURNED
    operator_user_id = Column(String(64), nullable=False)
    rule_code = Column(String(64), nullable=False)  # SUCCESS, TAG_MISMATCH, CHALLENGE_EXPIRED, DOUBLE_CHECKOUT_PREVENTED, QUARANTINE_LOCKED
    details = Column(JSON, default=dict)
    timestamp = Column(String(64), default=utcnow_iso)


class RiskSnapshotModel(Base):
    __tablename__ = "risk_snapshots"

    snapshot_id = Column(String(64), primary_key=True, index=True)
    incident_id = Column(String(64), nullable=True, index=True)
    provider = Column(String(32), nullable=False)  # OPENWEATHER, GOOGLE_ROUTES
    source_record_id = Column(String(64), nullable=True)
    origin = Column(String(32), default="LIVE_EXTERNAL")  # LIVE_EXTERNAL, LAB_FIXTURE
    location_corridor = Column(String(128), nullable=False)
    departure_time = Column(String(64), nullable=True)
    duration_seconds = Column(Integer, default=0)
    distance_meters = Column(Integer, default=0)
    predicted_arrival = Column(String(64), nullable=True)
    permitted_deadline = Column(String(64), nullable=True)
    risk_status = Column(String(32), default="ON_SCHEDULE")  # ON_SCHEDULE, AT_RISK, LIKELY_MISS, UNKNOWN
    confidence_score = Column(Float, default=1.0)
    severity = Column(String(32), default="LOW")  # LOW, MEDIUM, HIGH, CRITICAL
    certainty = Column(String(32), default="CONFIRMED")  # CONFIRMED, FORECAST, UNVERIFIED_CONSTRAINT
    raw_source_ref = Column(Text, nullable=False)
    is_stale = Column(Boolean, default=False)
    checked_at = Column(String(64), default=utcnow_iso)
    expires_at = Column(String(64), nullable=False)


class RAGChunkModel(Base):
    __tablename__ = "rag_document_chunks"

    chunk_id = Column(String(64), primary_key=True, index=True)
    document_id = Column(String(64), nullable=False, index=True)
    document_name = Column(String(128), nullable=False)
    tenant_id = Column(String(64), default="TENANT_JNPA", index=True)
    container_id = Column(String(32), nullable=True, index=True)
    source_type = Column(String(32), default="EMAIL")  # EMAIL, PDF, TARIFF, CARRIER_INSTRUCTION
    issuer = Column(String(64), default="JNPA_OPS")
    tier = Column(String(8), default="T2")  # T1, T2, T3, T4, T5
    start_char = Column(Integer, default=0)
    end_char = Column(Integer, default=0)
    chunk_text = Column(Text, nullable=False)
    chunk_hash = Column(String(64), nullable=False)
    metadata_json = Column(JSON, default=dict)
    created_at = Column(String(64), default=utcnow_iso)


class InvestigationRunModel(Base):
    __tablename__ = "investigation_runs"

    investigation_id = Column(String(64), primary_key=True, index=True)
    incident_id = Column(String(64), nullable=False, index=True)
    solver_mode = Column(String(32), default="QPIAI_OPT")  # QPIAI_OPT, CLASSICAL_BRANCH_AND_BOUND
    solver_run_id = Column(String(64), nullable=True)
    qubo_size = Column(Integer, default=4)
    status = Column(String(32), default="QPIAI_OPT_VALIDATED")  # QPIAI_OPT_VALIDATED, NO_FEASIBLE_PLAN, PROVIDER_UNAVAILABLE
    selected_action_ids = Column(JSON, default=list)
    why_this_check_first = Column(Text, nullable=False)
    classical_comparator = Column(JSON, default=dict)
    runtime_ms = Column(Integer, default=120)
    created_at = Column(String(64), default=utcnow_iso)


class EdgeScanRequestModel(Base):
    __tablename__ = "edge_scan_requests"

    request_id = Column(String(64), primary_key=True, index=True)
    device_id = Column(String(64), nullable=False, index=True)
    resource_id = Column(String(64), nullable=False, index=True)
    work_order_id = Column(String(64), nullable=True, index=True)
    investigation_id = Column(String(64), nullable=True)
    expected_tag_ref = Column(String(64), nullable=False)
    status = Column(String(32), default="PENDING")  # PENDING, SCAN_OBSERVED, COMMITTED, EXPIRED, REJECTED
    observed_tag_ref = Column(String(64), nullable=True)
    reason = Column(Text, nullable=False)
    expires_at = Column(String(64), nullable=False)
    created_at = Column(String(64), default=utcnow_iso)


class RobustnessScenarioModel(Base):
    __tablename__ = "robustness_scenarios"

    scenario_id = Column(String(64), primary_key=True, index=True)
    scenario_type = Column(String(32), nullable=False)  # VEHICLE_REFUSAL, WEATHER_DELAY, CHASSIS_QUARANTINE, SLOT_CONFLICT
    title = Column(String(128), nullable=False)
    description = Column(Text, nullable=False)
    worst_case_cost_inr = Column(Float, default=0.0)
    baseline_cost_inr = Column(Float, default=0.0)
    cost_regret_inr = Column(Float, default=0.0)
    alternative_plan_summary = Column(Text, nullable=False)
    adversarial_coverage_pct = Column(Float, default=95.0)
    status = Column(String(32), default="ANALYSIS_ONLY_LAB_SANDBOX")
    created_at = Column(String(64), default=utcnow_iso)


class InterchangeSessionModel(Base):
    __tablename__ = "interchange_sessions"

    session_id = Column(String(64), primary_key=True, index=True)
    site_id = Column(String(64), default="JNPT-BAY-04")
    truck_id = Column(String(64), nullable=True)
    truck_tag_ref = Column(String(64), nullable=True)
    equipment_id = Column(String(64), nullable=True)
    equipment_tag_ref = Column(String(64), nullable=True)
    container_no = Column(String(32), nullable=True)
    state = Column(String(32), default="NOT_STARTED", index=True)
    # NOT_STARTED, TRUCK_OBSERVED, EQUIPMENT_OBSERVED, MATCH_PREVIEW, HOLD, AWAITING_CUSTODIAN, COMMITTED, REJECTED, EXPIRED
    local_decision = Column(String(32), default="MATCH_PREVIEW")
    challenge_code = Column(String(32), nullable=True)
    challenge_expires_at = Column(Integer, nullable=True)
    txn_id = Column(String(64), nullable=True)
    eir_no = Column(String(64), nullable=True)
    eir_document_id = Column(String(64), nullable=True)
    branch_id_applied = Column(String(32), nullable=True)
    step1_at = Column(String(64), nullable=True)
    step2_at = Column(String(64), nullable=True)
    committed_at = Column(String(64), nullable=True)
    created_at = Column(String(64), default=utcnow_iso)
    updated_at = Column(String(64), default=utcnow_iso)


class EdgeNonceModel(Base):
    __tablename__ = "edge_nonces"

    device_id = Column(String(64), primary_key=True)
    nonce = Column(String(128), primary_key=True)
    created_at = Column(Integer, nullable=False)


class LiveIncidentStepModel(Base):
    __tablename__ = "live_incident_steps"

    id = Column(Integer, primary_key=True, autoincrement=True)
    incident_id = Column(String(64), index=True, nullable=False)
    step = Column(String(64), nullable=False)
    # Step names: CALL_RECEIVED, TRANSCRIPT_READY, CLAIM_EXTRACTED, BLOCKER_PROPOSED,
    # QPIAI_RESOLVE, VALIDATED, AWAITING_APPROVAL, APPROVED, DRIVER_NOTIFIED, STATION_UPDATED
    status = Column(String(32), default="PENDING")  # PENDING, IN_PROGRESS, COMPLETED, FAILED
    started_at = Column(String(64), nullable=True)
    ended_at = Column(String(64), nullable=True)
    ref_id = Column(String(128), nullable=True)
    detail_json = Column(JSON, default=dict)


class CopilotMessageModel(Base):
    __tablename__ = "copilot_messages"

    message_id = Column(String(64), primary_key=True, index=True)
    conversation_id = Column(String(64), index=True, nullable=False)
    role = Column(String(32), nullable=False)  # user, assistant, system
    content = Column(Text, nullable=False)
    tool_calls_json = Column(JSON, default=list)
    tool_results_json = Column(JSON, default=list)
    created_at = Column(String(64), default=utcnow_iso)





