"use client";

import React, { useState, useEffect } from "react";
import { CloudRain, AlertTriangle, ShieldCheck, Zap, RefreshCw, Radio, MapPin } from "lucide-react";
import { fetchExternalEvents, simulateExternalDisruption } from "@/lib/api";
import { ExternalEvent } from "@/lib/types";

export default function ExternalDisruptionsPage() {
  const [events, setEvents] = useState<ExternalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [simType, setSimType] = useState("HEAVY_RAIN");
  const [trustState, setTrustState] = useState("FORECAST_RISK");
  const [severity, setSeverity] = useState("HIGH");
  const [affectedTruck, setAffectedTruck] = useState("T07");

  const loadEvents = async () => {
    try {
      setLoading(true);
      const data = await fetchExternalEvents();
      setEvents(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await simulateExternalDisruption({
        type: simType,
        trust_state: trustState,
        severity: severity,
        title: `${simType.replace("_", " ")} observed near port corridor`,
        geography: "Nhava Sheva Approach Corridor",
        duration_hours: 4,
        affected_trucks: [affectedTruck],
        affected_slots: simType === "PORT_CLOSURE" ? ["S1600", "S1630"] : []
      });
      await loadEvents();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1f2328] dark:text-[#e6edf3] font-mono tracking-tight flex items-center space-x-3">
            <span>External Disruption Command Center</span>
          </h1>
          <p className="text-[#656d76] dark:text-[#8b949e] text-xs mt-1">
            Weather, arterial traffic, flood alerts, and verified port operational status feeds.
          </p>
        </div>

        <button
          onClick={loadEvents}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-white dark:bg-[#21262d] border border-[#d0d7de] dark:border-[#30363d] hover:bg-gray-50 dark:hover:bg-[#30363d] text-[#1f2328] dark:text-[#e6edf3] rounded-md text-xs font-mono transition shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-blue-600 dark:text-sky-400" : ""}`} />
          <span>Refresh Feeds</span>
        </button>
      </div>

      {/* Controlled Injection Form */}
      <div className="bg-white dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d] rounded-xl p-5 shadow-sm">
        <div className="flex items-center space-x-2 text-amber-600 dark:text-amber-400 font-mono text-sm font-bold mb-3 uppercase tracking-wide">
          <Zap className="w-4 h-4" />
          <span>Inject Operational Disruption Event (Environmental & Route Advisory)</span>
        </div>

        <form onSubmit={handleSimulate} className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs font-mono">
          <div>
            <label className="block text-[#656d76] dark:text-[#8b949e] mb-1 font-semibold">EVENT TYPE:</label>
            <select
              value={simType}
              onChange={(e) => setSimType(e.target.value)}
              className="w-full bg-[#f6f8fa] dark:bg-[#0d1117] border border-[#d0d7de] dark:border-[#30363d] rounded-md px-2.5 py-1.5 text-[#1f2328] dark:text-[#e6edf3] focus:outline-none focus:border-blue-500 shadow-sm"
            >
              <option value="HEAVY_RAIN">HEAVY_RAIN (Monsoon)</option>
              <option value="TRAFFIC_JAM">TRAFFIC_JAM (Arterial)</option>
              <option value="PORT_CLOSURE">PORT_CLOSURE (Official)</option>
              <option value="CRANE_BREAKDOWN">CRANE_BREAKDOWN (Berth)</option>
            </select>
          </div>

          <div>
            <label className="block text-[#656d76] dark:text-[#8b949e] mb-1 font-semibold">TRUST STATE:</label>
            <select
              value={trustState}
              onChange={(e) => setTrustState(e.target.value)}
              className="w-full bg-[#f6f8fa] dark:bg-[#0d1117] border border-[#d0d7de] dark:border-[#30363d] rounded-md px-2.5 py-1.5 text-[#1f2328] dark:text-[#e6edf3] focus:outline-none focus:border-blue-500 shadow-sm"
            >
              <option value="FORECAST_RISK">FORECAST_RISK (Risk Only)</option>
              <option value="CONFIRMED_DISRUPTION">CONFIRMED_DISRUPTION (Hard Block)</option>
            </select>
          </div>

          <div>
            <label className="block text-[#656d76] dark:text-[#8b949e] mb-1 font-semibold">AFFECTED TRUCK:</label>
            <select
              value={affectedTruck}
              onChange={(e) => setAffectedTruck(e.target.value)}
              className="w-full bg-[#f6f8fa] dark:bg-[#0d1117] border border-[#d0d7de] dark:border-[#30363d] rounded-md px-2.5 py-1.5 text-[#1f2328] dark:text-[#e6edf3] focus:outline-none focus:border-blue-500 shadow-sm"
            >
              <option value="T07">Truck T07</option>
              <option value="T04">Truck T04</option>
              <option value="T09">Truck T09</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full py-1.5 bg-[#d29922] hover:bg-[#b08018] text-white font-semibold rounded-md transition shadow-sm font-mono text-xs"
            >
              Simulate Event
            </button>
          </div>
        </form>
      </div>

      {/* Events Table */}
      <div className="bg-white dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d] rounded-xl p-5 shadow-sm">
        <div className="text-xs font-mono font-bold text-[#1f2328] dark:text-[#e6edf3] uppercase tracking-wide mb-3">
          Monitored Events & Port Geography Impact ({events.length})
        </div>

        <div className="space-y-3">
          {events.map((evt) => (
            <div
              key={evt.event_id}
              className="p-4 bg-[#f6f8fa] dark:bg-[#0d1117] rounded-xl border border-[#d0d7de] dark:border-[#30363d] flex flex-wrap items-center justify-between gap-3 text-xs font-mono shadow-sm"
            >
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-[#1f2328] dark:text-[#e6edf3] text-sm">{evt.title}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      evt.trust_state === "CONFIRMED_DISRUPTION"
                        ? "bg-red-100 dark:bg-rose-950 text-red-700 dark:text-rose-300 border border-red-300 dark:border-rose-800"
                        : "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
                    }`}
                  >
                    {evt.trust_state}
                  </span>
                  {evt.is_simulated && (
                    <span className="text-[10px] bg-gray-200 dark:bg-[#21262d] text-[#656d76] dark:text-[#8b949e] px-1.5 py-0.5 rounded font-mono">
                      ADVISORY_INJECT
                    </span>
                  )}
                </div>
                <div className="text-[#656d76] dark:text-[#8b949e] text-[11px] flex items-center space-x-3">
                  <span className="flex items-center space-x-1">
                    <MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-sky-400" />
                    <span>{evt.geography}</span>
                  </span>
                  <span>Source: {evt.source_label}</span>
                </div>
              </div>

              <div className="text-right">
                <div className="text-blue-600 dark:text-sky-400 font-bold">
                  Trucks: {evt.affected_trucks?.join(", ") || "All Corridor"}
                </div>
                <div className="text-[10px] text-[#656d76] dark:text-[#8b949e]">
                  Window: 15:00 - 19:00 IST
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

