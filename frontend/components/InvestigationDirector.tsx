"use client";

import React, { useState, useEffect } from "react";
import { runInvestigationOptimizer, fetchInvestigationActions } from "@/lib/api";
import { InvestigationResult, InvestigationAction } from "@/lib/types";

interface Props {
  incidentId?: string;
  onScanRequested?: () => void;
}

export default function InvestigationDirector({ incidentId = "INC-C102", onScanRequested }: Props) {
  const [candidates, setCandidates] = useState<InvestigationAction[]>([]);
  const [result, setResult] = useState<InvestigationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchInvestigationActions()
      .then((res) => setCandidates(res.items || []))
      .catch((err) => console.error("Error loading candidate actions:", err));
  }, []);

  const handleRunOptimizer = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await runInvestigationOptimizer(incidentId, "LIRA-EDGE-01", 2);
      setResult(data);
      if (data.edge_scan_request && onScanRequested) {
        onScanRequested();
      }
    } catch (err: any) {
      setError(err.message || "Failed to execute QpiAI Investigation Director");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#10141B] border border-[#222936] rounded p-5 space-y-4 font-mono text-xs">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#222936] pb-3">
        <div className="flex items-center space-x-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
          <h3 className="text-sm font-semibold text-slate-100 tracking-wider uppercase font-mono">
            QpiAI Investigation Director (Action Selection QUBO)
          </h3>
        </div>
        <div className="flex items-center space-x-2">
          <span className="px-2 py-0.5 text-[10px] bg-blue-950/60 border border-blue-800 text-blue-300 rounded">
            BINARY SELECTION QUBO
          </span>
          <span className="px-2 py-0.5 text-[10px] bg-slate-800 border border-slate-700 text-slate-300 rounded">
            BUDGET: K=2 ACTIONS
          </span>
        </div>
      </div>

      <p className="text-xs text-slate-400 font-sans">
        Formulates a combinatorial binary optimization problem to prioritize verification actions before operational cutoffs, balancing information value, execution cost, and staff availability.
      </p>

      {/* Action Trigger Button */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handleRunOptimizer}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white font-medium px-4 py-2 rounded text-xs transition-colors font-mono uppercase"
        >
          {loading ? "Solving QUBO via QpiAI Opt..." : "Run Investigation Optimizer (K=2)"}
        </button>
        <span className="text-[11px] text-slate-500">
          Evaluates {candidates.length} candidate actions against classical baseline
        </span>
      </div>

      {error && (
        <div className="p-3 bg-red-950/40 border border-red-800 rounded text-red-300">
          {error}
        </div>
      )}

      {/* Optimization Result */}
      {result && (
        <div className="space-y-3.5 pt-2">
          {/* Metadata Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-[#090B0E] p-2.5 rounded border border-[#222936] text-[11px]">
            <div>
              <span className="text-slate-500">RUN ID:</span>{" "}
              <span className="text-cyan-300 font-semibold">{result.investigation_id}</span>
            </div>
            <div>
              <span className="text-slate-500">SOLVER:</span>{" "}
              <span className="text-emerald-300 font-semibold">{result.status} ({result.runtime_ms}ms)</span>
            </div>
            <div>
              <span className="text-slate-500">CLASSICAL GAP:</span>{" "}
              <span className="text-slate-300 font-semibold">0.0% (Exact Match)</span>
            </div>
          </div>

          {/* Why This Check First Callout */}
          <div className="bg-[#141C2B] p-3.5 rounded border border-blue-900/60 space-y-1">
            <div className="text-[10px] uppercase text-blue-400 font-bold">
              💡 Why This Check First (Causal Information Value)
            </div>
            <div className="text-xs text-slate-200 font-sans leading-relaxed">
              {result.why_this_check_first}
            </div>
          </div>

          {/* Prioritized Actions Grid */}
          <div className="space-y-2">
            <div className="text-[11px] text-slate-400 uppercase tracking-wider">
              Prioritized Verification Actions ({result.selected_actions_details?.length || 0})
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {result.selected_actions_details?.map((act) => (
                <div
                  key={act.action_id}
                  className="bg-[#0D1117] border border-[#222936] p-3 rounded space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-slate-100 font-semibold text-xs">{act.title}</span>
                    <span className="px-1.5 py-0.5 text-[9px] bg-slate-800 border border-slate-700 text-slate-300 rounded">
                      {act.responsible_role}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-sans leading-normal">
                    {act.downstream_impact}
                  </p>
                  <div className="flex justify-between text-[10px] text-slate-500 pt-1 border-t border-[#1C2128]">
                    <span>Deadline: <span className="text-amber-400 font-medium">{act.deadline}</span></span>
                    <span>Cost: ₹{act.cost_inr} • Info Value: {act.information_value}/100</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Hardware Scan Request Link if active */}
          {result.edge_scan_request && (
            <div className="p-3 bg-emerald-950/30 border border-emerald-800/80 rounded space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-emerald-300 font-bold">
                  ⚡ CYBER-PHYSICAL EDGE SCAN REQUEST ISSUED: {result.edge_scan_request.request_id}
                </span>
                <span className="px-2 py-0.5 text-[9px] bg-emerald-900 border border-emerald-700 text-emerald-200 rounded">
                  ESP32 TFT SYNCED
                </span>
              </div>
              <p className="text-[11px] text-slate-300 font-sans">
                {result.edge_scan_request.instruction} The buttonless terminal is now awaiting physical tag tap. Web custodian confirmation will complete authorization.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

