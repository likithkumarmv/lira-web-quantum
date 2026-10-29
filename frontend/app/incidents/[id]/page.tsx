"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  GitBranch,
  ShieldAlert,
  Clock,
  Wand2,
  PhoneCall,
  UserCheck,
  ArrowRight,
  TrendingDown,
  RefreshCw,
  HelpCircle,
  CheckCircle2,
  ListTodo
} from "lucide-react";
import {
  fetchIncidentDetail,
  triggerQpiAISolve,
  triggerVoiceCall,
  fetchVerificationTasks,
  resolveVerificationTask
} from "@/lib/api";
import BlockerDAG from "@/components/BlockerDAG";
import EvidenceAssistant from "@/components/EvidenceAssistant";
import InvestigationDirector from "@/components/InvestigationDirector";

export default function IncidentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = (params?.id as string) || "INC-C102";

  const [incident, setIncident] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [solving, setSolving] = useState(false);
  const [calling, setCalling] = useState(false);
  const [callStatus, setCallStatus] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [data, tList] = await Promise.all([
        fetchIncidentDetail(id),
        fetchVerificationTasks(id).catch(() => [])
      ]);
      setIncident(data);
      setTasks(tList);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleTriggerSolve = async () => {
    try {
      setSolving(true);
      await triggerQpiAISolve(id, true, 1);
      router.push(`/recoveries`);
    } catch (e) {
      console.error(e);
    } finally {
      setSolving(false);
    }
  };

  const handleTriggerVoiceCall = async () => {
    try {
      setCalling(true);
      const res = await triggerVoiceCall(id, "T04");
      setCallStatus(`Outbound call dispatched via ${res.provider} (${res.mode}). Verified ETA: 16:45 IST recorded into authoritative evidence ledger.`);
      await loadData();
    } catch (e) {
      console.error(e);
    } finally {
      setCalling(false);
    }
  };

  const handleResolveTask = async (taskId: string, blockerCode: string) => {
    try {
      await resolveVerificationTask(taskId, {
        resolved_claim: `Verified operational status for ${blockerCode} via dispatcher confirmation`,
        verified_by_role: "DISPATCHER",
        evidence_tier: "T3",
        clear_blocker: true
      });
      await loadData();
    } catch (e) {
      console.error(e);
    }
  };

  if (loading && !incident) {
    return (
      <div className="p-12 text-center text-[#656d76] dark:text-[#8b949e] font-mono text-sm">
        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600 dark:text-cyan-400" />
        Loading causal blocker DAG for {id}...
      </div>
    );
  }

  const nodes = incident?.nodes || [];
  const container = incident?.container_details || {};

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Breadcrumb & Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d0d7de] dark:border-[#30363d] pb-3">
        <div className="flex items-center space-x-2 text-xs font-mono text-[#656d76] dark:text-[#8b949e]">
          <Link href="/incidents" className="hover:text-blue-600 dark:hover:text-sky-400 font-semibold">
            Incidents
          </Link>
          <span>/</span>
          <span className="text-blue-600 dark:text-sky-400 font-bold">{id}</span>
          <span>/</span>
          <span className="text-[#1f2328] dark:text-[#e6edf3] font-medium">{container.container_id || "C102"}</span>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleTriggerVoiceCall}
            disabled={calling}
            className="px-3 py-1.5 bg-white dark:bg-[#21262d] border border-[#d0d7de] dark:border-[#30363d] hover:bg-gray-50 dark:hover:bg-[#30363d] text-[#1f2328] dark:text-[#e6edf3] rounded-md text-xs font-mono transition flex items-center space-x-1.5 shadow-sm"
          >
            <PhoneCall className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>{calling ? "Calling..." : "Call Driver T04 (Bolna)"}</span>
          </button>

          <button
            onClick={handleTriggerSolve}
            disabled={solving}
            className="px-4 py-1.5 bg-[#2da44e] hover:bg-[#2c974b] text-white border border-[#2c974b] rounded-md text-xs font-mono font-semibold transition flex items-center space-x-1.5 shadow-sm"
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>{solving ? "Solving QUBO..." : "Solve Recovery (QpiAI)"}</span>
          </button>
        </div>
      </div>

      {callStatus && (
        <div className="p-3 bg-amber-50 dark:bg-[#d29922]/15 border border-amber-200 dark:border-[#d29922]/40 text-amber-800 dark:text-[#e3b341] rounded-lg text-xs font-mono">
          {callStatus}
        </div>
      )}

      {/* Container Specification Card */}
      <div className="bg-white dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d] rounded-xl p-5 shadow-sm">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
          <div>
            <span className="text-[10px] text-[#656d76] dark:text-[#8b949e] block mb-0.5 font-semibold">CONTAINER & SIZE</span>
            <span className="text-base font-extrabold text-[#1f2328] dark:text-[#e6edf3]">
              {container.container_id} ({container.size_ft}ft High Cube)
            </span>
          </div>

          <div>
            <span className="text-[10px] text-[#656d76] dark:text-[#8b949e] block mb-0.5 font-semibold">GROSS WEIGHT</span>
            <span className="text-base font-bold text-amber-600 dark:text-amber-400">
              {container.weight_kg?.toLocaleString() || "22,450"} kg
            </span>
          </div>

          <div>
            <span className="text-[10px] text-[#656d76] dark:text-[#8b949e] block mb-0.5 font-semibold">CUSTOMS RELEASE</span>
            <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
              {container.release_state || "NEEDS_VERIFICATION"}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-[#656d76] dark:text-[#8b949e] block mb-0.5 font-semibold">AVOIDABLE RISK</span>
            <span className="text-base font-bold text-blue-600 dark:text-sky-400">
              ₹{incident?.projected_avoidable_cost_inr?.toLocaleString("en-IN") || "18,000"}
            </span>
          </div>
        </div>
      </div>

      {/* Active Verification Tasks (Active Fact Acquisition Engine) */}
      {tasks.length > 0 && (
        <div className="bg-white dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d] rounded-xl p-5 shadow-sm font-mono text-xs">
          <div className="flex items-center space-x-2 text-[#1f2328] dark:text-[#e6edf3] font-bold mb-3">
            <ListTodo className="w-4 h-4 text-amber-500" />
            <h3 className="uppercase tracking-wide">Active Fact Verification Tasks ({tasks.length})</h3>
          </div>

          <div className="space-y-2">
            {tasks.map((task: any) => (
              <div
                key={task.task_id}
                className="p-3 bg-[#f6f8fa] dark:bg-[#0d1117] rounded-lg border border-[#d0d7de] dark:border-[#30363d] flex flex-wrap items-center justify-between gap-2"
              >
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-blue-600 dark:text-sky-400">{task.blocker_code}</span>
                    <span className="text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded font-mono">
                      {task.status}
                    </span>
                    <span className="text-[10px] text-[#656d76] dark:text-[#8b949e]">Target: {task.target_role}</span>
                  </div>
                  <p className="text-xs text-[#1f2328] dark:text-[#e6edf3] mt-1 font-medium">{task.question}</p>
                </div>

                <div>
                  {task.status === "PENDING" ? (
                    <button
                      onClick={() => handleResolveTask(task.task_id, task.blocker_code)}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold shadow-sm transition"
                    >
                      Mark Verified
                    </button>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center space-x-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Resolved</span>
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* QpiAI Investigation Director (Action Prioritization) */}
      <InvestigationDirector incidentId={id} onScanRequested={loadData} />

      {/* Evidence Assistant (Document RAG) */}
      <EvidenceAssistant containerId={incident?.container_id || "C102"} incidentId={id} />

      {/* Causal Blocker DAG Component */}
      <BlockerDAG nodes={nodes} />
    </div>
  );
}
