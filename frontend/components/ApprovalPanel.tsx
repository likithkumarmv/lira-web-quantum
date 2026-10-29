"use client";

import React, { useState } from "react";
import { CheckCircle2, ShieldCheck, Send, AlertOctagon, Smartphone, Tv } from "lucide-react";
import { approvePlan } from "@/lib/api";
import { PlanAlternative } from "@/lib/types";

interface ApprovalPanelProps {
  plan: PlanAlternative | null;
  onPlanApproved?: (result: any) => void;
}

export default function ApprovalPanel({ plan, onPlanApproved }: ApprovalPanelProps) {
  const [reason, setReason] = useState("Optimal recovery plan resolving driver conflict and avoiding demurrage deadline.");
  const [approving, setApproving] = useState(false);
  const [approvedResult, setApprovedResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleApprove = async () => {
    if (!plan) return;
    try {
      setApproving(true);
      setError(null);
      const res = await approvePlan(plan.plan_id, reason, "DISPATCHER");
      setApprovedResult(res);
      if (onPlanApproved) onPlanApproved(res);
    } catch (e: any) {
      setError(e.message || "Failed to approve plan");
    } finally {
      setApproving(false);
    }
  };

  if (!plan) {
    return (
      <div className="bg-white dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d] rounded-xl p-5 text-center text-[#656d76] dark:text-[#8b949e] font-mono text-xs shadow-sm">
        Select a recovery plan from above to inspect and execute dispatcher approval.
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d] rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <h3 className="font-mono text-sm font-bold text-[#1f2328] dark:text-[#e6edf3] uppercase tracking-wide">
            Dispatcher Authorization & Push Gateway
          </h3>
        </div>
        <span className="text-xs font-mono text-[#656d76] dark:text-[#8b949e]">
          Target: <strong className="text-blue-600 dark:text-sky-400">{plan.plan_code}</strong> ({plan.plan_id})
        </span>
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-[#da3633]/15 border border-red-200 dark:border-[#da3633]/40 text-red-700 dark:text-[#f85149] rounded-lg text-xs font-mono mb-4 flex items-center space-x-2">
          <AlertOctagon className="w-4 h-4 shrink-0 text-red-600 dark:text-[#f85149]" />
          <span>{error}</span>
        </div>
      )}

      {approvedResult ? (
        <div className="p-4 bg-emerald-50 dark:bg-[#238636]/15 border border-emerald-200 dark:border-[#238636]/40 rounded-lg text-xs font-mono space-y-3">
          <div className="flex items-center space-x-2 text-emerald-700 dark:text-[#3fb950] font-bold text-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-[#3fb950]" />
            <span>Plan Successfully Authorized & Pushed!</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-[#1f2328] dark:text-[#e6edf3]">
            <div className="p-2.5 bg-white dark:bg-[#0d1117] rounded-md border border-[#d0d7de] dark:border-[#30363d] flex items-center space-x-2">
              <Smartphone className="w-4 h-4 text-blue-600 dark:text-sky-400" />
              <div>
                <span className="block text-[10px] text-[#656d76] dark:text-[#8b949e]">ANDROID DRIVER APP</span>
                <span className="font-bold text-blue-600 dark:text-sky-400">Dispatched (Truck {plan.truck_id})</span>
              </div>
            </div>

            <div className="p-2.5 bg-white dark:bg-[#0d1117] rounded-md border border-[#d0d7de] dark:border-[#30363d] flex items-center space-x-2">
              <Tv className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <div>
                <span className="block text-[10px] text-[#656d76] dark:text-[#8b949e]">ESP32 TFT DISPLAY</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">Updated (LIRA-EDGE-01)</span>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-[#656d76] dark:text-[#8b949e]">
            {approvedResult.message || "Approved plan is now the active operational instruction across mobile and edge."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-[#656d76] dark:text-[#8b949e] mb-1.5 font-semibold">
              DISPATCHER APPROVAL REASON / AUDIT JUSTIFICATION:
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-[#f6f8fa] dark:bg-[#0d1117] border border-[#d0d7de] dark:border-[#30363d] rounded-md px-3 py-2 text-xs text-[#1f2328] dark:text-[#e6edf3] font-mono focus:outline-none focus:border-blue-500 shadow-sm"
              placeholder="Enter authorization justification..."
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="text-[11px] font-mono text-[#656d76] dark:text-[#8b949e]">
              Assigned Truck: <strong className="text-[#1f2328] dark:text-[#e6edf3]">{plan.truck_id}</strong> | Slot:{" "}
              <strong className="text-[#1f2328] dark:text-[#e6edf3]">{plan.slot_id}</strong>
            </div>

            <button
              onClick={handleApprove}
              disabled={approving || !plan.feasible}
              className={`px-5 py-2 rounded-md text-xs font-mono font-bold flex items-center space-x-2 transition shadow-sm ${
                plan.feasible
                  ? "bg-[#2da44e] hover:bg-[#2c974b] text-white border border-[#2c974b]"
                  : "bg-gray-100 dark:bg-[#21262d] text-[#8b949e] cursor-not-allowed border border-[#d0d7de] dark:border-[#30363d]"
              }`}
            >
              <Send className="w-4 h-4" />
              <span>{approving ? "Authorizing..." : "Approve & Push to Android + TFT"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

