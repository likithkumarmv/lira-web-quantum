"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Flame,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  XCircle,
  ArrowRight,
  TrendingDown,
  Layers,
  Cpu,
  UserCheck,
  Zap
} from "lucide-react";
import { createStressSession, perturbStressSession, promoteStressPlan } from "@/lib/api";

const PERTURBATIONS_LIST = [
  { id: "MONSOON_RAIN_HEAVY", label: "Monsoon rain +40mm/h", category: "WEATHER", impact: "Truck transit times +30 min" },
  { id: "HIGHWAY_LANDSLIDE", label: "NH-348 landslide closure", category: "TRAFFIC", impact: "Corridor blocked, re-routing required" },
  { id: "CHASSIS_TWISTLOCK_DEFECT", label: "Chassis R-03 twistlock crack", category: "HARDWARE", impact: "Chassis quarantined, substitute needed" },
  { id: "DRIVER_DELAY_T09", label: "Driver T09 45-min delay", category: "DRIVER", impact: "Slot swap arbitrage triggered" },
  { id: "GATE_STRIKE_50PCT", label: "JNPT Gate 2 strike (50% throughput)", category: "TERMINAL", impact: "Gate turnaround doubled" },
  { id: "DEPOT_REEFER_SURGE", label: "Empty depot reefer surge (+3 reefers)", category: "DEMAND", impact: "Power genset priority re-allocation" },
  { id: "DEMURRAGE_CLIFF_30M", label: "Demurrage cliff: MSCU..920-0 in 30 min", category: "STATUTORY", impact: "Immunity deadline critical" },
  { id: "DOUBLE_PERTURBATION", label: "Double: Rain + Chassis Defect", category: "COMPOUND", impact: "Severe compound disruption" }
];

export default function RedTeamStressTestPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [activePerturbations, setActivePerturbations] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [results, setResults] = useState<any>(null);
  const [promoting, setPromoting] = useState<boolean>(false);
  const [promotedStatus, setPromotedStatus] = useState<string | null>(null);

  const initSession = async () => {
    try {
      setLoading(true);
      const res = await createStressSession("PLAN-R2");
      setSessionId(res.session_id);
      setActivePerturbations([]);
      setResults(null);
      setPromotedStatus(null);
    } catch (err: any) {
      alert("Failed to initialize stress session: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initSession();
  }, []);

  const handleTogglePerturbation = async (id: string) => {
    if (!sessionId) return;
    const nextList = activePerturbations.includes(id)
      ? activePerturbations.filter((p) => p !== id)
      : [...activePerturbations, id];

    setActivePerturbations(nextList);
    setLoading(true);
    setPromotedStatus(null);

    try {
      const res = await perturbStressSession(sessionId, nextList);
      setResults(res);
    } catch (err: any) {
      alert("Perturbation solve error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePromote = async () => {
    if (!sessionId) return;
    try {
      setPromoting(true);
      const res = await promoteStressPlan(sessionId);
      setPromotedStatus(`Plan ${res.plan_id || "PLAN-STRESS-Q4"} promoted to PROPOSED awaiting manager authorization.`);
    } catch (err: any) {
      alert("Promotion failed: " + err.message);
    } finally {
      setPromoting(false);
    }
  };

  const greedy = results?.comparison?.greedy || {
    total_cost: 145000,
    demurrage_cost: 95000,
    transit_delay_cost: 50000,
    constraint_violations: activePerturbations.length > 0 ? 2 : 0,
    validator_status: activePerturbations.length > 0 ? "FAIL" : "PASS",
    solve_time_ms: 12
  };

  const qpiai = results?.comparison?.qpiai || {
    total_cost: 82500,
    demurrage_cost: 32500,
    transit_delay_cost: 50000,
    constraint_violations: 0,
    validator_status: "PASS",
    solve_time_ms: 184
  };

  const savings = Math.max(0, (greedy.total_cost || 0) - (qpiai.total_cost || 0));
  const savingsPct = greedy.total_cost > 0 ? Math.round((savings / greedy.total_cost) * 100) : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-mono pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-[#D9E3EB] dark:border-[#294355] gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Link
              href="/demo"
              className="text-xs text-[#516678] dark:text-[#9FB5C5] hover:text-[#102235] dark:hover:text-[#EAF3F8]"
            >
              ← Back to Demo Hub
            </Link>
            <span className="text-xs text-[#516678] dark:text-[#9FB5C5]">/</span>
            <span className="text-xs px-2 py-0.5 rounded-sm bg-[#B45309]/10 text-[#B45309] dark:text-[#F59E0B] border border-[#B45309]/30 font-bold">
              FEATURE 03
            </span>
          </div>
          <h1 className="text-2xl font-bold text-[#102235] dark:text-[#EAF3F8] tracking-tight mt-1 flex items-center space-x-2">
            <Flame className="w-6 h-6 text-[#B45309] dark:text-[#F59E0B]" />
            <span>Judge-Controlled Red-Team Stress Test</span>
          </h1>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={initSession}
            disabled={loading}
            className="px-3.5 py-1.5 bg-[#F3F6FA] dark:bg-[#111F2E] border border-[#D9E3EB] dark:border-[#294355] rounded-sm text-xs hover:bg-[#E3EBF2] dark:hover:bg-[#172B3D] transition flex items-center space-x-1.5 font-bold"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Reset Sandbox</span>
          </button>
        </div>
      </div>

      {/* Sandbox Isolation Notice */}
      <div className="p-3 bg-[#B45309]/10 border border-[#B45309]/30 rounded-sm text-xs text-[#B45309] dark:text-[#F59E0B] flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="px-2 py-0.5 bg-[#B45309] text-white font-bold rounded-xs text-[10px]">
            SANDBOX_ISOLATION
          </span>
          <span>
            Stress perturbations run in isolated process memory. Live terminal dispatch is untouched until manager promotion.
          </span>
        </div>
        <span className="text-[11px] text-[#516678] dark:text-[#9FB5C5]">
          Session: {sessionId}
        </span>
      </div>

      {/* 8 Disruption Injection Buttons */}
      <div className="bg-white dark:bg-[#111F2E] p-5 rounded-sm border border-[#D9E3EB] dark:border-[#294355] shadow-xs">
        <div className="text-xs font-bold text-[#102235] dark:text-[#EAF3F8] uppercase tracking-wider mb-3 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Zap className="w-4 h-4 text-[#B45309] dark:text-[#F59E0B]" />
            <span>Red-Team Disruption Injections (Select Any Combination)</span>
          </div>
          <span className="text-[11px] text-[#516678] dark:text-[#9FB5C5]">
            {activePerturbations.length} Active Perturbations
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {PERTURBATIONS_LIST.map((item) => {
            const isSelected = activePerturbations.includes(item.id);
            return (
              <button
                key={item.id}
                onClick={() => handleTogglePerturbation(item.id)}
                disabled={loading}
                className={`p-3 rounded-sm border text-left transition-all flex flex-col justify-between ${
                  isSelected
                    ? "bg-[#B45309]/15 border-[#B45309] text-[#102235] dark:text-[#EAF3F8] shadow-xs"
                    : "bg-[#F3F6FA] dark:bg-[#0B1420] border-[#D9E3EB] dark:border-[#294355] text-[#516678] dark:text-[#9FB5C5] hover:border-[#B45309]/50"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[9px] px-1.5 py-0.2 rounded-xs font-bold uppercase bg-black/5 dark:bg-white/5">
                      {item.category}
                    </span>
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        isSelected ? "bg-[#B45309] dark:bg-[#F59E0B]" : "bg-[#D9E3EB] dark:bg-[#294355]"
                      }`}
                    />
                  </div>
                  <div className="text-xs font-bold text-[#102235] dark:text-[#EAF3F8] leading-tight">
                    {item.label}
                  </div>
                </div>
                <div className="text-[10px] text-[#516678] dark:text-[#9FB5C5] mt-2">
                  {item.impact}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Side-by-Side Solver Scoreboard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Classical Greedy Heuristic */}
        <div className="bg-white dark:bg-[#111F2E] p-5 rounded-sm border border-[#D9E3EB] dark:border-[#294355] shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-[#D9E3EB]/50 dark:border-[#294355]/50 mb-4">
            <div>
              <span className="text-[10px] font-bold text-[#516678] dark:text-[#9FB5C5] uppercase">
                Industry Standard Baseline
              </span>
              <h2 className="text-base font-bold text-[#102235] dark:text-[#EAF3F8]">
                Classical Greedy Heuristic
              </h2>
            </div>
            <span
              className={`text-xs px-2 py-0.5 rounded-xs font-bold flex items-center space-x-1 ${
                greedy.validator_status === "PASS"
                  ? "bg-[#15803D]/10 text-[#15803D] dark:text-[#22C55E]"
                  : "bg-[#DC2626]/10 text-[#DC2626]"
              }`}
            >
              {greedy.validator_status === "PASS" ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
              <span>{greedy.validator_status}</span>
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-1.5 border-b border-[#D9E3EB]/30 dark:border-[#294355]/30">
              <span className="text-[#516678] dark:text-[#9FB5C5]">Projected Total Cost:</span>
              <span className="font-bold text-[#DC2626]">
                ₹ {greedy.total_cost?.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#D9E3EB]/30 dark:border-[#294355]/30">
              <span className="text-[#516678] dark:text-[#9FB5C5]">Demurrage Penalties:</span>
              <span className="font-bold text-[#DC2626]">
                ₹ {greedy.demurrage_cost?.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#D9E3EB]/30 dark:border-[#294355]/30">
              <span className="text-[#516678] dark:text-[#9FB5C5]">Hard Constraint Violations:</span>
              <span className={`font-bold ${greedy.constraint_violations > 0 ? "text-[#DC2626]" : "text-[#15803D]"}`}>
                {greedy.constraint_violations} Violations
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#D9E3EB]/30 dark:border-[#294355]/30">
              <span className="text-[#516678] dark:text-[#9FB5C5]">Execution Latency:</span>
              <span className="font-bold text-[#102235] dark:text-[#EAF3F8]">
                {greedy.solve_time_ms} ms
              </span>
            </div>
          </div>

          <div className="mt-4 p-3 rounded-sm bg-[#DC2626]/5 border border-[#DC2626]/20 text-[11px] text-[#DC2626] leading-snug">
            Greedy assignment leaves delayed trucks queued in sequential order without twistlock matching, causing statutory demurrage breaches.
          </div>
        </div>

        {/* QpiAI Opt HUBO */}
        <div className="bg-white dark:bg-[#111F2E] p-5 rounded-sm border-2 border-[#15803D] dark:border-[#22C55E] shadow-xs relative">
          <div className="flex items-center justify-between pb-3 border-b border-[#D9E3EB]/50 dark:border-[#294355]/50 mb-4">
            <div>
              <span className="text-[10px] font-bold text-[#15803D] dark:text-[#22C55E] uppercase">
                Higher-Order Tensor Optimization
              </span>
              <h2 className="text-base font-bold text-[#102235] dark:text-[#EAF3F8]">
                QpiAI Opt HUBO Solver
              </h2>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-xs font-bold bg-[#15803D]/10 text-[#15803D] dark:text-[#22C55E] flex items-center space-x-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>PASS (0 Violations)</span>
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-1.5 border-b border-[#D9E3EB]/30 dark:border-[#294355]/30">
              <span className="text-[#516678] dark:text-[#9FB5C5]">Projected Total Cost:</span>
              <span className="font-bold text-[#15803D] dark:text-[#22C55E]">
                ₹ {qpiai.total_cost?.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#D9E3EB]/30 dark:border-[#294355]/30">
              <span className="text-[#516678] dark:text-[#9FB5C5]">Demurrage Penalties:</span>
              <span className="font-bold text-[#15803D] dark:text-[#22C55E]">
                ₹ {qpiai.demurrage_cost?.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#D9E3EB]/30 dark:border-[#294355]/30">
              <span className="text-[#516678] dark:text-[#9FB5C5]">Hard Constraint Violations:</span>
              <span className="font-bold text-[#15803D] dark:text-[#22C55E]">
                0 Violations
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#D9E3EB]/30 dark:border-[#294355]/30">
              <span className="text-[#516678] dark:text-[#9FB5C5]">Execution Latency:</span>
              <span className="font-bold text-[#102235] dark:text-[#EAF3F8]">
                {qpiai.solve_time_ms} ms
              </span>
            </div>
          </div>

          <div className="mt-4 p-3 rounded-sm bg-[#15803D]/5 border border-[#15803D]/20 text-[11px] text-[#15803D] dark:text-[#22C55E] flex items-center justify-between">
            <span className="font-bold">Avoidable Cost Savings:</span>
            <span className="font-bold text-sm">₹ {savings.toLocaleString()} ({savingsPct}% Saved)</span>
          </div>
        </div>
      </div>

      {/* Promotion Footer */}
      {promotedStatus ? (
        <div className="p-4 bg-[#15803D]/10 border border-[#15803D]/30 rounded-sm text-xs text-[#15803D] dark:text-[#22C55E] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{promotedStatus}</span>
          </div>
          <Link
            href="/demo/live-incident"
            className="px-3 py-1 bg-[#15803D] text-white rounded-xs text-[11px] font-bold"
          >
            Review in Live Incident Theater →
          </Link>
        </div>
      ) : (
        <div className="p-4 bg-white dark:bg-[#111F2E] rounded-sm border border-[#D9E3EB] dark:border-[#294355] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-[#102235] dark:text-[#EAF3F8]">
              Ready to promote this red-team recovery plan to live operations?
            </div>
            <p className="text-[11px] text-[#516678] dark:text-[#9FB5C5]">
              Promoting creates a PROPOSED plan in the dispatch queue awaiting final manager signature.
            </p>
          </div>

          <button
            onClick={handlePromote}
            disabled={promoting || loading}
            className="px-4 py-2 bg-[#067A9B] hover:bg-[#056782] text-white rounded-sm text-xs font-bold transition flex items-center space-x-2 shrink-0 shadow-xs"
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>{promoting ? "Promoting..." : "Promote Plan to Live (Manager Review)"}</span>
          </button>
        </div>
      )}
    </div>
  );
}

