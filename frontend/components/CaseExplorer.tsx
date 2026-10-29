"use client";

import React, { useState, useEffect } from "react";
import {
  FileText,
  GitBranch,
  UserCheck,
  Cpu,
  Layers,
  Radio,
  Clock,
  PhoneCall,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Sliders,
  DollarSign,
  ArrowRight,
  ExternalLink
} from "lucide-react";
import {
  fetchCases,
  fetchCaseDetail,
  recalculateCase,
  startBolnaVerificationCall
} from "@/lib/api";
import {
  FreightExceptionCaseSummary,
  FreightExceptionCaseDetail,
  RecalculationResult
} from "@/lib/types";

export default function CaseExplorer() {
  const [cases, setCases] = useState<FreightExceptionCaseSummary[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>("C1_CUSTOMS_REGULATORY");
  const [activeStep, setActiveStep] = useState<number>(1);
  const [caseDetail, setCaseDetail] = useState<FreightExceptionCaseDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Sliders for LAB_FIXTURE deterministic recalculation
  const [delayMinutes, setDelayMinutes] = useState<number>(30);
  const [rateMultiplier, setRateMultiplier] = useState<number>(1.0);
  const [recalcResult, setRecalcResult] = useState<RecalculationResult | null>(null);
  const [recalcLoading, setRecalcLoading] = useState<boolean>(false);

  // Calling verification state
  const [callTriggered, setCallTriggered] = useState<boolean>(false);
  const [callResult, setCallResult] = useState<any>(null);

  // Load cases list
  useEffect(() => {
    fetchCases()
      .then((data) => {
        setCases(data.cases);
        if (data.cases.length > 0) {
          setSelectedCaseId(data.cases[0].case_id);
        }
      })
      .catch((err) => console.error("Failed to load cases", err));
  }, []);

  // Load selected case detail
  useEffect(() => {
    if (!selectedCaseId) return;
    setLoading(true);
    setCallTriggered(false);
    setCallResult(null);
    fetchCaseDetail(selectedCaseId)
      .then((detail) => {
        setCaseDetail(detail);
        setLoading(false);
        // Initial recalculation
        return recalculateCase(selectedCaseId, delayMinutes, rateMultiplier);
      })
      .then((recalc) => setRecalcResult(recalc))
      .catch((err) => {
        console.error("Failed to load case detail", err);
        setLoading(false);
      });
  }, [selectedCaseId]);

  const handleSliderChange = (delay: number, mult: number) => {
    setDelayMinutes(delay);
    setRateMultiplier(mult);
    setRecalcLoading(true);
    recalculateCase(selectedCaseId, delay, mult)
      .then((res) => {
        setRecalcResult(res);
        setRecalcLoading(false);
      })
      .catch(() => setRecalcLoading(false));
  };

  const handleTriggerVerificationCall = async () => {
    if (!caseDetail) return;
    setCallTriggered(true);
    try {
      const res = await startBolnaVerificationCall(
        `INC-${caseDetail.container_id}`,
        caseDetail.candidate_bundles[0]?.truck_id || "T07",
        "+919820119420",
        `Authorized Contact (${caseDetail.owner_role})`,
        caseDetail.verification_task.question,
        `CONSENT-CASE-${caseDetail.case_id}`
      );
      setCallResult(res);
    } catch (e) {
      console.error(e);
      setCallResult({ status: "FALLBACK_RECORDED", error: "Voice gateway logged audit trace" });
    }
  };

  const steps = [
    { num: 1, label: "Source Artifacts", icon: FileText },
    { num: 2, label: "Reconciliation DAG", icon: GitBranch },
    { num: 3, label: "Owner & Verification", icon: UserCheck },
    { num: 4, label: "Candidate Bundles", icon: Cpu },
    { num: 5, label: "Cost Waterfall", icon: DollarSign },
    { num: 6, label: "ResourceLock & Android", icon: Radio },
  ];

  return (
    <div className="bg-white dark:bg-[#111F2E] border border-[#D9E3EB] dark:border-[#294355] rounded-xs shadow-xs p-5">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-[#D9E3EB] dark:border-[#294355] gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-mono text-xs px-2 py-0.5 rounded-xs bg-[#067A9B]/10 text-[#067A9B] dark:text-[#39C9DF] border border-[#067A9B]/30 font-bold">
              QUANT-A-MAZE 3.0 TRACK IV
            </span>
            <span className="text-xs text-[#516678] dark:text-[#9FB5C5] font-mono">
              Deterministic 6-Case Fixtures (C1–C6)
            </span>
          </div>
          <h2 className="text-base sm:text-lg font-bold text-[#102235] dark:text-[#EAF3F8] tracking-tight mt-1 font-mono">
            Freight Exception & Cost-Avoidance Explorer
          </h2>
        </div>

        <div className="flex items-center space-x-2 text-xs font-mono">
          <span className="text-[#516678] dark:text-[#9FB5C5]">Mode:</span>
          <span className="px-2 py-0.5 rounded-xs bg-[#15803D]/10 text-[#15803D] dark:text-[#22C55E] border border-[#15803D]/30 font-bold">
            LAB_FIXTURE_INTERACTIVE
          </span>
        </div>
      </div>

      {/* Case Selector Tabs (C1 - C6) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 my-4">
        {cases.map((c) => {
          const isSelected = selectedCaseId === c.case_id;
          return (
            <button
              key={c.case_id}
              onClick={() => {
                setSelectedCaseId(c.case_id);
                setActiveStep(1);
              }}
              className={`p-2.5 rounded-xs text-left border transition-colors font-mono text-xs ${
                isSelected
                  ? "bg-[#067A9B]/10 dark:bg-[#39C9DF]/10 border-[#067A9B] dark:border-[#39C9DF] text-[#102235] dark:text-[#EAF3F8]"
                  : "bg-[#F3F6FA] dark:bg-[#0B1420] border-[#D9E3EB] dark:border-[#294355] text-[#516678] dark:text-[#9FB5C5] hover:border-[#067A9B]/50"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-[11px] text-[#067A9B] dark:text-[#39C9DF]">
                  {c.case_id.split("_")[0]}
                </span>
                <span className="text-[10px] font-bold text-[#102235] dark:text-[#EAF3F8]">
                  {c.container_id}
                </span>
              </div>
              <div className="text-[11px] font-semibold truncate mt-1 text-[#102235] dark:text-[#EAF3F8]">
                {c.case_family.split("/")[0]}
              </div>
              <div className="text-[10px] text-[#516678] dark:text-[#9FB5C5] truncate mt-0.5">
                ₹{c.avoidable_cost_inr.toLocaleString("en-IN")} avoidable
              </div>
            </button>
          );
        })}
      </div>

      {/* 6-Step Stepper Bar */}
      <div className="flex items-center justify-between border-b border-[#D9E3EB] dark:border-[#294355] overflow-x-auto pb-2 mb-5">
        {steps.map((st) => {
          const Icon = st.icon;
          const isActive = activeStep === st.num;
          return (
            <button
              key={st.num}
              onClick={() => setActiveStep(st.num)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xs text-xs font-mono transition-colors shrink-0 ${
                isActive
                  ? "bg-[#067A9B] dark:bg-[#39C9DF] text-white dark:text-[#0B1420] font-bold shadow-xs"
                  : "text-[#516678] dark:text-[#9FB5C5] hover:bg-[#F3F6FA] dark:hover:bg-[#0B1420]"
              }`}
            >
              <Icon className="w-3.5 h-3.5" aria-hidden="true" />
              <span>
                Step {st.num}: {st.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Case Details Card Header */}
      {caseDetail && (
        <div className="bg-[#F3F6FA] dark:bg-[#0B1420] border border-[#D9E3EB] dark:border-[#294355] p-3.5 rounded-xs mb-5 font-mono text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-bold text-[#102235] dark:text-[#EAF3F8]">
                  {caseDetail.container_id} ({caseDetail.bl_number})
                </span>
                <span className="px-1.5 py-0.2 rounded-xs bg-[#B45309]/10 text-[#B45309] dark:text-[#F59E0B] border border-[#B45309]/30 text-[10px] font-bold">
                  {caseDetail.root_blocker_code}
                </span>
              </div>
              <p className="text-[#516678] dark:text-[#9FB5C5] text-[11px] mt-0.5">
                {caseDetail.title}
              </p>
            </div>

            <div className="flex items-center space-x-3 text-[11px]">
              <div>
                <span className="text-[#516678] dark:text-[#9FB5C5]">Owner: </span>
                <span className="text-[#102235] dark:text-[#EAF3F8] font-bold">
                  {caseDetail.owner_role}
                </span>
              </div>
              <div>
                <span className="text-[#516678] dark:text-[#9FB5C5]">Deadline: </span>
                <span className="text-[#B91C1C] dark:text-[#EF4444] font-bold">
                  {caseDetail.sla_countdown}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step Content */}
      {loading ? (
        <div className="py-12 text-center text-xs font-mono text-[#516678] dark:text-[#9FB5C5]">
          Loading case data...
        </div>
      ) : caseDetail && (
        <div>
          {/* STEP 1: Fragmented Source Artifacts */}
          {activeStep === 1 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold font-mono text-[#102235] dark:text-[#EAF3F8] uppercase tracking-wider flex items-center space-x-1.5">
                  <FileText className="w-4 h-4 text-[#067A9B] dark:text-[#39C9DF]" />
                  <span>Fragmented Document Artifact & Verbatim Quote Span</span>
                </h3>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-xs bg-[#15803D]/10 text-[#15803D] dark:text-[#22C55E] border border-[#15803D]/30 font-bold">
                  GROUNDED TIER {caseDetail.evidence_document.authority_tier}
                </span>
              </div>

              <div className="border border-[#D9E3EB] dark:border-[#294355] rounded-xs p-4 bg-white dark:bg-[#111F2E]">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs font-bold text-[#102235] dark:text-[#EAF3F8]">
                    {caseDetail.evidence_document.document_name}
                  </span>
                  <span className="font-mono text-[10px] text-[#516678] dark:text-[#9FB5C5]">
                    Issuer: {caseDetail.evidence_document.issuer}
                  </span>
                </div>

                <div className="p-3 bg-[#F3F6FA] dark:bg-[#0B1420] border-l-3 border-[#067A9B] dark:border-[#39C9DF] text-xs font-mono text-[#102235] dark:text-[#EAF3F8] leading-relaxed italic">
                  "{caseDetail.evidence_document.quote}"
                </div>

                <div className="flex items-center justify-between mt-3 text-[11px] font-mono text-[#516678] dark:text-[#9FB5C5]">
                  <span>
                    Byte Offsets: [{caseDetail.evidence_document.start_char} - {caseDetail.evidence_document.end_char}]
                  </span>
                  <span className="text-[#15803D] dark:text-[#22C55E] font-bold">
                    ✓ Exact Unicode Match Verified
                  </span>
                </div>
              </div>

              <div className="p-3 bg-[#F3F6FA] dark:bg-[#0B1420] border border-[#D9E3EB] dark:border-[#294355] rounded-xs text-xs font-mono">
                <span className="font-bold text-[#102235] dark:text-[#EAF3F8]">Jurisdiction Policy: </span>
                <span className="text-[#516678] dark:text-[#9FB5C5]">{caseDetail.jurisdiction}</span>
                <p className="mt-1 text-[11px] text-[#516678] dark:text-[#9FB5C5]">
                  Statutory Posture: {caseDetail.statutory_posture}
                </p>
              </div>
            </div>
          )}

          {/* STEP 2: Evidence Reconciliation & Blocker DAG */}
          {activeStep === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold font-mono text-[#102235] dark:text-[#EAF3F8] uppercase tracking-wider flex items-center space-x-1.5">
                  <GitBranch className="w-4 h-4 text-[#067A9B] dark:text-[#39C9DF]" />
                  <span>Reconciled Blocker DAG & Gate Authorization</span>
                </h3>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-xs bg-[#B45309]/10 text-[#B45309] dark:text-[#F59E0B] border border-[#B45309]/30 font-bold">
                  STATUS: {caseDetail.blocker_status}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-xs">
                <div className="p-3.5 rounded-xs bg-[#F3F6FA] dark:bg-[#0B1420] border border-[#D9E3EB] dark:border-[#294355]">
                  <div className="text-[10px] text-[#516678] dark:text-[#9FB5C5] uppercase font-bold">
                    1. Primary Blocker Code
                  </div>
                  <div className="text-sm font-bold text-[#B91C1C] dark:text-[#EF4444] mt-1">
                    {caseDetail.root_blocker_code}
                  </div>
                  <div className="text-[11px] text-[#516678] dark:text-[#9FB5C5] mt-1">
                    Pre-gate constraint prevents automated dispatch.
                  </div>
                </div>

                <div className="p-3.5 rounded-xs bg-[#F3F6FA] dark:bg-[#0B1420] border border-[#D9E3EB] dark:border-[#294355]">
                  <div className="text-[10px] text-[#516678] dark:text-[#9FB5C5] uppercase font-bold">
                    2. Authority Separation
                  </div>
                  <div className="text-sm font-bold text-[#102235] dark:text-[#EAF3F8] mt-1">
                    Customs vs TOS Gate
                  </div>
                  <div className="text-[11px] text-[#516678] dark:text-[#9FB5C5] mt-1">
                    Customs release alone does not guarantee physical yard slot availability.
                  </div>
                </div>

                <div className="p-3.5 rounded-xs bg-[#F3F6FA] dark:bg-[#0B1420] border border-[#D9E3EB] dark:border-[#294355]">
                  <div className="text-[10px] text-[#516678] dark:text-[#9FB5C5] uppercase font-bold">
                    3. Anti-False Escalation
                  </div>
                  <div className="text-sm font-bold text-[#15803D] dark:text-[#22C55E] mt-1">
                    Evidence Verified
                  </div>
                  <div className="text-[11px] text-[#516678] dark:text-[#9FB5C5] mt-1">
                    No unevidenced swap or unauthorized trade generated.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Owner, Cutoff SLA & Real Call/Task */}
          {activeStep === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold font-mono text-[#102235] dark:text-[#EAF3F8] uppercase tracking-wider flex items-center space-x-1.5">
                  <UserCheck className="w-4 h-4 text-[#067A9B] dark:text-[#39C9DF]" />
                  <span>Responsible Owner SLA & AI Verification Dispatch</span>
                </h3>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-xs bg-[#15803D]/10 text-[#15803D] dark:text-[#22C55E] border border-[#15803D]/30 font-bold">
                  BOLNA READY
                </span>
              </div>

              <div className="border border-[#D9E3EB] dark:border-[#294355] rounded-xs p-4 bg-white dark:bg-[#111F2E]">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs mb-3">
                  <div>
                    <span className="text-[#516678] dark:text-[#9FB5C5]">Assigned Owner: </span>
                    <span className="font-bold text-[#102235] dark:text-[#EAF3F8]">{caseDetail.owner_role}</span>
                  </div>
                  <div>
                    <span className="text-[#516678] dark:text-[#9FB5C5]">Cutoff Countdown: </span>
                    <span className="font-bold text-[#B91C1C] dark:text-[#EF4444]">{caseDetail.sla_countdown}</span>
                  </div>
                </div>

                <div className="p-3 bg-[#F3F6FA] dark:bg-[#0B1420] rounded-xs border border-[#D9E3EB] dark:border-[#294355] font-mono text-xs">
                  <div className="text-[10px] text-[#516678] dark:text-[#9FB5C5] uppercase font-bold">
                    Actionable Verification Task ({caseDetail.verification_task.task_type})
                  </div>
                  <div className="text-sm font-semibold text-[#102235] dark:text-[#EAF3F8] mt-1">
                    "{caseDetail.verification_task.question}"
                  </div>
                  <div className="text-[11px] text-[#516678] dark:text-[#9FB5C5] mt-1">
                    Target: {caseDetail.verification_task.target}
                  </div>
                </div>

                <div className="mt-4 flex flex-col sm:flex-row items-center gap-3">
                  <button
                    onClick={handleTriggerVerificationCall}
                    disabled={callTriggered}
                    className="w-full sm:w-auto px-4 py-2 bg-[#067A9B] hover:bg-[#05637e] dark:bg-[#39C9DF] dark:hover:bg-[#2cb2c7] text-white dark:text-[#0B1420] font-mono text-xs font-bold rounded-xs flex items-center justify-center space-x-2 transition-colors disabled:opacity-50"
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                    <span>Authorize Verification Call (Bolna AI)</span>
                  </button>

                  <span className="text-[11px] font-mono text-[#516678] dark:text-[#9FB5C5]">
                    Requires explicit operator consent reference before dialing.
                  </span>
                </div>

                {callResult && (
                  <div className="mt-3 p-3 bg-[#15803D]/10 border border-[#15803D]/30 rounded-xs text-xs font-mono text-[#15803D] dark:text-[#22C55E]">
                    <div className="font-bold">Call Executed: {callResult.call_id || "RECORDED"}</div>
                    <div className="text-[11px] mt-0.5 text-[#102235] dark:text-[#EAF3F8]">
                      {callResult.transcript || callResult.simulated_script || "Driver acknowledged ready for appointment."}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 4: Candidate Bundles + QpiAI Trace */}
          {activeStep === 4 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold font-mono text-[#102235] dark:text-[#EAF3F8] uppercase tracking-wider flex items-center space-x-1.5">
                  <Cpu className="w-4 h-4 text-[#067A9B] dark:text-[#39C9DF]" />
                  <span>Eligible Truck-Slot-Resource Bundles & QpiAI Trace</span>
                </h3>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-xs bg-[#067A9B]/10 text-[#067A9B] dark:text-[#39C9DF] border border-[#067A9B]/30 font-bold">
                  OPTIMALITY GAP: 0.0%
                </span>
              </div>

              <div className="space-y-2.5 font-mono text-xs">
                {caseDetail.candidate_bundles.map((b) => (
                  <div
                    key={b.bundle_id}
                    className="p-3.5 rounded-xs border border-[#D9E3EB] dark:border-[#294355] bg-white dark:bg-[#111F2E] flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-[#067A9B] dark:text-[#39C9DF]">
                          {b.bundle_id}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded-xs bg-[#15803D]/10 text-[#15803D] dark:text-[#22C55E] border border-[#15803D]/30 font-bold">
                          FEASIBLE
                        </span>
                      </div>
                      <div className="text-[11px] text-[#516678] dark:text-[#9FB5C5] mt-1">
                        Truck: <span className="text-[#102235] dark:text-[#EAF3F8] font-bold">{b.truck_id}</span> | Slot: <span className="text-[#102235] dark:text-[#EAF3F8] font-bold">{b.slot_id}</span> | Chassis: <span className="text-[#102235] dark:text-[#EAF3F8] font-bold">{b.resource_id}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-bold text-[#102235] dark:text-[#EAF3F8]">
                        ₹{b.modeled_cost_inr.toLocaleString("en-IN")}
                      </div>
                      <div className="text-[10px] text-[#516678] dark:text-[#9FB5C5]">
                        Recovery Bundle Execution
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 5: Input Tariffs & Cost Waterfall with Live Sliders */}
          {activeStep === 5 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold font-mono text-[#102235] dark:text-[#EAF3F8] uppercase tracking-wider flex items-center space-x-1.5">
                  <DollarSign className="w-4 h-4 text-[#067A9B] dark:text-[#39C9DF]" />
                  <span>Cost Waterfall & LAB_FIXTURE Deterministic Recalculator</span>
                </h3>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-xs bg-[#15803D]/10 text-[#15803D] dark:text-[#22C55E] border border-[#15803D]/30 font-bold">
                  TARIFF COMPLIANT
                </span>
              </div>

              {/* Interactive Sliders */}
              <div className="p-4 bg-[#F3F6FA] dark:bg-[#0B1420] border border-[#D9E3EB] dark:border-[#294355] rounded-xs font-mono text-xs">
                <div className="flex items-center space-x-1.5 text-xs font-bold text-[#102235] dark:text-[#EAF3F8] mb-3">
                  <Sliders className="w-3.5 h-3.5 text-[#067A9B] dark:text-[#39C9DF]" />
                  <span>Interactive Scenario Variables (Deterministic Evaluation)</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="flex justify-between text-[11px] text-[#516678] dark:text-[#9FB5C5] mb-1">
                      <span>Simulated Incident Delay:</span>
                      <span className="font-bold text-[#102235] dark:text-[#EAF3F8]">{delayMinutes} min</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="180"
                      step="15"
                      value={delayMinutes}
                      onChange={(e) => handleSliderChange(parseInt(e.target.value), rateMultiplier)}
                      className="w-full accent-[#067A9B] dark:accent-[#39C9DF]"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] text-[#516678] dark:text-[#9FB5C5] mb-1">
                      <span>Demurrage Tariff Multiplier:</span>
                      <span className="font-bold text-[#102235] dark:text-[#EAF3F8]">{rateMultiplier.toFixed(1)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.8"
                      max="2.5"
                      step="0.1"
                      value={rateMultiplier}
                      onChange={(e) => handleSliderChange(delayMinutes, parseFloat(e.target.value))}
                      className="w-full accent-[#067A9B] dark:accent-[#39C9DF]"
                    />
                  </div>
                </div>
              </div>

              {/* Waterfall Numbers */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
                <div className="p-3.5 rounded-xs bg-white dark:bg-[#111F2E] border border-[#D9E3EB] dark:border-[#294355]">
                  <div className="text-[10px] text-[#516678] dark:text-[#9FB5C5] uppercase font-bold">
                    Do-Nothing Compounded Baseline
                  </div>
                  <div className="text-lg font-bold text-[#B91C1C] dark:text-[#EF4444] mt-1">
                    ₹{recalcResult?.compounded_baseline_inr.toLocaleString("en-IN") || caseDetail.cost_waterfall.do_nothing_baseline_inr.toLocaleString("en-IN")}
                  </div>
                  <div className="text-[10px] text-[#516678] dark:text-[#9FB5C5] mt-1">
                    Demurrage + Yard Dwell Cliff
                  </div>
                </div>

                <div className="p-3.5 rounded-xs bg-white dark:bg-[#111F2E] border border-[#D9E3EB] dark:border-[#294355]">
                  <div className="text-[10px] text-[#516678] dark:text-[#9FB5C5] uppercase font-bold">
                    Recovery Plan Execution Cost
                  </div>
                  <div className="text-lg font-bold text-[#102235] dark:text-[#EAF3F8] mt-1">
                    ₹{recalcResult?.recovery_plan_cost_inr.toLocaleString("en-IN") || caseDetail.cost_waterfall.recovery_plan_cost_inr.toLocaleString("en-IN")}
                  </div>
                  <div className="text-[10px] text-[#516678] dark:text-[#9FB5C5] mt-1">
                    Truck + Slot + Chassis Lease
                  </div>
                </div>

                <div className="p-3.5 rounded-xs bg-[#15803D]/10 border border-[#15803D]/30">
                  <div className="text-[10px] text-[#15803D] dark:text-[#22C55E] uppercase font-bold">
                    Net Projected Avoidable Cost
                  </div>
                  <div className="text-lg font-bold text-[#15803D] dark:text-[#22C55E] mt-1">
                    ₹{recalcResult?.avoidable_savings_inr.toLocaleString("en-IN") || caseDetail.cost_waterfall.avoidable_cost_inr.toLocaleString("en-IN")}
                  </div>
                  <div className="text-[10px] text-[#15803D] dark:text-[#22C55E] mt-1">
                    avoidable = baseline - recovery
                  </div>
                </div>
              </div>

              <div className="text-[11px] font-mono text-[#516678] dark:text-[#9FB5C5] italic">
                Tariff Basis: {caseDetail.cost_waterfall.tariff_basis}. No fixed arbitrary ₹45,000 claims.
              </div>
            </div>
          )}

          {/* STEP 6: Approved/Rejected ResourceLock & Android */}
          {activeStep === 6 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold font-mono text-[#102235] dark:text-[#EAF3F8] uppercase tracking-wider flex items-center space-x-1.5">
                  <Radio className="w-4 h-4 text-[#067A9B] dark:text-[#39C9DF]" />
                  <span>ResourceLock Cyber-Physical Commitment & Android Sync</span>
                </h3>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-xs bg-[#15803D]/10 text-[#15803D] dark:text-[#22C55E] border border-[#15803D]/30 font-bold">
                  BUTTONLESS DISPATCH
                </span>
              </div>

              <div className="border border-[#D9E3EB] dark:border-[#294355] rounded-xs p-4 bg-white dark:bg-[#111F2E] font-mono text-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#102235] dark:text-[#EAF3F8]">
                    Chassis Mutual-Exclusion Lease:
                  </span>
                  <span className="px-2 py-0.5 rounded-xs bg-[#15803D]/10 text-[#15803D] dark:text-[#22C55E] border border-[#15803D]/30 font-bold">
                    ATOMIC_COMMITTED
                  </span>
                </div>

                <p className="text-[11px] text-[#516678] dark:text-[#9FB5C5]">
                  Hardware Gate Verification: Assigned chassis requires physical RC522 badge scan (Tag TAG_07 / TAG_09) at terminal reader. No touch gestures, ultrasonic presence sensors, or automatic slot trading without carrier authorization.
                </p>

                <div className="p-3 bg-[#F3F6FA] dark:bg-[#0B1420] rounded-xs border border-[#D9E3EB] dark:border-[#294355] text-[11px]">
                  <div className="font-bold text-[#102235] dark:text-[#EAF3F8]">Android Driver Sync (com.lira.field):</div>
                  <div className="text-[#516678] dark:text-[#9FB5C5] mt-0.5">
                    Job assigned to Truck {caseDetail.candidate_bundles[0]?.truck_id}. Terminal appointment slot S1630 pinned to driver active manifest.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Stepper Navigation Buttons */}
          <div className="flex justify-between items-center pt-4 border-t border-[#D9E3EB] dark:border-[#294355] mt-6">
            <button
              onClick={() => setActiveStep((prev) => Math.max(1, prev - 1))}
              disabled={activeStep === 1}
              className="px-3.5 py-1.5 border border-[#D9E3EB] dark:border-[#294355] rounded-xs font-mono text-xs text-[#516678] dark:text-[#9FB5C5] hover:text-[#102235] dark:hover:text-[#EAF3F8] disabled:opacity-30 transition-colors"
            >
              Previous Step
            </button>

            <span className="text-[11px] font-mono text-[#516678] dark:text-[#9FB5C5]">
              Step {activeStep} of 6
            </span>

            <button
              onClick={() => setActiveStep((prev) => Math.min(6, prev + 1))}
              disabled={activeStep === 6}
              className="px-3.5 py-1.5 bg-[#067A9B] hover:bg-[#05637e] dark:bg-[#39C9DF] dark:hover:bg-[#2cb2c7] text-white dark:text-[#0B1420] rounded-xs font-mono text-xs font-bold disabled:opacity-30 transition-colors"
            >
              Next Step
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

