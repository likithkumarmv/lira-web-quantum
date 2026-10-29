"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Clock,
  TrendingDown,
  ArrowRight,
  RefreshCw,
  Layers,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  Smartphone,
  Cpu,
  CloudRain,
  PhoneCall,
  Radio
} from "lucide-react";
import { fetchIncidents, fetchEdgeState, fetchOverviewMetrics, fetchHealth } from "@/lib/api";
import { Incident, EdgeTFTState } from "@/lib/types";
import TFTMirror from "@/components/TFTMirror";
import RiskCorridorStrip from "@/components/RiskCorridorStrip";

export default function OperationsOverview() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [edgeState, setEdgeState] = useState<EdgeTFTState | null>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [systemHealth, setSystemHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const [incs, edge, m, h] = await Promise.all([
        fetchIncidents(),
        fetchEdgeState().catch(() => null),
        fetchOverviewMetrics().catch(() => null),
        fetchHealth().catch(() => null)
      ]);
      setIncidents(incs);
      if (edge) setEdgeState(edge);
      if (m) setMetrics(m);
      if (h) setSystemHealth(h);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
    const interval = setInterval(loadDashboard, 6000);
    return () => clearInterval(interval);
  }, []);

  const totalAvoidableCost =
    metrics?.estimated_avoidable_cost_inr ??
    incidents.reduce((acc, inc) => acc + (inc.projected_avoidable_cost_inr || 0), 0);
  const totalDoNothingCost =
    metrics?.do_nothing_cost_inr ??
    incidents.reduce((acc, inc) => acc + (inc.do_nothing_cost_inr || 0), 0);

  return (
    <div className="space-y-5 max-w-7xl mx-auto font-mono">
      {/* Top Banner with Key Operational Metrics */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 border-b border-[#D9E3EB] dark:border-[#294355] gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs px-2 py-0.5 rounded-xs bg-[#067A9B]/10 text-[#067A9B] dark:text-[#39C9DF] border border-[#067A9B]/30 font-bold shrink-0 whitespace-nowrap">
              JNPA NHAVA SHEVA SECTOR
            </span>
            <span className="text-xs text-[#516678] dark:text-[#9FB5C5] truncate">
              Real-time Causal Blocker DAG & Cyber-Physical ResourceLock
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#102235] dark:text-[#EAF3F8] tracking-tight mt-1">
            Operations Command Console
          </h1>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-nowrap self-start md:self-center">
          <div className="inline-flex items-center h-8 gap-2 text-xs font-mono text-[#516678] dark:text-[#9FB5C5] bg-[#F3F6FA] dark:bg-[#0B1420] px-3 rounded-xs border border-[#D9E3EB] dark:border-[#294355] shrink-0 whitespace-nowrap leading-none select-none">
            <span className="whitespace-nowrap">Freshness:</span>
            <span className="text-[#15803D] dark:text-[#22C55E] font-semibold whitespace-nowrap">&lt; 2s</span>
            <span className="text-[#D9E3EB] dark:text-[#294355] px-0.5 select-none" aria-hidden="true">|</span>
            <span className="whitespace-nowrap">Bolna AI:</span>
            <span className="px-1.5 py-0.5 rounded-xs bg-[#15803D]/10 text-[#15803D] dark:text-[#22C55E] border border-[#15803D]/30 font-bold text-[10px] tracking-wide whitespace-nowrap">
              {systemHealth?.bolna_agent_status || "READY"}
            </span>
          </div>

          <button
            onClick={loadDashboard}
            aria-label="Refresh dashboard data"
            className="inline-flex items-center h-8 gap-1.5 px-3 bg-[#F3F6FA] dark:bg-[#0B1420] border border-[#D9E3EB] dark:border-[#294355] hover:bg-[#E3EBF2] dark:hover:bg-[#111F2E] text-[#102235] dark:text-[#EAF3F8] rounded-xs text-xs font-mono font-medium transition shrink-0 whitespace-nowrap"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 shrink-0 ${loading ? "animate-spin text-[#067A9B] dark:text-[#39C9DF]" : "text-[#516678] dark:text-[#9FB5C5]"}`}
              aria-hidden="true"
            />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Real-Time Live Weather & Highway Risk Strip */}
      <RiskCorridorStrip />

      {/* Primary KPI Highlight Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        {/* Card 1: Projected Avoidable Cost */}
        <div className="bg-white dark:bg-[#111F2E] border border-[#D9E3EB] dark:border-[#294355] rounded-xs p-4 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-[#516678] dark:text-[#9FB5C5] font-semibold">
              PROJECTED AVOIDABLE COST
            </span>
            <TrendingDown className="w-4 h-4 text-[#15803D] dark:text-[#22C55E]" aria-hidden="true" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-[#15803D] dark:text-[#22C55E]">
            ₹{totalAvoidableCost.toLocaleString("en-IN")}
          </div>
          <div className="text-[10px] text-[#516678] dark:text-[#9FB5C5] mt-1">
            Against ₹{totalDoNothingCost.toLocaleString("en-IN")} baseline risk
          </div>
        </div>

        {/* Card 2: Next Cutoff Deadline */}
        <div className="bg-white dark:bg-[#111F2E] border border-[#D9E3EB] dark:border-[#294355] rounded-xs p-4 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-[#516678] dark:text-[#9FB5C5] font-semibold">
              IMMINENT CLIFF DEADLINE
            </span>
            <Clock className="w-4 h-4 text-[#B45309] dark:text-[#F59E0B]" aria-hidden="true" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-[#B45309] dark:text-[#F59E0B]">
            16:30 IST
          </div>
          <div className="text-[10px] text-[#516678] dark:text-[#9FB5C5] mt-1">
            {metrics?.containers_nearing_deadline ?? 1} container nearing free-time cliff
          </div>
        </div>

        {/* Card 3: Active Blocker Count */}
        <div className="bg-white dark:bg-[#111F2E] border border-[#D9E3EB] dark:border-[#294355] rounded-xs p-4 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-[#516678] dark:text-[#9FB5C5] font-semibold">
              CONTAINERS BLOCKED
            </span>
            <AlertTriangle className="w-4 h-4 text-[#B91C1C] dark:text-[#EF4444]" aria-hidden="true" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-[#102235] dark:text-[#EAF3F8]">
            {metrics?.containers_blocked ?? incidents.length} Box
          </div>
          <div className="text-[10px] text-[#516678] dark:text-[#9FB5C5] mt-1">
            {metrics?.containers_awaiting_verification ?? 1} Awaiting Verification
          </div>
        </div>

        {/* Card 4: Hardware Checkpoint State */}
        <div className="bg-white dark:bg-[#111F2E] border border-[#D9E3EB] dark:border-[#294355] rounded-xs p-4 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-[#516678] dark:text-[#9FB5C5] font-semibold">
              BUTTONLESS RC522 CHECKPOINT
            </span>
            <Radio className="w-4 h-4 text-[#067A9B] dark:text-[#39C9DF]" aria-hidden="true" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-[#067A9B] dark:text-[#39C9DF]">
            {edgeState?.physical_state || "EXPECTED"}
          </div>
          <div className="text-[10px] text-[#516678] dark:text-[#9FB5C5] mt-1">
            Device: LIRA-EDGE-01 (ESP32 DevKit V1)
          </div>
        </div>
      </div>

      {/* Secondary Operational Cadence Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
        <div className="p-2.5 bg-white dark:bg-[#111F2E] border border-[#D9E3EB] dark:border-[#294355] rounded-xs">
          <div className="flex items-center justify-between text-[#516678] dark:text-[#9FB5C5] mb-0.5 text-[10px]">
            <span>ACTIVE BOXES</span>
            <Layers className="w-3 h-3 text-[#067A9B] dark:text-[#39C9DF]" />
          </div>
          <span className="text-sm font-bold text-[#102235] dark:text-[#EAF3F8]">
            {metrics?.total_active_containers ?? 6}
          </span>
        </div>

        <div className="p-2.5 bg-white dark:bg-[#111F2E] border border-[#D9E3EB] dark:border-[#294355] rounded-xs">
          <div className="flex items-center justify-between text-[#516678] dark:text-[#9FB5C5] mb-0.5 text-[10px]">
            <span>APPROVED PLANS</span>
            <CheckCircle2 className="w-3 h-3 text-[#15803D] dark:text-[#22C55E]" />
          </div>
          <span className="text-sm font-bold text-[#15803D] dark:text-[#22C55E]">
            {metrics?.approved_recovery_actions ?? 1}
          </span>
        </div>

        <div className="p-2.5 bg-white dark:bg-[#111F2E] border border-[#D9E3EB] dark:border-[#294355] rounded-xs">
          <div className="flex items-center justify-between text-[#516678] dark:text-[#9FB5C5] mb-0.5 text-[10px]">
            <span>DRIVER ACKS</span>
            <Smartphone className="w-3 h-3 text-[#067A9B] dark:text-[#39C9DF]" />
          </div>
          <span className="text-sm font-bold text-[#067A9B] dark:text-[#39C9DF]">
            {metrics?.driver_acknowledgements_pending ?? 0} Pending
          </span>
        </div>

        <div className="p-2.5 bg-white dark:bg-[#111F2E] border border-[#D9E3EB] dark:border-[#294355] rounded-xs">
          <div className="flex items-center justify-between text-[#516678] dark:text-[#9FB5C5] mb-0.5 text-[10px]">
            <span>BOLNA AI AGENT</span>
            <PhoneCall className="w-3 h-3 text-[#15803D] dark:text-[#22C55E]" />
          </div>
          <span className="text-sm font-bold text-[#15803D] dark:text-[#22C55E]">
            {systemHealth?.bolna_agent_status || "READY"}
          </span>
        </div>

        <div className="p-2.5 bg-white dark:bg-[#111F2E] border border-[#D9E3EB] dark:border-[#294355] rounded-xs">
          <div className="flex items-center justify-between text-[#516678] dark:text-[#9FB5C5] mb-0.5 text-[10px]">
            <span>QPIAI MODES</span>
            <Cpu className="w-3 h-3 text-[#067A9B] dark:text-[#39C9DF]" />
          </div>
          <span className="text-sm font-bold text-[#067A9B] dark:text-[#39C9DF]">
            Q1–Q6 Active
          </span>
        </div>

        <div className="p-2.5 bg-white dark:bg-[#111F2E] border border-[#D9E3EB] dark:border-[#294355] rounded-xs">
          <div className="flex items-center justify-between text-[#516678] dark:text-[#9FB5C5] mb-0.5 text-[10px]">
            <span>DISRUPTIONS</span>
            <CloudRain className="w-3 h-3 text-[#B45309] dark:text-[#F59E0B]" />
          </div>
          <span className="text-sm font-bold text-[#B45309] dark:text-[#F59E0B]">
            {metrics?.current_disruption_warnings ?? 1} Active
          </span>
        </div>
      </div>

      {/* Main Grid: Active Incidents Queue + TFT Screen Mirror */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left 2 Cols: Active Freight Exceptions Queue */}
        <div className="lg:col-span-2 bg-white dark:bg-[#111F2E] border border-[#D9E3EB] dark:border-[#294355] rounded-xs p-4 shadow-xs">
          <div className="flex items-center justify-between mb-3 border-b border-[#D9E3EB] dark:border-[#294355] pb-2">
            <div className="flex items-center space-x-2">
              <Layers className="w-4 h-4 text-[#067A9B] dark:text-[#39C9DF]" />
              <h2 className="text-xs font-bold text-[#102235] dark:text-[#EAF3F8] uppercase tracking-wide">
                Active Freight Exceptions Queue (Root Blockers)
              </h2>
            </div>
            <Link
              href="/incidents"
              className="text-xs text-[#067A9B] dark:text-[#39C9DF] hover:underline flex items-center space-x-1 font-semibold"
            >
              <span>View Evidence & RAG</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-2.5">
            {incidents.map((inc) => (
              <div
                key={inc.incident_id}
                className="p-3 bg-[#F3F6FA] dark:bg-[#0B1420] rounded-xs border border-[#D9E3EB] dark:border-[#294355] hover:border-[#067A9B]/60 transition"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-xs text-[#067A9B] dark:text-[#39C9DF]">
                      {inc.container_id}
                    </span>
                    <span className="text-[10px] bg-white dark:bg-[#111F2E] text-[#516678] dark:text-[#9FB5C5] border border-[#D9E3EB] dark:border-[#294355] px-1.5 py-0.2 rounded-xs">
                      {inc.incident_id}
                    </span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded-xs ${
                        inc.severity === "CRITICAL"
                          ? "bg-[#B91C1C]/10 text-[#B91C1C] dark:text-[#EF4444] border border-[#B91C1C]/30"
                          : "bg-[#B45309]/10 text-[#B45309] dark:text-[#F59E0B] border border-[#B45309]/30"
                      }`}
                    >
                      {inc.severity}
                    </span>
                  </div>

                  <div className="text-[11px] text-[#516678] dark:text-[#9FB5C5] flex items-center space-x-1.5">
                    <Clock className="w-3 h-3 text-[#B45309] dark:text-[#F59E0B]" />
                    <span>Cutoff: 16:30 IST</span>
                  </div>
                </div>

                <p className="text-xs text-[#102235] dark:text-[#EAF3F8] mb-2">{inc.title}</p>

                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] border-t border-[#D9E3EB] dark:border-[#294355] pt-2 text-[#516678] dark:text-[#9FB5C5]">
                  <div className="flex items-center space-x-2">
                    <span>
                      Root: <strong className="text-[#102235] dark:text-[#EAF3F8]">{inc.root_blocker_code}</strong>
                    </span>
                    <span>
                      Owner: <strong className="text-[#102235] dark:text-[#EAF3F8]">{inc.owner_role}</strong>
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="text-[#15803D] dark:text-[#22C55E] font-bold">
                      Savings: ₹{inc.projected_avoidable_cost_inr.toLocaleString("en-IN")}
                    </span>
                    <Link
                      href={`/incidents/${inc.incident_id}`}
                      className="px-2 py-0.5 bg-white dark:bg-[#111F2E] hover:bg-[#EDF3F8] dark:hover:bg-[#172B3D] text-[#067A9B] dark:text-[#39C9DF] border border-[#D9E3EB] dark:border-[#294355] rounded-xs font-semibold transition flex items-center space-x-1"
                    >
                      <span>Inspect DAG</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Col: ESP32 TFT Mirror (Buttonless Display Only) */}
        <div>
          <TFTMirror />
        </div>
      </div>
    </div>
  );
}
