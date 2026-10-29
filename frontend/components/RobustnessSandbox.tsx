"use client";

import React, { useState, useEffect } from "react";
import { fetchRobustnessScenarios } from "@/lib/api";
import { RobustnessSummary } from "@/lib/types";

export default function RobustnessSandbox() {
  const [data, setData] = useState<RobustnessSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRobustnessScenarios()
      .then(setData)
      .catch((err) => console.error("Error loading robustness scenarios:", err))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <div className="p-4 bg-[#10141B] border border-[#222936] rounded text-xs font-mono text-slate-500 animate-pulse">
        Loading QpiAI Red-Team Robustness Sandbox scenarios...
      </div>
    );
  }

  return (
    <div className="bg-[#10141B] border border-[#222936] rounded p-5 space-y-4 font-mono text-xs">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#222936] pb-3">
        <div className="flex items-center space-x-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
          <h3 className="text-sm font-semibold text-slate-100 tracking-wider uppercase font-mono">
            QpiAI Red-Team & Robust Recovery Sandbox
          </h3>
        </div>
        <div className="flex items-center space-x-2">
          <span className="px-2 py-0.5 text-[10px] bg-purple-950/60 border border-purple-800 text-purple-300 rounded">
            BOUNDED ADVERSARIAL ANALYSIS
          </span>
          <span className="px-2 py-0.5 text-[10px] bg-amber-950/60 border border-amber-800 text-amber-300 rounded">
            MANAGER APPROVAL GATED
          </span>
        </div>
      </div>

      <p className="text-xs text-slate-400 font-sans">
        Stress-tests operational plans against severe disruption scenarios: vehicle breakdowns, flash monsoon delays, chassis inspection failures, and RTG crane breakdowns. Compares worst-case cost exposure against pre-calculated robust alternatives.
      </p>

      {/* Aggregate KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-[#090B0E] p-3 rounded border border-[#222936]">
        <div>
          <div className="text-[10px] text-slate-500 uppercase">Worst-Case Exposure</div>
          <div className="text-sm font-bold text-red-400">
            ₹{data.metrics.total_worst_case_cost_inr.toLocaleString()}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-slate-500 uppercase">Optimized Baseline</div>
          <div className="text-sm font-bold text-emerald-400">
            ₹{data.metrics.total_baseline_cost_inr.toLocaleString()}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-slate-500 uppercase">Avoided Cost Exposure</div>
          <div className="text-sm font-bold text-cyan-400">
            ₹{data.metrics.total_avoided_exposure_inr.toLocaleString()}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-slate-500 uppercase">Adversarial Coverage</div>
          <div className="text-sm font-bold text-slate-200">
            {data.metrics.mean_adversarial_coverage_pct}%
          </div>
        </div>
      </div>

      {/* Scenarios Grid */}
      <div className="space-y-3 pt-2">
        <div className="text-[11px] text-slate-400 uppercase tracking-wider">
          Stress Scenarios Evaluated ({data.scenarios.length})
        </div>
        <div className="space-y-2.5">
          {data.scenarios.map((scen) => (
            <div
              key={scen.scenario_id}
              className="bg-[#0D1117] border border-[#222936] p-3.5 rounded space-y-2 text-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <span className="text-slate-100 font-semibold">{scen.title}</span>
                <div className="flex space-x-2">
                  <span className="text-[10px] bg-red-950/60 border border-red-800 text-red-300 px-2 py-0.5 rounded">
                    Worst-Case: ₹{scen.worst_case_cost_inr.toLocaleString()}
                  </span>
                  <span className="text-[10px] bg-emerald-950/60 border border-emerald-800 text-emerald-300 px-2 py-0.5 rounded">
                    Mitigated: ₹{scen.baseline_cost_inr.toLocaleString()}
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                {scen.description}
              </p>
              <div className="bg-[#141C2B] p-2.5 rounded border border-cyan-900/50 text-[11px] text-cyan-200 font-sans">
                <span className="font-mono font-bold text-cyan-400 uppercase">Robust Recovery Path: </span>
                {scen.alternative_plan_summary}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-3 bg-[#090B0E] border border-slate-800 rounded text-[11px] text-slate-500 font-sans">
        * Note: Robustness simulations are strictly analytical sandbox evaluations. No vehicle re-dispatch or gate appointment modification is executed without explicit authenticated human operations manager approval.
      </div>
    </div>
  );
}

