"use client";

import React, { useState, useEffect } from "react";
import { Workflow, Layers, RefreshCw } from "lucide-react";
import { fetchRecoveryAlternatives } from "@/lib/api";
import { PlanAlternative } from "@/lib/types";
import PlanComparison from "@/components/PlanComparison";
import ApprovalPanel from "@/components/ApprovalPanel";
import CaseExplorer from "@/components/CaseExplorer";

export default function RecoveryStudioPage() {
  const [activeTab, setActiveTab] = useState<"CASE_EXPLORER" | "INCIDENT_STUDIO">("CASE_EXPLORER");
  const [incidentId, setIncidentId] = useState("INC-C102");
  const [alternatives, setAlternatives] = useState<PlanAlternative[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<PlanAlternative | null>(null);
  const [doNothingCost, setDoNothingCost] = useState<number>(36000);
  const [loading, setLoading] = useState(true);

  const loadAlternatives = async (incId: string) => {
    try {
      setLoading(true);
      const res = await fetchRecoveryAlternatives(incId);
      const alts = res.alternatives || [];
      setAlternatives(alts);
      setDoNothingCost(res.do_nothing_cost_inr || 36000);
      if (alts.length > 0) {
        setSelectedPlan(alts[0]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlternatives(incidentId);
  }, [incidentId]);

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-mono text-xs px-2 py-0.5 rounded-xs bg-[#067A9B]/10 text-[#067A9B] dark:text-[#39C9DF] border border-[#067A9B]/30 font-bold">
              RECOVERY STUDIO
            </span>
            <span className="text-xs text-[#516678] dark:text-[#9FB5C5] font-mono">
              QpiAI Decision Support & Exception Resolution
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#102235] dark:text-[#EAF3F8] font-mono tracking-tight mt-1">
            Recovery Studio & Freight Exception Explorer
          </h1>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-[#F3F6FA] dark:bg-[#0B1420] border border-[#D9E3EB] dark:border-[#294355] rounded-xs p-1 font-mono text-xs">
          <button
            onClick={() => setActiveTab("CASE_EXPLORER")}
            className={`px-3 py-1.5 rounded-xs transition-colors flex items-center space-x-1.5 ${
              activeTab === "CASE_EXPLORER"
                ? "bg-[#067A9B] dark:bg-[#39C9DF] text-white dark:text-[#0B1420] font-bold shadow-xs"
                : "text-[#516678] dark:text-[#9FB5C5] hover:text-[#102235] dark:hover:text-[#EAF3F8]"
            }`}
          >
            <Workflow className="w-3.5 h-3.5" />
            <span>C1–C6 Exception Explorer</span>
          </button>
          <button
            onClick={() => setActiveTab("INCIDENT_STUDIO")}
            className={`px-3 py-1.5 rounded-xs transition-colors flex items-center space-x-1.5 ${
              activeTab === "INCIDENT_STUDIO"
                ? "bg-[#067A9B] dark:bg-[#39C9DF] text-white dark:text-[#0B1420] font-bold shadow-xs"
                : "text-[#516678] dark:text-[#9FB5C5] hover:text-[#102235] dark:hover:text-[#EAF3F8]"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Active Incident Bundles</span>
          </button>
        </div>
      </div>

      {/* Tab 1: C1-C6 Exception Explorer */}
      {activeTab === "CASE_EXPLORER" && <CaseExplorer />}

      {/* Tab 2: Incident Studio */}
      {activeTab === "INCIDENT_STUDIO" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-white dark:bg-[#111F2E] p-3.5 rounded-xs border border-[#D9E3EB] dark:border-[#294355]">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono text-[#516678] dark:text-[#9FB5C5]">Select Incident:</span>
              <select
                value={incidentId}
                onChange={(e) => setIncidentId(e.target.value)}
                className="text-xs font-mono bg-[#F3F6FA] dark:bg-[#0B1420] border border-[#D9E3EB] dark:border-[#294355] rounded-xs px-2.5 py-1 text-[#102235] dark:text-[#EAF3F8]"
              >
                <option value="INC-C102">Container C102 (Slot S1600)</option>
                <option value="INC-C105">Container C105 (Slot S1630)</option>
              </select>
            </div>

            <button
              onClick={() => loadAlternatives(incidentId)}
              className="flex items-center space-x-1.5 px-3 py-1 bg-[#F3F6FA] dark:bg-[#0B1420] border border-[#D9E3EB] dark:border-[#294355] text-[#102235] dark:text-[#EAF3F8] rounded-xs text-xs font-mono transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#067A9B] dark:text-[#39C9DF]" : ""}`} />
              <span>Re-solve</span>
            </button>
          </div>

          <PlanComparison
            alternatives={alternatives}
            selectedPlanId={selectedPlan?.plan_id || null}
            onSelectPlan={(p) => setSelectedPlan(p)}
            doNothingCost={doNothingCost}
          />

          <ApprovalPanel
            plan={selectedPlan}
            onPlanApproved={() => {
              loadAlternatives(incidentId);
            }}
          />
        </div>
      )}
    </div>
  );
}
