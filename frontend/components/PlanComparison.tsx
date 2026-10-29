"use client";

import React from "react";
import { CheckCircle2, XCircle, AlertTriangle, Cpu, TrendingDown, ArrowRight } from "lucide-react";
import { PlanAlternative } from "@/lib/types";

interface PlanComparisonProps {
  alternatives: PlanAlternative[];
  selectedPlanId: string | null;
  onSelectPlan: (plan: PlanAlternative) => void;
  doNothingCost: number;
}

export default function PlanComparison({
  alternatives,
  selectedPlanId,
  onSelectPlan,
  doNothingCost
}: PlanComparisonProps) {
  return (
    <div className="space-y-4">
      {/* Benchmark comparison header */}
      <div className="bg-white dark:bg-[#161b22] p-4 rounded-xl border border-[#d0d7de] dark:border-[#30363d] flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div>
          <span className="text-xs font-mono text-[#656d76] dark:text-[#8b949e] block mb-0.5 font-semibold">DO-NOTHING COST EXPOSURE</span>
          <span className="text-xl font-bold font-mono text-red-600 dark:text-[#f85149]">
            ₹{doNothingCost.toLocaleString("en-IN")}
          </span>
          <span className="text-[11px] text-[#656d76] dark:text-[#8b949e] block">Demurrage + late customer delivery penalties</span>
        </div>

        <div className="flex items-center space-x-2 text-xs font-mono text-[#656d76] dark:text-[#8b949e]">
          <ArrowRight className="w-4 h-4 text-blue-600 dark:text-sky-400 hidden sm:block" />
          <span>QpiAI Conflict Core QAOA + Opt Solver Optimization</span>
        </div>

        <div>
          <span className="text-xs font-mono text-[#656d76] dark:text-[#8b949e] block mb-0.5 font-semibold">MAX AVOIDABLE SAVINGS</span>
          <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
            ₹{alternatives[0]?.avoidable_cost_inr.toLocaleString("en-IN") || "30,000"}
          </span>
          <span className="text-[11px] text-emerald-700 dark:text-emerald-400/80 block">Projected cost reduction: ~78%</span>
        </div>
      </div>

      {/* Plan Alternative Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {alternatives.map((plan) => {
          const isSelected = selectedPlanId === plan.plan_id;
          const isPlanA = plan.plan_code === "PLAN-A" || plan.plan_code === "PLAN-R2";

          return (
            <div
              key={plan.plan_id}
              onClick={() => onSelectPlan(plan)}
              className={`p-4 rounded-xl border cursor-pointer transition flex flex-col justify-between shadow-sm ${
                isSelected
                  ? "bg-blue-50/60 dark:bg-[#21262d] border-blue-500 dark:border-[#388bfd] ring-1 ring-blue-500/30 dark:ring-[#388bfd]/30"
                  : "bg-white dark:bg-[#161b22] border-[#d0d7de] dark:border-[#30363d] hover:border-[#656d76] dark:hover:border-[#8b949e]/60"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-bold text-sm text-[#1f2328] dark:text-[#e6edf3]">{plan.plan_code}</span>
                    {isPlanA && (
                      <span className="text-[10px] bg-emerald-50 dark:bg-[#238636]/15 text-emerald-700 dark:text-[#3fb950] font-mono px-2 py-0.5 rounded-full border border-emerald-300 dark:border-[#238636]/40 font-bold">
                        RECOMMENDED
                      </span>
                    )}
                  </div>
                  <span
                    className={`flex items-center space-x-1 text-[11px] font-mono font-bold ${
                      plan.feasible ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-rose-400"
                    }`}
                  >
                    {plan.feasible ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>FEASIBLE</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3.5 h-3.5 text-red-600 dark:text-rose-400" />
                        <span>UNFEASIBLE</span>
                      </>
                    )}
                  </span>
                </div>

                <div className="flex items-center space-x-1.5 text-[10px] font-mono text-[#656d76] dark:text-[#8b949e] mb-3">
                  <Cpu className="w-3 h-3 text-blue-600 dark:text-sky-400" />
                  <span>{plan.solver_source}</span>
                </div>

                {/* Assignment details */}
                <div className="p-3 bg-[#f6f8fa] dark:bg-[#0d1117] rounded-md border border-[#d0d7de] dark:border-[#30363d] mb-3 space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-[#656d76] dark:text-[#8b949e]">Assigned Truck:</span>
                    <strong className="text-blue-600 dark:text-sky-400">{plan.truck_id}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#656d76] dark:text-[#8b949e]">Bay Slot:</span>
                    <strong className="text-[#1f2328] dark:text-[#e6edf3]">{plan.slot_id}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#656d76] dark:text-[#8b949e]">Time Window:</span>
                    <span className="text-[#1f2328] dark:text-[#e6edf3]">16:00 - 16:30</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#656d76] dark:text-[#8b949e]">Staging Checkpoint:</span>
                    <span className="text-[#1f2328] dark:text-[#e6edf3]">{plan.checkpoint_id}</span>
                  </div>
                </div>

                <p className="text-xs text-[#1f2328] dark:text-[#e6edf3] mb-3 leading-relaxed">{plan.strategy_summary}</p>

                {/* Constraint Violations (if any) */}
                {plan.constraint_violations && plan.constraint_violations.length > 0 && (
                  <div className="p-2 bg-red-50 dark:bg-[#da3633]/15 rounded-md border border-red-200 dark:border-[#da3633]/40 mb-3 text-[11px] text-red-700 dark:text-[#f85149] font-mono">
                    <strong className="block mb-0.5 text-red-700 dark:text-[#f85149]">Violations:</strong>
                    {plan.constraint_violations.map((v, i) => (
                      <div key={i}>• {v}</div>
                    ))}
                  </div>
                )}
              </div>

              {/* Financial comparison */}
              <div className="border-t border-[#d0d7de] dark:border-[#30363d] pt-3 flex items-center justify-between text-xs font-mono">
                <div>
                  <span className="text-[10px] text-[#656d76] dark:text-[#8b949e] block font-semibold">NET EXPENSE</span>
                  <span className="font-bold text-[#1f2328] dark:text-[#e6edf3]">₹{plan.net_cost_inr.toLocaleString("en-IN")}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-400 block font-semibold">AVOIDABLE SAVINGS</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                    ₹{plan.avoidable_cost_inr.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

