"use client";

import React, { useEffect, useState } from "react";
import { fetchRiskSummary } from "@/lib/api";
import { RiskSummary } from "@/lib/types";

export default function RiskCorridorStrip() {
  const [data, setData] = useState<RiskSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRiskSummary()
      .then(setData)
      .catch((err) => console.error("Risk summary error:", err))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <div className="bg-[#10141B] border border-[#222936] rounded p-3 text-xs font-mono text-slate-500 animate-pulse">
        Loading real-time weather & highway corridor telematics...
      </div>
    );
  }

  const isAtRisk = data.overall_status === "AT_RISK" || data.overall_status === "LIKELY_MISS";

  return (
    <div className="bg-[#10141B] border border-[#222936] rounded p-3.5 space-y-3">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#222936] pb-2.5">
        <div className="flex items-center space-x-2.5">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              isAtRisk ? "bg-amber-400 animate-ping" : "bg-emerald-400"
            }`}
          />
          <span className="text-xs font-semibold text-slate-100 font-mono tracking-wider uppercase">
            Corridor Risk Telematics: {data.corridor}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <span
            className={`px-2 py-0.5 text-[10px] font-mono rounded font-semibold ${
              isAtRisk
                ? "bg-amber-950/70 border border-amber-800 text-amber-300"
                : "bg-emerald-950/70 border border-emerald-800 text-emerald-300"
            }`}
          >
            STATUS: {data.overall_status}
          </span>
          <span className="px-2 py-0.5 text-[10px] font-mono bg-slate-800 border border-slate-700 text-slate-300 rounded">
            ORIGIN: {data.weather.origin} / {data.traffic.origin}
          </span>
        </div>
      </div>

      {/* Grid of Weather & Highway Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs font-mono">
        {/* Weather Card */}
        <div className="bg-[#090B0E] p-2.5 rounded border border-[#222936] space-y-1">
          <div className="text-[10px] text-slate-500 uppercase">OpenWeather Surface</div>
          <div className="text-slate-100 font-semibold">{data.weather.condition}</div>
          <div className="text-[11px] text-slate-400">
            {data.weather.temperature_c}°C • Humidity {data.weather.humidity_pct}% • Wind {data.weather.wind_speed_mps} m/s
          </div>
        </div>

        {/* Forecast Card */}
        <div className="bg-[#090B0E] p-2.5 rounded border border-[#222936] space-y-1">
          <div className="text-[10px] text-slate-500 uppercase">3-Hour Precipitation Outlook</div>
          <div className="text-slate-200 text-[11px]">{data.weather.forecast_summary}</div>
          <div className="text-[10px] text-amber-400/90 font-medium">
            Impact: {data.weather.port_operations_impact}
          </div>
        </div>

        {/* Traffic Transit Card */}
        <div className="bg-[#090B0E] p-2.5 rounded border border-[#222936] space-y-1">
          <div className="text-[10px] text-slate-500 uppercase">Google Routes Transit</div>
          <div className="text-slate-100 font-semibold">
            {data.traffic.duration_traffic_mins} min <span className="text-slate-500 text-[10px]">({data.traffic.distance_km} km)</span>
          </div>
          <div className="text-[11px] text-amber-400">
            Congestion Delay: +{data.traffic.congestion_delay_mins} min vs Free-Flow
          </div>
        </div>

        {/* Legal & Regulatory Domain Gate */}
        <div className="bg-[#090B0E] p-2.5 rounded border border-[#222936] space-y-1">
          <div className="text-[10px] text-slate-500 uppercase">Statutory Port Gate</div>
          <div className="text-slate-300 text-[11px]">No Statutory Port Closure</div>
          <div className="text-[10px] text-slate-500">
            Weather/Traffic are operational signals, not legal port shutdowns.
          </div>
        </div>
      </div>
    </div>
  );
}

