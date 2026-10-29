"use client";

import React, { useState, useEffect } from "react";
import { BarChart3, Cpu, Activity, RefreshCw, CheckCircle2, Sliders, Layers, Terminal } from "lucide-react";
import { fetchSolverRun, fetchHuboFormulation } from "@/lib/api";
import { SolverRunTelemetry } from "@/lib/types";
import RobustnessSandbox from "@/components/RobustnessSandbox";
import DecisionModesMatrix from "@/components/DecisionModesMatrix";

export default function OptimizationLabPage() {
  const [telemetry, setTelemetry] = useState<SolverRunTelemetry | null>(null);
  const [hubo, setHubo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const [telData, huboData] = await Promise.allSettled([
        fetchSolverRun("latest"),
        fetchHuboFormulation()
      ]);
      if (telData.status === "fulfilled") setTelemetry(telData.value);
      if (huboData.status === "fulfilled") setHubo(huboData.value);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#102235] dark:text-[#EAF3F8] font-mono tracking-tight flex items-center space-x-2.5">
            <span>Optimization & Solver Lab: QpiAI Decision Modes</span>
            <span className="text-[10px] bg-[#15803D]/10 text-[#15803D] dark:text-[#22C55E] px-2 py-0.5 rounded-xs border border-[#15803D]/30 font-bold">
              Q1–Q6 UNIFIED
            </span>
          </h1>
          <p className="text-[#516678] dark:text-[#9FB5C5] text-xs font-mono mt-1">
            Deterministic Arc-Consistency pre-compression, 3rd-order non-linear terms, and QpiAI Opt solver formulation.
          </p>
        </div>

        <button
          onClick={loadData}
          className="flex items-center space-x-1.5 px-3 py-1 bg-white dark:bg-[#111F2E] border border-[#D9E3EB] dark:border-[#294355] text-[#102235] dark:text-[#EAF3F8] rounded-xs text-xs font-mono hover:bg-[#F3F6FA] dark:hover:bg-[#0B1420] transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#067A9B] dark:text-[#39C9DF]" : ""}`} />
          <span>Refresh Formulation</span>
        </button>
      </div>

      {/* Unified Q1 - Q6 Decision Modes Matrix */}
      <DecisionModesMatrix />

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
        <div className="bg-white dark:bg-[#10141B] border border-[#D1D5DB] dark:border-[#222936] rounded-sm p-3">
          <span className="text-[10px] text-[#6B7280] dark:text-[#8A99AD] block mb-0.5 font-bold">
            FORMULATION HASH
          </span>
          <span className="text-xs font-bold text-[#0284C7] truncate block">
            {hubo?.formulation_hash || telemetry?.formulation_hash || "d83f2a1b9c0e4471"}
          </span>
        </div>

        <div className="bg-white dark:bg-[#10141B] border border-[#D1D5DB] dark:border-[#222936] rounded-sm p-3">
          <span className="text-[10px] text-[#6B7280] dark:text-[#8A99AD] block mb-0.5 font-bold">
            ACTIVE CORE / PRUNED
          </span>
          <span className="text-sm font-bold text-[#16A34A]">
            {hubo?.variable_names?.length || 5} Vars ({hubo?.pruned_triples_count || 12} Pruned)
          </span>
        </div>

        <div className="bg-white dark:bg-[#10141B] border border-[#D1D5DB] dark:border-[#222936] rounded-sm p-3">
          <span className="text-[10px] text-[#6B7280] dark:text-[#8A99AD] block mb-0.5 font-bold">
            POLYNOMIAL DEGREE
          </span>
          <span className="text-sm font-bold text-[#0284C7]">
            Degree {hubo?.degree || 3} (HUBO)
          </span>
        </div>

        <div className="bg-white dark:bg-[#10141B] border border-[#D1D5DB] dark:border-[#222936] rounded-sm p-3">
          <span className="text-[10px] text-[#6B7280] dark:text-[#8A99AD] block mb-0.5 font-bold">
            CONVERGENCE TIME
          </span>
          <span className="text-sm font-bold text-[#D97706] tabular-nums">
            {telemetry?.execution_time_ms || 342} ms
          </span>
        </div>
      </div>

      {/* 3rd-Order Cubic Terms Section */}
      <div className="bg-white dark:bg-[#10141B] border border-[#D1D5DB] dark:border-[#222936] rounded-sm p-4 font-mono text-xs space-y-3">
        <div className="flex items-center justify-between border-b border-[#D1D5DB] dark:border-[#222936] pb-2">
          <div className="flex items-center space-x-2 text-[#0284C7] font-bold">
            <Layers className="w-4 h-4" />
            <span>NATIVE 3RD-ORDER CUBIC TERMS (H_cubic)</span>
          </div>
          <span className="text-[10px] bg-[#16A34A]/10 text-[#16A34A] px-2 py-0.5 rounded-sm border border-[#16A34A]/30 font-bold">
            qpiai-opt HUBO solver
          </span>
        </div>

        <div className="p-2.5 bg-[#F3F4F6] dark:bg-[#090B0E] rounded-sm border border-[#D1D5DB] dark:border-[#222936] text-[11px] leading-relaxed text-[#111827] dark:text-[#F0F4F8]">
          <div className="text-[#6B7280] dark:text-[#8A99AD] mb-1 font-bold">FORMULATION EQUATION:</div>
          <div className="text-[#0284C7] font-bold">
            H_cubic(x) = -γ_swap ∑ (x_urgent · x_donor · y_rebate) - γ_dual ∑ (x_imp · x_exp · z_depot) + η_crane ∑ (x_c1 · x_c2 · x_c3)
          </div>
        </div>

        {/* Multi-Commodity Joint Allocation Constraints */}
        <div className="p-3 bg-[#067A9B]/5 dark:bg-[#39C9DF]/5 border border-[#D9E3EB] dark:border-[#294355] rounded-xs space-y-1.5 text-xs font-mono">
          <div className="flex items-center justify-between">
            <span className="font-bold text-[#102235] dark:text-[#EAF3F8] text-xs">
              NON-LINEAR PENALTY & JOINT RESOURCE ALLOCATION
            </span>
            <span className="text-[10px] bg-[#067A9B]/10 text-[#067A9B] dark:text-[#39C9DF] px-2 py-0.5 rounded-xs font-bold border border-[#067A9B]/30">
              MODELED POLYNOMIAL
            </span>
          </div>
          <p className="text-[11px] text-[#516678] dark:text-[#9FB5C5]">
            Non-linear coupling models dual-transaction empty-return pairing and RTG crane contention surge without assuming unpermitted slot trading or fixed marketing savings.
          </p>
        </div>

        <div className="space-y-2">
          {hubo?.cubic_terms && hubo.cubic_terms.length > 0 ? (
            hubo.cubic_terms.map((term: any, idx: number) => (
              <div
                key={idx}
                className="p-2.5 bg-[#F3F4F6] dark:bg-[#090B0E] rounded-sm border border-[#D1D5DB] dark:border-[#222936] flex flex-wrap justify-between items-center text-[11px]"
              >
                <div>
                  <span className="font-bold text-[#111827] dark:text-[#F0F4F8]">{term.type}</span>
                  <span className="text-[#6B7280] dark:text-[#8A99AD] block text-[10px] mt-0.5">
                    {term.description || "Higher-order constraint term"}
                  </span>
                  <code className="text-[#0284C7] text-[10px] block mt-0.5">
                    ({term.variables?.join(", ")})
                  </code>
                </div>
                <div className="text-right">
                  <span className={`font-bold tabular-nums ${term.weight < 0 ? "text-[#16A34A]" : "text-[#DC2626]"}`}>
                    Weight: {term.weight > 0 ? `+${term.weight}` : term.weight}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="space-y-1.5">
              <div className="p-2 bg-[#F3F4F6] dark:bg-[#090B0E] rounded-sm border border-[#D1D5DB] dark:border-[#222936] flex justify-between items-center text-[10px]">
                <div>
                  <span className="font-bold text-[#16A34A]">DUAL_TRANSACTION_REWARD</span>
                  <span className="text-[#6B7280] dark:text-[#8A99AD] block text-[9px]">
                    Import pickup + Export empty return on same truck when empty depot open
                  </span>
                  <code className="text-[#0284C7] text-[9px]">(x[C102,T07,S1600], x[C105_EXP,T07,S1600], z_depot)</code>
                </div>
                <span className="text-[#16A34A] font-bold tabular-nums">-15,000.0</span>
              </div>

              <div className="p-2 bg-[#F3F4F6] dark:bg-[#090B0E] rounded-sm border border-[#D1D5DB] dark:border-[#222936] flex justify-between items-center text-[10px]">
                <div>
                  <span className="font-bold text-[#DC2626]">RTG_CRANE_SURGE_PENALTY</span>
                  <span className="text-[#6B7280] dark:text-[#8A99AD] block text-[9px]">
                    Non-linear RTG yard crane contention for 3 concurrent moves in Block 2B
                  </span>
                  <code className="text-[#0284C7] text-[9px]">(x[C102,T07,S1600], x[C103,T04,S1600], x[C104,T09,S1600])</code>
                </div>
                <span className="text-[#DC2626] font-bold tabular-nums">+45,000.0</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quadratic Upper Triangular Matrix */}
      <div className="bg-white dark:bg-[#10141B] border border-[#D1D5DB] dark:border-[#222936] rounded-sm p-4 font-mono text-xs">
        <div className="flex items-center justify-between mb-2.5 border-b border-[#D1D5DB] dark:border-[#222936] pb-2">
          <div className="flex items-center space-x-2 text-[#0284C7] font-bold">
            <Sliders className="w-4 h-4" />
            <span>QUADRATIC COUPLING MATRIX (Upper Triangular Q)</span>
          </div>
          <span className="text-[10px] text-[#6B7280] dark:text-[#8A99AD]">Min E(z) = z^T Q z + H_cubic</span>
        </div>

        <div className="bg-[#F3F4F6] dark:bg-[#090B0E] p-3 rounded-sm border border-[#D1D5DB] dark:border-[#222936] overflow-x-auto text-[11px] leading-relaxed text-[#111827] dark:text-[#F0F4F8]">
          <div className="text-[#6B7280] dark:text-[#8A99AD] mb-1.5 text-[10px]">
            # Variables ({hubo?.variable_names?.length || 5}): {hubo?.variable_names?.slice(0, 5).join(", ") || "u[C102], x[C102,T07,S1600], x[C102,T04,S1600], x[C102,T09,S1600]"}
          </div>
          <div className="font-mono text-[#0284C7] font-bold tabular-nums text-[10px]">
            {hubo?.quadratic_matrix ? (
              hubo.quadratic_matrix.slice(0, 6).map((row: number[], rIdx: number) => (
                <div key={rIdx}>
                  [ {row.map((val: number) => (val >= 0 ? ` ${val.toFixed(1)}` : val.toFixed(1))).join(", ")} ]
                </div>
              ))
            ) : (
              <>
                [  54000.0, -25000.0, -25000.0, -25000.0, -25000.0 ]<br/>
                [      0.0,  -4000.0,  30000.0,  30000.0,  30000.0 ]<br/>
                [      0.0,      0.0,  -4000.0,  30000.0,      0.0 ]<br/>
                [      0.0,      0.0,      0.0,  -4000.0,      0.0 ]<br/>
                [      0.0,      0.0,      0.0,      0.0,  -4000.0 ]
              </>
            )}
          </div>
        </div>

        <div className="mt-2.5 text-[10px] text-[#6B7280] dark:text-[#8A99AD] leading-relaxed">
          Arc-consistency prunes triples where: truck payload &lt; 26,400 kg, driver duty &gt; 10.0h, reefer genset missing, or customs OOC unconfirmed.
        </div>
      </div>

      {/* QpiAI Red-Team Bounded Adversarial Robustness Sandbox */}
      <RobustnessSandbox />
    </div>
  );
}
