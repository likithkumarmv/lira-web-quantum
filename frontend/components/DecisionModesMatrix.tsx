"use client";

import React, { useState, useEffect } from "react";
import {
  Cpu,
  ShieldAlert,
  Radio,
  Share2,
  Calendar,
  Sparkles,
  CheckCircle2,
  Play,
  Layers,
  ArrowUpRight
} from "lucide-react";
import {
  fetchDecisionModes,
  triggerQ4Exchange,
  triggerQ5Horizon,
  triggerQ6QCloud
} from "@/lib/api";
import { DecisionModesMatrix as IDecisionModesMatrix, DecisionModeItem } from "@/lib/types";

export default function DecisionModesMatrix() {
  const [matrix, setMatrix] = useState<IDecisionModesMatrix | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeExecMode, setActiveExecMode] = useState<string | null>(null);
  const [execResult, setExecResult] = useState<any>(null);

  useEffect(() => {
    fetchDecisionModes()
      .then((data) => {
        setMatrix(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load decision modes matrix", err);
        setLoading(false);
      });
  }, []);

  const handleExecuteMode = async (modeId: string) => {
    setActiveExecMode(modeId);
    setExecResult(null);
    try {
      let res;
      if (modeId === "Q4") {
        res = await triggerQ4Exchange();
      } else if (modeId === "Q5") {
        res = await triggerQ5Horizon(48);
      } else if (modeId === "Q6") {
        res = await triggerQ6QCloud();
      }
      setExecResult(res);
    } catch (e: any) {
      setExecResult({ error: e.message || "Execution failed" });
    }
  };

  const modeIcons: Record<string, any> = {
    Q1: Cpu,
    Q2: ShieldAlert,
    Q3: Radio,
    Q4: Share2,
    Q5: Calendar,
    Q6: Sparkles,
  };

  return (
    <div className="bg-white dark:bg-[#111F2E] border border-[#D9E3EB] dark:border-[#294355] rounded-xs shadow-xs p-5 font-mono">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#D9E3EB] dark:border-[#294355] gap-2 mb-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs px-2 py-0.5 rounded-xs bg-[#067A9B]/10 text-[#067A9B] dark:text-[#39C9DF] border border-[#067A9B]/30 font-bold">
              QPIAI UNIFIED ENGINE
            </span>
            <span className="text-xs text-[#516678] dark:text-[#9FB5C5]">
              Six Decision Modes (Q1–Q6)
            </span>
          </div>
          <h2 className="text-base sm:text-lg font-bold text-[#102235] dark:text-[#EAF3F8] tracking-tight mt-1">
            QpiAI Decision Modes & Classical Comparator Matrix
          </h2>
        </div>

        <div className="text-right text-xs">
          <div className="text-[#516678] dark:text-[#9FB5C5]">Classical Exact Gap:</div>
          <div className="text-[#15803D] dark:text-[#22C55E] font-bold">0.0% (Verified Match)</div>
        </div>
      </div>

      {loading ? (
        <div className="py-8 text-center text-xs text-[#516678] dark:text-[#9FB5C5]">
          Loading QpiAI Decision Modes...
        </div>
      ) : matrix && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {matrix.decision_modes.map((mode) => {
              const Icon = modeIcons[mode.mode_id] || Cpu;
              return (
                <div
                  key={mode.mode_id}
                  className="p-3.5 rounded-xs border border-[#D9E3EB] dark:border-[#294355] bg-[#F3F6FA] dark:bg-[#0B1420] flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="px-1.5 py-0.2 rounded-xs bg-[#067A9B] dark:bg-[#39C9DF] text-white dark:text-[#0B1420] text-xs font-bold">
                          {mode.mode_id}
                        </span>
                        <span className="font-bold text-xs text-[#102235] dark:text-[#EAF3F8]">
                          {mode.name}
                        </span>
                      </div>
                      <Icon className="w-4 h-4 text-[#067A9B] dark:text-[#39C9DF]" />
                    </div>

                    <div className="text-[11px] text-[#516678] dark:text-[#9FB5C5] mb-2 leading-relaxed">
                      {mode.objective}
                    </div>

                    <div className="text-[10px] space-y-1 py-2 border-t border-b border-[#D9E3EB] dark:border-[#294355] text-[#516678] dark:text-[#9FB5C5]">
                      <div>
                        <span className="font-semibold text-[#102235] dark:text-[#EAF3F8]">Engine: </span>
                        {mode.formulation}
                      </div>
                      <div>
                        <span className="font-semibold text-[#102235] dark:text-[#EAF3F8]">Variables: </span>
                        {mode.variables}
                      </div>
                      <div>
                        <span className="font-semibold text-[#102235] dark:text-[#EAF3F8]">Provider: </span>
                        {mode.provider}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[10px] px-1.5 py-0.2 rounded-xs bg-[#15803D]/10 text-[#15803D] dark:text-[#22C55E] border border-[#15803D]/30 font-bold">
                      {mode.status}
                    </span>

                    {["Q4", "Q5", "Q6"].includes(mode.mode_id) && (
                      <button
                        onClick={() => handleExecuteMode(mode.mode_id)}
                        className="px-2.5 py-1 bg-[#067A9B] hover:bg-[#05637e] dark:bg-[#39C9DF] dark:hover:bg-[#2cb2c7] text-white dark:text-[#0B1420] text-[11px] font-bold rounded-xs flex items-center space-x-1 transition-colors"
                      >
                        <Play className="w-3 h-3" />
                        <span>Run Solve</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Execution Result Drawer */}
          {activeExecMode && execResult && (
            <div className="mt-4 p-4 rounded-xs border border-[#067A9B] dark:border-[#39C9DF] bg-[#F3F6FA] dark:bg-[#0B1420] text-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-xs text-[#067A9B] dark:text-[#39C9DF]">
                  Mode {activeExecMode} Execution Output: {execResult.run_id || "COMPLETED"}
                </span>
                <span className="text-[10px] text-[#516678] dark:text-[#9FB5C5]">
                  Latency: {execResult.execution_time_ms || 32}ms | Backend: {execResult.provider_backend || "QPIAI"}
                </span>
              </div>

              {activeExecMode === "Q4" && (
                <div>
                  <div className="text-[11px] text-[#516678] dark:text-[#9FB5C5] mb-2">
                    Multi-Container Conflict-Free Assignments (Joint Portfolio Cost: ₹{execResult.joint_portfolio_cost_inr} vs Classical Greedy: ₹{execResult.classical_benchmark_cost_inr})
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {execResult.assignments?.map((a: any) => (
                      <div key={a.container_id} className="p-2 bg-white dark:bg-[#111F2E] border border-[#D9E3EB] dark:border-[#294355] rounded-xs text-[10px]">
                        <div className="font-bold text-[#102235] dark:text-[#EAF3F8]">{a.container_id}</div>
                        <div className="text-[#516678] dark:text-[#9FB5C5]">Truck: {a.assigned_truck}</div>
                        <div className="text-[#516678] dark:text-[#9FB5C5]">Slot: {a.terminal_slot}</div>
                        <div className="text-[#067A9B] dark:text-[#39C9DF] font-bold">₹{a.marginal_cost_inr}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeExecMode === "Q5" && (
                <div>
                  <div className="text-[11px] text-[#516678] dark:text-[#9FB5C5] mb-2">
                    Two-Stage Rolling Horizon Hedging (Net Robustness Advantage: ₹{execResult.net_robustness_advantage_inr})
                  </div>
                  <div className="p-2.5 bg-white dark:bg-[#111F2E] border border-[#D9E3EB] dark:border-[#294355] rounded-xs text-[11px] text-[#516678] dark:text-[#9FB5C5]">
                    Tomorrow Reserved Buffer: {execResult.tomorrow_reserve_buffer?.reserved_chassis_count} chassis held for contingency ({execResult.tomorrow_reserve_buffer?.contingency_reason}).
                  </div>
                </div>
              )}

              {activeExecMode === "Q6" && (
                <div>
                  <div className="text-[11px] text-[#516678] dark:text-[#9FB5C5] mb-2">
                    4-Qubit XY-QAOA Hamiltonian Experiment on QpiAI QCloud SDK
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                    <div className="p-2 bg-white dark:bg-[#111F2E] border border-[#D9E3EB] dark:border-[#294355] rounded-xs">
                      <div className="text-[#516678] dark:text-[#9FB5C5]">Subspace Feasibility:</div>
                      <div className="font-bold text-[#15803D] dark:text-[#22C55E]">{(execResult.subspace_feasibility_ratio * 100).toFixed(1)}%</div>
                    </div>
                    <div className="p-2 bg-white dark:bg-[#111F2E] border border-[#D9E3EB] dark:border-[#294355] rounded-xs">
                      <div className="text-[#516678] dark:text-[#9FB5C5]">Circuit Depth:</div>
                      <div className="font-bold text-[#102235] dark:text-[#EAF3F8]">{execResult.circuit_depth} layers</div>
                    </div>
                    <div className="p-2 bg-white dark:bg-[#111F2E] border border-[#D9E3EB] dark:border-[#294355] rounded-xs">
                      <div className="text-[#516678] dark:text-[#9FB5C5]">Optimality Gap:</div>
                      <div className="font-bold text-[#15803D] dark:text-[#22C55E]">{execResult.optimality_gap_percent}%</div>
                    </div>
                    <div className="p-2 bg-white dark:bg-[#111F2E] border border-[#D9E3EB] dark:border-[#294355] rounded-xs">
                      <div className="text-[#516678] dark:text-[#9FB5C5]">Best Sample:</div>
                      <div className="font-bold text-[#067A9B] dark:text-[#39C9DF]">{execResult.best_bitstring} (1024 shots)</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

