export interface Incident {
  incident_id: string;
  container_id: string;
  title: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  status: "OPEN" | "NEEDS_VERIFICATION" | "SOLVING" | "RESOLVED" | "CANCELLED";
  root_blocker_code: string;
  owner_role: string;
  action_deadline: string;
  projected_avoidable_cost_inr: number;
  do_nothing_cost_inr: number;
  has_hard_blocker?: boolean;
  evidence_count?: number;
  updated_at: string;
}

export interface BlockerNode {
  node_id: string;
  incident_id: string;
  container_id: string;
  code: string;
  claim: string;
  quote?: string;
  start_char: number;
  end_char: number;
  authority_tier: "T1" | "T2" | "T3";
  status: "NEEDS_VERIFICATION" | "HARD_BLOCKER" | "CLEARED";
  responsible_role: string;
  evidence_id?: string;
}

export interface DependencyEdge {
  edge_id: string;
  incident_id: string;
  source_node_id: string;
  target_node_id: string;
  relationship_type: string;
}

export interface PlanAlternative {
  plan_id: string;
  plan_code: "PLAN-A" | "PLAN-B" | "PLAN-C" | "PLAN-R1" | "PLAN-R2" | string;
  status: string;
  solver_source: string;
  truck_id: string;
  slot_id: string;
  slot_start: string;
  slot_end: string;
  checkpoint_id: string;
  avoidable_cost_inr: number;
  net_cost_inr: number;
  feasibility_score: number;
  feasible: boolean;
  constraint_violations: string[];
  strategy_summary: string;
}

export interface EdgeTFTState {
  device_id: string;
  online: boolean;
  hardware_profile?: string;
  checkpoint_label?: string;
  screen_view?: string;
  display_header?: string;
  display_lines?: string[];
  prompt_tag?: boolean;
  tag_observed?: boolean;
  awaiting_web_confirmation?: boolean;
  active_work_order_id?: string | null;
  assignment_id: string | null;
  container_id: string | null;
  truck_id: string | null;
  slot_start: string | null;
  free_time_deadline: string | null;
  approval_state: string;
  customs_release: string;
  physical_state: "EXPECTED" | "RFID_MISMATCH" | "BAY_ABSENT_WARNING" | "PHYSICAL_NO_SHOW" | "STAGING_EVIDENCED" | "TAG_MISMATCH" | "CLONED_TAG_CRYPTO_REJECTED" | "TAG_OBSERVED";
  risk_label: string;
  risk_reason: string;
  qpiai_state: string;
  run_id_suffix?: string;
  last_event_at: string | null;
  decision_capsule_status?: string;
  edge_qaoa_policy_table?: any[];
  eeprom_sector4_preview?: string;
  rolling_ratchet_expected?: number;
  touch_signature_expected?: string;
  mean_z_pressure_norm?: number;
  qr_custody_token?: string;
  hardware_proof_of_readiness?: boolean;
  slot_swap_arbitrage_active?: boolean;
  rebate_awarded_c208_inr?: number;
}

export interface ResourceItem {
  resource_id: string;
  resource_type: string;
  name: string;
  tag_ref: string;
  status: "INSPECTED_AVAILABLE" | "RESERVED" | "CHECKED_OUT" | "RETURN_PENDING" | "QUARANTINED" | "PENDING_RECONCILIATION" | string;
  current_holder_id?: string | null;
  current_lease_id?: string | null;
  version: number;
  location: string;
  specs: Record<string, any>;
  updated_at: string;
}

export interface ResourceWorkOrder {
  work_order_id: string;
  incident_id?: string | null;
  plan_id?: string | null;
  plan_version: number;
  resource_id: string;
  resource_name?: string;
  action_type: "CHECKOUT" | "RETURN" | "INSPECTION" | string;
  custodian_user_id: string;
  target_device_id: string;
  auth_challenge: string;
  status: "PENDING_SCAN" | "TAG_OBSERVED" | "COMMITTED" | "REJECTED" | "CANCELLED" | string;
  observed_tag_ref?: string | null;
  scan_observed_at?: string | null;
  committed_at?: string | null;
  rejection_reason?: string | null;
  created_at: string;
}

export interface DecisionCapsule {
  snapshot_hash: string;
  plan_version: number;
  solver_run_id: string;
  provider: string;
  source_origin: string;
  capsule_status: string;
  shortlist_candidates: any[];
  exclusion_reasons: Record<string, string>;
  modeled_cost_baseline_inr: number;
  modeled_cost_optimal_inr: number;
  expires_at: string;
  validator_proof_hash: string;
  signature: string;
  created_at: string;
}

export interface SolverRunTelemetry {
  run_id: string;
  incident_id: string;
  formulation_hash: string;
  variables_count: number;
  constraints_count: number;
  provider_backend: string;
  mode: "MOCK" | "SIMULATOR" | "QPU" | "LOCAL_SIMULATOR" | "CLOUD_SIMULATOR" | "UNAVAILABLE";
  shots: number;
  execution_time_ms: number;
  feasible_count: number;
  best_energy: number;
  qaoa_distribution: Record<string, number>;
  raw_metadata: Record<string, any>;
  created_at: string;
}

export interface ExternalEvent {
  event_id: string;
  type: string;
  trust_state: "FORECAST_RISK" | "CONFIRMED_DISRUPTION" | "CANCELLED";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  title: string;
  source_label: string;
  geography: string;
  starts_at: string;
  ends_at: string;
  affected_trucks: string[];
  affected_slots: string[];
  is_simulated: boolean;
  updated_at: string;
}

export interface IngestJob {
  job_id: string;
  container_id?: string;
  status: string;
  raw_source_text: string;
  candidate_blockers: Array<{
    type: string;
    claim: string;
    source_id: string;
    quote: string;
    start_char: number;
    end_char: number;
    confidence: number;
    authority_tier: string;
    status: string;
    responsible_role: string;
  }>;
  validation_errors: string[];
  created_at: string;
}

export interface AuditEvent {
  audit_id: string;
  correlation_id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  actor: string;
  description: string;
  details: Record<string, any>;
  timestamp: string;
}

export interface RiskSummary {
  status: string;
  corridor: string;
  overall_status: "ON_SCHEDULE" | "AT_RISK" | "LIKELY_MISS" | string;
  weather: {
    provider: string;
    origin: string;
    location: string;
    condition: string;
    temperature_c: number;
    humidity_pct: number;
    wind_speed_mps: number;
    rain_1h_mm?: number;
    forecast_summary: string;
    is_disruption_risk: boolean;
    suggested_severity: string;
    port_operations_impact: string;
    statutory_closure_note: string;
    checked_at: string;
  };
  traffic: {
    provider: string;
    origin: string;
    corridor: string;
    distance_km: number;
    duration_traffic_mins: number;
    static_duration_mins: number;
    congestion_delay_mins: number;
    traffic_severity: string;
    truck_routing_disclaimer: string;
    road_closure_disclaimer: string;
    checked_at: string;
  };
  disclaimers: string[];
}

export interface RAGClaim {
  document_id: string;
  document_name: string;
  issuer: string;
  authority_tier: string;
  quote: string;
  start_char: number;
  end_char: number;
  relevance_score: number;
  claim_status: string;
}

export interface RAGResponse {
  status: string;
  query: string;
  container_id?: string;
  answer: string;
  grounded_claims: RAGClaim[];
  contradictions_detected: boolean;
  conflict_notes?: string[];
  is_sufficient: boolean;
  suggested_verification_task?: {
    question: string;
    target_authority: string;
    container_id: string;
  };
  prompt_injection_prevented?: boolean;
  tenant_isolation_enforced?: boolean;
}

export interface InvestigationAction {
  action_id: string;
  title: string;
  target_resource?: string;
  target_tag?: string | null;
  blocker_code: string;
  responsible_role: string;
  time_minutes: number;
  cost_inr: number;
  information_value: number;
  deadline: string;
  downstream_impact: string;
}

export interface InvestigationResult {
  investigation_id: string;
  incident_id: string;
  solver_mode: string;
  status: string;
  selected_action_ids: string[];
  selected_actions_details: InvestigationAction[];
  why_this_check_first: string;
  classical_comparator: Record<string, any>;
  edge_scan_request?: {
    request_id: string;
    device_id: string;
    target_resource: string;
    expected_tag: string;
    status: string;
    instruction: string;
  } | null;
  runtime_ms: number;
  created_at: string;
}

export interface RobustnessScenario {
  scenario_id: string;
  scenario_type: string;
  title: string;
  description: string;
  worst_case_cost_inr: number;
  baseline_cost_inr: number;
  cost_regret_inr: number;
  alternative_plan_summary: string;
  adversarial_coverage_pct: number;
  status: string;
}

export interface RobustnessSummary {
  status: string;
  spec_version: string;
  description: string;
  manager_approval_required: boolean;
  metrics: {
    scenarios_evaluated: number;
    total_worst_case_cost_inr: number;
    total_baseline_cost_inr: number;
    total_avoided_exposure_inr: number;
    mean_adversarial_coverage_pct: number;
    classical_comparator: string;
  };
  scenarios: RobustnessScenario[];
}

export interface FreightExceptionCaseSummary {
  case_id: string;
  container_id: string;
  bl_number: string;
  case_family: string;
  title: string;
  root_blocker_code: string;
  blocker_status: string;
  jurisdiction: string;
  owner_role: string;
  sla_countdown: string;
  avoidable_cost_inr: number;
  tariff_basis: string;
}

export interface FreightExceptionCaseDetail {
  case_id: string;
  container_id: string;
  bl_number: string;
  case_family: string;
  title: string;
  root_blocker_code: string;
  blocker_status: string;
  jurisdiction: string;
  owner_role: string;
  sla_countdown: string;
  action_deadline: string;
  evidence_document: {
    document_id: string;
    document_name: string;
    issuer: string;
    authority_tier: string;
    quote: string;
    start_char: number;
    end_char: number;
  };
  verification_task: {
    task_type: string;
    target: string;
    question: string;
  };
  candidate_bundles: Array<{
    bundle_id: string;
    truck_id: string;
    slot_id: string;
    resource_id: string;
    modeled_cost_inr: number;
    is_feasible: boolean;
    rejection_reason?: string | null;
  }>;
  cost_waterfall: {
    do_nothing_baseline_inr: number;
    demurrage_accrual_inr: number;
    yard_storage_inr: number;
    recovery_plan_cost_inr: number;
    avoidable_cost_inr: number;
    tariff_basis: string;
  };
  statutory_posture: string;
}

export interface RecalculationResult {
  case_id: string;
  container_id: string;
  simulated_delay_minutes: number;
  rate_multiplier: number;
  compounded_baseline_inr: number;
  recovery_plan_cost_inr: number;
  avoidable_savings_inr: number;
  origin: string;
  disclaimer: string;
}

export interface DecisionModeItem {
  mode_id: string;
  name: string;
  subsystem: string;
  objective: string;
  variables: string;
  formulation: string;
  provider: string;
  status: string;
  classical_gap_percent: number;
  route_path: string;
}

export interface DecisionModesMatrix {
  decision_modes: DecisionModeItem[];
  quantum_classical_comparator: {
    classical_solver: string;
    optimality_gap: string;
    validation_verdict: string;
    statutory_compliance: string;
  };
  timestamp: string;
}



