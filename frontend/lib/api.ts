import {
  Incident,
  ExternalEvent,
  IngestJob,
  EdgeTFTState,
  SolverRunTelemetry,
  AuditEvent,
  PlanAlternative,
  RiskSummary,
  RAGClaim,
  RAGResponse,
  InvestigationAction,
  InvestigationResult,
  RobustnessSummary,
  FreightExceptionCaseSummary,
  FreightExceptionCaseDetail,
  RecalculationResult,
  DecisionModesMatrix
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1";

export async function fetchHealth(): Promise<{ status: string; mode: string; version: string }> {
  try {
    const res = await fetch(`${API_BASE}/health`, { cache: "no-store" });
    if (!res.ok) throw new Error("Health check failed");
    return await res.json();
  } catch (err) {
    return { status: "offline", mode: "MOCK", version: "v5" };
  }
}

export async function fetchIncidents(): Promise<Incident[]> {
  try {
    const res = await fetch(`${API_BASE}/incidents`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch incidents");
    return await res.json();
  } catch (err) {
    return [
      {
        incident_id: "INC-C102",
        container_id: "C102",
        title: "Clearance & Slot Exception for C102",
        severity: "HIGH",
        status: "OPEN",
        root_blocker_code: "T04_ETA_CONFLICT",
        owner_role: "DISPATCHER",
        action_deadline: "2026-10-28T18:30:00+05:30",
        projected_avoidable_cost_inr: 12000,
        do_nothing_cost_inr: 36000,
        has_hard_blocker: false,
        evidence_count: 2,
        updated_at: new Date().toISOString()
      },
      {
        incident_id: "INC-C105",
        container_id: "C105",
        title: "Classification Variance & BoE Amendment",
        severity: "CRITICAL",
        status: "NEEDS_VERIFICATION",
        root_blocker_code: "CUSTOMS_AMENDMENT_PENDING",
        owner_role: "CUSTOMS_BROKER",
        action_deadline: "2026-10-28T19:30:00+05:30",
        projected_avoidable_cost_inr: 28000,
        do_nothing_cost_inr: 48000,
        has_hard_blocker: true,
        evidence_count: 3,
        updated_at: new Date().toISOString()
      }
    ];
  }
}

export async function fetchIncidentDetail(incidentId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/incidents/${incidentId}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch incident detail");
  return await res.json();
}

export async function ingestDocument(formData: FormData): Promise<any> {
  const res = await fetch(`${API_BASE}/ingest/document`, {
    method: "POST",
    body: formData
  });
  if (!res.ok) throw new Error("Ingest failed");
  return await res.json();
}

export async function fetchIngestJob(jobId: string): Promise<IngestJob> {
  const res = await fetch(`${API_BASE}/ingest/jobs/${jobId}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Job not found");
  return await res.json();
}

export async function triggerQpiAISolve(incidentId: string, preferQuantum = true, wave = 1): Promise<any> {
  const res = await fetch(`${API_BASE}/incidents/${incidentId}/solve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prefer_quantum: preferQuantum, wave })
  });
  if (!res.ok) throw new Error("Solver trigger failed");
  return await res.json();
}

export async function fetchRecoveryAlternatives(incidentId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/recoveries/${incidentId}/alternatives`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch alternatives");
  return await res.json();
}

export async function approvePlan(planId: string, reason: string, managerRole = "DISPATCHER"): Promise<any> {
  const res = await fetch(`${API_BASE}/recoveries/${planId}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason, manager_role: managerRole })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || "Approval failed");
  }
  return await res.json();
}

export async function fetchEdgeState(deviceId = "LIRA-EDGE-01"): Promise<EdgeTFTState> {
  const res = await fetch(`${API_BASE}/edge/${deviceId}/state`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch edge state");
  return await res.json();
}

export async function simulateEdgeEvent(payload: any): Promise<any> {
  const res = await fetch(`${API_BASE}/edge/events?is_demo=true`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error("Edge event failed");
  return await res.json();
}

export async function fetchExternalEvents(): Promise<ExternalEvent[]> {
  const res = await fetch(`${API_BASE}/external/events`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch external events");
  return await res.json();
}

export async function simulateExternalDisruption(payload: any): Promise<any> {
  const res = await fetch(`${API_BASE}/external/events/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error("External event failed");
  return await res.json();
}

export async function fetchSolverRun(runId = "latest"): Promise<SolverRunTelemetry> {
  const res = await fetch(`${API_BASE}/qpiai/runs/${runId}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch solver run");
  return await res.json();
}

export async function fetchEvaluationMetrics(): Promise<any> {
  const res = await fetch(`${API_BASE}/evaluation/metrics`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch metrics");
  return await res.json();
}

export async function fetchReplayResults(): Promise<any> {
  const res = await fetch(`${API_BASE}/replay/results`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch replay");
  return await res.json();
}

export async function fetchAuditEvents(): Promise<AuditEvent[]> {
  const res = await fetch(`${API_BASE}/audit/events?limit=50`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch audit");
  const data = await res.json();
  return data.items || [];
}

export async function triggerVoiceCall(incidentId: string, truckId = "T04"): Promise<any> {
  const res = await fetch(`${API_BASE}/calls/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ incident_id: incidentId, truck_id: truckId })
  });
  if (!res.ok) throw new Error("Call start failed");
  return await res.json();
}

export async function fetchOverviewMetrics(): Promise<any> {
  const res = await fetch(`${API_BASE}/incidents/overview/metrics`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch overview metrics");
  return await res.json();
}

export async function fetchVerificationTasks(incidentId?: string): Promise<any[]> {
  const url = incidentId
    ? `${API_BASE}/verification/tasks?incident_id=${incidentId}`
    : `${API_BASE}/verification/tasks`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];
  return await res.json();
}

export async function resolveVerificationTask(taskId: string, payload: any): Promise<any> {
  const res = await fetch(`${API_BASE}/verification/tasks/${taskId}/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error("Failed to resolve task");
  return await res.json();
}

export async function simulateEdgeMismatch(deviceId = "LIRA-EDGE-01", rfidToken = "WRONG_TAG_99"): Promise<any> {
  const res = await fetch(`${API_BASE}/edge/simulate-mismatch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ device_id: deviceId, rfid_token: rfidToken })
  });
  if (!res.ok) throw new Error("Mismatch simulation failed");
  return await res.json();
}

export async function simulateEdgeNoShow(deviceId = "LIRA-EDGE-01", exceptionCode = "DRIVER_NO_SHOW"): Promise<any> {
  const res = await fetch(`${API_BASE}/edge/simulate-noshow`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ device_id: deviceId, exception_code: exceptionCode })
  });
  if (!res.ok) throw new Error("No-show simulation failed");
  return await res.json();
}

export async function simulateEdgeConfirm(deviceId = "LIRA-EDGE-01", rfidToken = "TAG_07"): Promise<any> {
  const res = await fetch(`${API_BASE}/edge/simulate-confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ device_id: deviceId, rfid_token: rfidToken })
  });
  if (!res.ok) throw new Error("Confirm simulation failed");
  return await res.json();
}

export async function fetchHuboFormulation(): Promise<any> {
  const res = await fetch(`${API_BASE}/qpiai/hubo/formulation`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch HUBO formulation");
  return await res.json();
}

export async function simulateEdgeClonedTag(deviceId = "LIRA-EDGE-01"): Promise<any> {
  const res = await fetch(`${API_BASE}/edge/simulate-cloned-tag`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ device_id: deviceId })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return err;
  }
  return await res.json();
}

export async function simulateStatutoryImmunity(containerId = "C102", reason = "YARD_STACK_DEPTH_DELAY"): Promise<any> {
  const res = await fetch(`${API_BASE}/edge/simulate-statutory-immunity?container_id=${containerId}&disruption_reason=${reason}`, {
    method: "POST"
  });
  if (!res.ok) throw new Error("Statutory immunity simulation failed");
  return await res.json();
}

// =============================================================================
// v9 Buttonless ResourceLock & Decision Capsule APIs
// =============================================================================

export async function fetchResources(type?: string, status?: string): Promise<any[]> {
  const params = new URLSearchParams();
  if (type) params.set("resource_type", type);
  if (status) params.set("status", status);
  const res = await fetch(`${API_BASE}/resources?${params.toString()}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch resources");
  return await res.json();
}

export async function fetchResourceWorkOrders(status?: string): Promise<any[]> {
  const url = status ? `${API_BASE}/resource-work-orders?status=${status}` : `${API_BASE}/resource-work-orders`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch resource work orders");
  return await res.json();
}

export async function createResourceWorkOrder(payload: {
  resource_id: string;
  incident_id?: string;
  plan_id?: string;
  plan_version?: number;
  action_type?: string;
  custodian_user_id?: string;
  target_device_id?: string;
}): Promise<any> {
  const res = await fetch(`${API_BASE}/resource-work-orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to create resource work order");
  }
  return await res.json();
}

export async function commitResourceWorkOrder(
  workOrderId: string,
  payload: { auth_challenge: string; operator_user_id: string; notes?: string }
): Promise<any> {
  const res = await fetch(`${API_BASE}/resource-work-orders/${workOrderId}/commit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Atomic checkout commitment failed");
  }
  return await res.json();
}

export async function quarantineResourceWorkOrder(
  workOrderId: string,
  payload: { defect_notes: string; inspector_id: string }
): Promise<any> {
  const res = await fetch(`${API_BASE}/resource-work-orders/${workOrderId}/inspect-quarantine`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Resource quarantine action failed");
  }
  return await res.json();
}

export async function fetchDecisionCapsule(deviceId = "LIRA-EDGE-01"): Promise<any> {
  const res = await fetch(`${API_BASE}/edge/${deviceId}/decision-capsule`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch decision capsule");
  return await res.json();
}

// =============================================================================
// v10 Weather/Traffic Risk, Document RAG, Investigation Director & Robustness
// =============================================================================

export async function fetchRiskSummary(corridor = "NH-348 Panvel-JNPA Expressway"): Promise<any> {
  const res = await fetch(`${API_BASE}/risks/summary?corridor=${encodeURIComponent(corridor)}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch corridor risk summary");
  return await res.json();
}

export async function fetchIncidentRisk(incidentId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/risks/${incidentId}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch incident risk profile");
  return await res.json();
}

export async function queryEvidenceAssistant(query: string, containerId = "C102", tenantId = "TENANT_JNPA"): Promise<any> {
  const res = await fetch(`${API_BASE}/evidence/assistant/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, container_id: containerId, tenant_id: tenantId })
  });
  if (!res.ok) throw new Error("Evidence assistant query failed");
  return await res.json();
}

export async function fetchInvestigationActions(): Promise<any> {
  const res = await fetch(`${API_BASE}/investigations/actions`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch candidate investigation actions");
  return await res.json();
}

export async function runInvestigationOptimizer(incidentId = "INC-C102", deviceId = "LIRA-EDGE-01", budgetK = 2): Promise<any> {
  const res = await fetch(`${API_BASE}/investigations/optimize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ incident_id: incidentId, device_id: deviceId, budget_k: budgetK })
  });
  if (!res.ok) throw new Error("Failed to optimize investigation tasks");
  return await res.json();
}

export async function fetchRobustnessScenarios(): Promise<RobustnessSummary> {
  const res = await fetch(`${API_BASE}/robustness/scenarios`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch robustness scenarios");
  return await res.json();
}

export async function fetchCases(): Promise<{ cases: FreightExceptionCaseSummary[]; count: number }> {
  const res = await fetch(`${API_BASE}/cases`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch cases");
  return await res.json();
}

export async function fetchCaseDetail(caseId: string): Promise<FreightExceptionCaseDetail> {
  const res = await fetch(`${API_BASE}/cases/${caseId}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch case ${caseId}`);
  return await res.json();
}

export async function recalculateCase(
  caseId: string,
  delayMinutes: number,
  rateMultiplier: number
): Promise<RecalculationResult> {
  const res = await fetch(`${API_BASE}/cases/${caseId}/recalculate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ delay_minutes: delayMinutes, rate_multiplier: rateMultiplier })
  });
  if (!res.ok) throw new Error(`Failed to recalculate case ${caseId}`);
  return await res.json();
}

export async function fetchDecisionModes(): Promise<DecisionModesMatrix> {
  const res = await fetch(`${API_BASE}/qpiai/decision-modes`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch decision modes");
  return await res.json();
}

export async function triggerQ4Exchange(): Promise<any> {
  const res = await fetch(`${API_BASE}/qpiai/modes/q4-exchange`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to execute Q4 Exchange");
  return await res.json();
}

export async function triggerQ5Horizon(horizonHours: number = 48): Promise<any> {
  const res = await fetch(`${API_BASE}/qpiai/modes/q5-horizon?horizon_hours=${horizonHours}`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to execute Q5 Horizon");
  return await res.json();
}

export async function triggerQ6QCloud(): Promise<any> {
  const res = await fetch(`${API_BASE}/qpiai/modes/q6-qcloud`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to execute Q6 QCloud Experiment");
  return await res.json();
}

export async function startBolnaVerificationCall(
  incidentId: string,
  truckId: string,
  phoneNumber: string,
  recipientName: string,
  purposeQuestion?: string,
  consentReference?: string
): Promise<any> {
  const res = await fetch(`${API_BASE}/calls/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      incident_id: incidentId,
      truck_id: truckId,
      phone_number: phoneNumber,
      recipient_name: recipientName,
      purpose_question: purposeQuestion,
      consent_reference: consentReference
    })
  });
  if (!res.ok) throw new Error("Failed to trigger Bolna call");
  return await res.json();
}

export async function fetchDemoHealth(): Promise<any> {
  const res = await fetch(`${API_BASE}/demo/health`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch demo health");
  return await res.json();
}

export async function callDriverOutbound(params: {
  phone_number: string;
  consent_given: boolean;
  driver_id?: string;
  container_no?: string;
  slot?: string;
  language?: string;
}): Promise<any> {
  const res = await fetch(`${API_BASE}/demo/call-driver`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params)
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `Call failed (${res.status})`);
  }
  return await res.json();
}

export async function sendVoiceNote(formData: FormData): Promise<any> {
  const res = await fetch(`${API_BASE}/demo/voice-note`, {
    method: "POST",
    body: formData
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `Voice note upload failed (${res.status})`);
  }
  return await res.json();
}

export async function simulateDriverCall(params?: {
  answer?: string;
  driver_id?: string;
  container_no?: string;
  slot?: string;
  phone_number?: string;
  transcript?: string;
  language?: string;
  delay_reason?: string;
  reported_delay_minutes?: number;
}): Promise<any> {
  const res = await fetch(`${API_BASE}/demo/simulate-driver-call`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params || {})
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `Simulated call failed (${res.status})`);
  }
  return await res.json();
}

export async function approveLiveIncident(pipelineId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/demo/live-incident/${pipelineId}/approve`, {
    method: "POST"
  });
  if (!res.ok) throw new Error("Failed to approve live incident plan");
  return await res.json();
}

export async function fetchLiveIncidentSteps(pipelineId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/demo/live-incident/${pipelineId}/steps`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch live incident steps");
  return await res.json();
}

export async function resetDemoState(): Promise<any> {
  const res = await fetch(`${API_BASE}/demo/reset-state`, {
    method: "POST"
  });
  if (!res.ok) throw new Error("Failed to reset demo state");
  return await res.json();
}

export async function askCopilot(prompt: string, sessionId?: string): Promise<any> {
  const res = await fetch(`${API_BASE}/copilot/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, session_id: sessionId })
  });
  if (!res.ok) throw new Error("Copilot ask failed");
  return await res.json();
}

export async function fetchCopilotHistory(sessionId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/copilot/history/${sessionId}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch copilot history");
  return await res.json();
}

export async function createStressSession(basePlanId: string = "PLAN-R2"): Promise<any> {
  const res = await fetch(`${API_BASE}/stress/session?base_plan_id=${basePlanId}`, {
    method: "POST"
  });
  if (!res.ok) throw new Error("Failed to create stress session");
  return await res.json();
}

export async function perturbStressSession(sessionId: string, perturbations: string[]): Promise<any> {
  const res = await fetch(`${API_BASE}/stress/${sessionId}/perturb`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ perturbations })
  });
  if (!res.ok) throw new Error("Perturbation failed");
  return await res.json();
}

export async function promoteStressPlan(sessionId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/stress/${sessionId}/promote`, {
    method: "POST"
  });
  if (!res.ok) throw new Error("Plan promotion failed");
  return await res.json();
}

export async function runRaceBenchmark(problemSize: number = 8, shots: number = 256, alpha: number = 0.5): Promise<any> {
  const res = await fetch(`${API_BASE}/race/run?problem_size=${problemSize}&shots=${shots}&alpha=${alpha}`, {
    method: "POST"
  });
  if (!res.ok) throw new Error("Race benchmark failed");
  return await res.json();
}

export async function fetchRaceScalingSweep(): Promise<any> {
  const res = await fetch(`${API_BASE}/race/scaling-sweep`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch race scaling sweep");
  return await res.json();
}

export async function fetchTomorrowForecast(): Promise<any> {
  const res = await fetch(`${API_BASE}/forecast/tomorrow`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch forecast");
  return await res.json();
}

export async function bookForecastReserve(params?: {
  slot_id?: string;
  buffer_slots?: number;
  justification?: string;
}): Promise<any> {
  const res = await fetch(`${API_BASE}/forecast/reserve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params || {})
  });
  if (!res.ok) throw new Error("Failed to book forecast reserve");
  return await res.json();
}

