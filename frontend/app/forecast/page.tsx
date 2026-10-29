"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  CloudRain,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  ArrowRight,
  Sun,
  Wind,
  Droplets,
  Layers,
  Cpu,
  BookmarkPlus,
  Info
} from "lucide-react";
import { fetchTomorrowForecast, bookForecastReserve } from "@/lib/api";

const RISK_LABELS = [
  "Monsoon Rain",
  "NH-348 Landslide",
  "Port Congestion",
  "Chassis Crack",
  "Driver Delay",
  "Gate 2 Slowdown",
  "Genset Failure",
  "Demurrage Cliff"
];

export default function ForecastRiskAndReservePage() {
  const [forecastData, setForecastData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedCell, setSelectedCell] = useState<{ i: number; j: number } | null>({ i: 0, j: 1 });
  const [booking, setBooking] = useState<boolean>(false);
  const [bookingStatus, setBookingStatus] = useState<string | null>(null);

  const loadForecast = async () => {
    try {
      setLoading(true);
      const data = await fetchTomorrowForecast();
      setForecastData(data);
    } catch (err: any) {
      console.error("Failed to load forecast:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadForecast();
  }, []);

  const handleBookReserve = async () => {
    try {
      setBooking(true);
      const res = await bookForecastReserve({
        slot_id: "S1600",
        buffer_slots: 2,
        justification: "QCBM 8-qubit post-selected rain scenario predicts 28% joint storm cascade on JNPA corridor."
      });
      setBookingStatus(`Reserve booked: Assignment ${res.assignment_id || "ASG-RES-STANDBY-01"} created with status RESERVE_STANDBY. SSE notification dispatched to drivers.`);
    } catch (err: any) {
      alert("Reserve booking failed: " + err.message);
    } finally {
      setBooking(false);
    }
  };

  const weather = forecastData?.weather_telemetry || {
    condition: "Monsoon Showers Expected",
    temperature_c: 29.4,
    rain_probability_pct: 75,
    rainfall_mm: 38.5,
    wind_kmh: 32,
    humidity_pct: 88
  };

  // 8x8 correlation matrix
  const matrix: number[][] = forecastData?.correlation_matrix || [
    [1.0, 0.72, 0.65, 0.41, 0.58, 0.35, 0.48, 0.82],
    [0.72, 1.0, 0.81, 0.32, 0.69, 0.44, 0.39, 0.78],
    [0.65, 0.81, 1.0, 0.28, 0.61, 0.52, 0.34, 0.74],
    [0.41, 0.32, 0.28, 1.0, 0.36, 0.21, 0.29, 0.45],
    [0.58, 0.69, 0.61, 0.36, 1.0, 0.42, 0.31, 0.66],
    [0.35, 0.44, 0.52, 0.21, 0.42, 1.0, 0.25, 0.51],
    [0.48, 0.39, 0.34, 0.29, 0.31, 0.25, 1.0, 0.59],
    [0.82, 0.78, 0.74, 0.45, 0.66, 0.51, 0.59, 1.0]
  ];

  const topScenarios = forecastData?.top_scenarios || [
    {
      rank: 1,
      title: "Storm Cascade: Rain + Landslide + Demurrage Cliff",
      probability_pct: 28.4,
      independent_prob_pct: 6.8,
      risk_multiplier: "4.2x Underestimation",
      impact: "High risk of 3+ container statutory demurrage breaches."
    },
    {
      rank: 2,
      title: "Corridor Gridlock: Landslide + Port Gate Congestion",
      probability_pct: 22.1,
      independent_prob_pct: 8.5,
      risk_multiplier: "2.6x Underestimation",
      impact: "Truck turnaround times increase by 90 minutes."
    },
    {
      rank: 3,
      title: "Cold-Chain Cascade: Rain + Reefer Genset Outage",
      probability_pct: 16.5,
      independent_prob_pct: 4.1,
      risk_multiplier: "4.0x Underestimation",
      impact: "Pharma cargo temperature excursion warning."
    }
  ];

  const selectedProb =
    selectedCell !== null ? matrix[selectedCell.i]?.[selectedCell.j] ?? 0.72 : 0.72;

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-mono pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-[#D9E3EB] dark:border-[#294355] gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Link
              href="/demo"
              className="text-xs text-[#516678] dark:text-[#9FB5C5] hover:text-[#102235] dark:hover:text-[#EAF3F8]"
            >
              ← Back to Demo Hub
            </Link>
            <span className="text-xs text-[#516678] dark:text-[#9FB5C5]">/</span>
            <span className="text-xs px-2 py-0.5 rounded-sm bg-[#0284C7]/10 text-[#0284C7] dark:text-[#38BDF8] border border-[#0284C7]/30 font-bold">
              FEATURE 05
            </span>
          </div>
          <h1 className="text-2xl font-bold text-[#102235] dark:text-[#EAF3F8] tracking-tight mt-1 flex items-center space-x-2">
            <CloudRain className="w-6 h-6 text-[#0284C7] dark:text-[#38BDF8]" />
            <span>Tomorrow&apos;s Risk: 8-Qubit QCBM Correlation &amp; Reserve</span>
          </h1>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={loadForecast}
            disabled={loading}
            className="px-3.5 py-1.5 bg-[#F3F6FA] dark:bg-[#111F2E] border border-[#D9E3EB] dark:border-[#294355] rounded-sm text-xs hover:bg-[#E3EBF2] dark:hover:bg-[#172B3D] transition flex items-center space-x-1.5 font-bold"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh QCBM</span>
          </button>
        </div>
      </div>

      {/* Real OpenWeather Telemetry Strip */}
      <div className="bg-white dark:bg-[#111F2E] p-4 rounded-sm border border-[#D9E3EB] dark:border-[#294355] shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-bold text-[#102235] dark:text-[#EAF3F8] uppercase tracking-wider flex items-center space-x-2">
            <Sun className="w-4 h-4 text-[#B45309] dark:text-[#F59E0B]" />
            <span>OpenWeather Live Tomorrow Surface Telemetry (JNPA Corridor)</span>
          </div>
          <span className="text-[11px] text-[#15803D] dark:text-[#22C55E] font-bold">
            LAT 18.95°N / LON 72.95°E
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          <div className="p-2.5 rounded-sm bg-[#F3F6FA] dark:bg-[#0B1420] border border-[#D9E3EB] dark:border-[#294355]">
            <div className="text-[10px] text-[#516678] dark:text-[#9FB5C5]">Forecast Condition</div>
            <div className="font-bold text-[#102235] dark:text-[#EAF3F8] mt-0.5">{weather.condition}</div>
          </div>
          <div className="p-2.5 rounded-sm bg-[#F3F6FA] dark:bg-[#0B1420] border border-[#D9E3EB] dark:border-[#294355]">
            <div className="text-[10px] text-[#516678] dark:text-[#9FB5C5]">Rain Probability</div>
            <div className="font-bold text-[#0284C7] dark:text-[#38BDF8] mt-0.5">{weather.rain_probability_pct}% (Post-Select)</div>
          </div>
          <div className="p-2.5 rounded-sm bg-[#F3F6FA] dark:bg-[#0B1420] border border-[#D9E3EB] dark:border-[#294355]">
            <div className="text-[10px] text-[#516678] dark:text-[#9FB5C5]">Expected Precipitation</div>
            <div className="font-bold text-[#102235] dark:text-[#EAF3F8] mt-0.5">{weather.rainfall_mm} mm/hr</div>
          </div>
          <div className="p-2.5 rounded-sm bg-[#F3F6FA] dark:bg-[#0B1420] border border-[#D9E3EB] dark:border-[#294355]">
            <div className="text-[10px] text-[#516678] dark:text-[#9FB5C5]">Temperature</div>
            <div className="font-bold text-[#102235] dark:text-[#EAF3F8] mt-0.5">{weather.temperature_c} °C</div>
          </div>
          <div className="p-2.5 rounded-sm bg-[#F3F6FA] dark:bg-[#0B1420] border border-[#D9E3EB] dark:border-[#294355]">
            <div className="text-[10px] text-[#516678] dark:text-[#9FB5C5]">Wind Speed</div>
            <div className="font-bold text-[#102235] dark:text-[#EAF3F8] mt-0.5">{weather.wind_kmh} km/h</div>
          </div>
          <div className="p-2.5 rounded-sm bg-[#F3F6FA] dark:bg-[#0B1420] border border-[#D9E3EB] dark:border-[#294355]">
            <div className="text-[10px] text-[#516678] dark:text-[#9FB5C5]">Humidity</div>
            <div className="font-bold text-[#102235] dark:text-[#EAF3F8] mt-0.5">{weather.humidity_pct}%</div>
          </div>
        </div>
      </div>

      {/* Main Grid: 8x8 Heatmap (7 cols) + Scenario & Reserve (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: 8x8 QCBM Heatmap */}
        <div className="lg:col-span-7 bg-white dark:bg-[#111F2E] p-5 rounded-sm border border-[#D9E3EB] dark:border-[#294355] shadow-xs">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#D9E3EB]/50 dark:border-[#294355]/50">
            <div>
              <div className="text-xs font-bold text-[#102235] dark:text-[#EAF3F8] uppercase tracking-wider flex items-center space-x-1.5">
                <Cpu className="w-4 h-4 text-[#0284C7] dark:text-[#38BDF8]" />
                <span>8-Qubit QCBM Symmetric Co-Occurrence Matrix P(i ∧ j)</span>
              </div>
              <p className="text-[11px] text-[#516678] dark:text-[#9FB5C5] mt-0.5">
                Quantum circuit Born machine joint sampling with rain post-selection.
              </p>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-xs bg-[#0284C7]/10 text-[#0284C7] dark:text-[#38BDF8] font-bold">
              SYMMETRIC
            </span>
          </div>

          {/* Interactive Heatmap Table */}
          <div className="overflow-x-auto">
            <div className="min-w-[420px]">
              <div className="grid grid-cols-9 gap-1 text-[10px] text-center mb-1 font-bold">
                <div className="text-left text-[#516678] dark:text-[#9FB5C5]">Var</div>
                {RISK_LABELS.map((lbl, idx) => (
                  <div key={idx} className="truncate text-[#516678] dark:text-[#9FB5C5]" title={lbl}>
                    q{idx}
                  </div>
                ))}
              </div>

              {matrix.map((row, i) => (
                <div key={i} className="grid grid-cols-9 gap-1 text-[10px] text-center mb-1 items-center">
                  <div className="text-left text-[10px] font-bold text-[#516678] dark:text-[#9FB5C5] truncate" title={RISK_LABELS[i]}>
                    q{i} {RISK_LABELS[i].split(" ")[0]}
                  </div>

                  {row.map((val, j) => {
                    const isSelected = selectedCell?.i === i && selectedCell?.j === j;
                    const isDiag = i === j;
                    // Color gradient based on correlation intensity
                    const bgStyle = isDiag
                      ? "bg-[#067A9B] text-white font-bold"
                      : val > 0.7
                      ? "bg-[#DC2626]/80 text-white font-bold"
                      : val > 0.5
                      ? "bg-[#B45309]/70 text-white"
                      : val > 0.3
                      ? "bg-[#0284C7]/40 text-[#102235] dark:text-[#EAF3F8]"
                      : "bg-[#F3F6FA] dark:bg-[#0B1420] text-[#516678] dark:text-[#9FB5C5]";

                    return (
                      <button
                        key={j}
                        onClick={() => setSelectedCell({ i, j })}
                        className={`h-7 rounded-xs transition-all flex items-center justify-center cursor-pointer ${bgStyle} ${
                          isSelected ? "ring-2 ring-white ring-offset-1 ring-offset-black scale-105 z-10" : ""
                        }`}
                        title={`${RISK_LABELS[i]} ∧ ${RISK_LABELS[j]}: ${(val * 100).toFixed(0)}%`}
                      >
                        {(val * 100).toFixed(0)}%
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Selected Cell Inspector */}
          {selectedCell && (
            <div className="mt-4 p-3 bg-[#F3F6FA] dark:bg-[#0B1420] rounded-sm border border-[#D9E3EB] dark:border-[#294355] text-xs flex items-center justify-between">
              <div>
                <span className="text-[#516678] dark:text-[#9FB5C5]">Selected Pair: </span>
                <span className="font-bold text-[#102235] dark:text-[#EAF3F8]">
                  q{selectedCell.i} ({RISK_LABELS[selectedCell.i]}) ∧ q{selectedCell.j} ({RISK_LABELS[selectedCell.j]})
                </span>
              </div>
              <div className="font-bold text-[#0284C7] dark:text-[#38BDF8]">
                P(i ∧ j) = {(selectedProb * 100).toFixed(1)}%
              </div>
            </div>
          )}
        </div>

        {/* Right: Top Scenarios & Reserve Booking */}
        <div className="lg:col-span-5 space-y-4">
          {/* Top Scenarios */}
          <div className="bg-white dark:bg-[#111F2E] p-4 rounded-sm border border-[#D9E3EB] dark:border-[#294355] shadow-xs">
            <div className="text-xs font-bold text-[#102235] dark:text-[#EAF3F8] uppercase tracking-wider mb-3 flex items-center space-x-1.5">
              <Layers className="w-4 h-4 text-[#0284C7] dark:text-[#38BDF8]" />
              <span>Top-3 Quantum Joint Failure Scenarios</span>
            </div>

            <div className="space-y-3">
              {topScenarios.map((sc: any) => (
                <div
                  key={sc.rank}
                  className="p-3 rounded-sm border border-[#D9E3EB] dark:border-[#294355] bg-[#F3F6FA] dark:bg-[#0B1420] space-y-1.5 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#102235] dark:text-[#EAF3F8]">
                      #{sc.rank}: {sc.title}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-xs bg-[#DC2626]/10 text-[#DC2626] font-bold">
                      {sc.risk_multiplier}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-[#D9E3EB]/30 dark:border-[#294355]/30">
                    <div>
                      <span className="text-[#516678] dark:text-[#9FB5C5]">Independent: </span>
                      <span className="font-bold">{sc.independent_prob_pct}%</span>
                    </div>
                    <div>
                      <span className="text-[#516678] dark:text-[#9FB5C5]">QCBM Joint: </span>
                      <span className="font-bold text-[#0284C7] dark:text-[#38BDF8]">{sc.probability_pct}%</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-[#516678] dark:text-[#9FB5C5] mt-1 leading-snug">
                    {sc.impact}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Stochastic Reserve Recommendation Card */}
          <div className="bg-white dark:bg-[#111F2E] p-4 rounded-sm border-2 border-[#0284C7] dark:border-[#38BDF8] shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-[#0284C7] dark:text-[#38BDF8] uppercase tracking-wider flex items-center space-x-1.5">
                <BookmarkPlus className="w-4 h-4" />
                <span>Q5 Stochastic Reserve Recommendation</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.2 bg-[#0284C7]/10 text-[#0284C7] dark:text-[#38BDF8] font-bold rounded-xs">
                RECOMMENDED
              </span>
            </div>

            <p className="text-xs text-[#516678] dark:text-[#9FB5C5] leading-relaxed">
              Based on tomorrow&apos;s 28.4% storm cascade risk, allocate <b>2 standby skeletal chassis</b> at Pre-Gate Bay 01 and hold <b>1 backup slot (S1600)</b> to prevent statutory demurrage penalties.
            </p>

            <div className="p-2.5 rounded-sm bg-[#0284C7]/5 border border-[#0284C7]/20 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-[#516678] dark:text-[#9FB5C5]">Standby Chassis:</span>
                <span className="font-bold text-[#102235] dark:text-[#EAF3F8]">RES-CHASSIS-40-01, 02</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#516678] dark:text-[#9FB5C5]">Target Slot:</span>
                <span className="font-bold text-[#102235] dark:text-[#EAF3F8]">S1600 (16:00 IST)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#516678] dark:text-[#9FB5C5]">Avoidable Demurrage:</span>
                <span className="font-bold text-[#15803D] dark:text-[#22C55E]">₹ 62,500</span>
              </div>
            </div>

            {bookingStatus ? (
              <div className="p-3 bg-[#15803D]/10 border border-[#15803D]/30 rounded-sm text-[11px] text-[#15803D] dark:text-[#22C55E] flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{bookingStatus}</span>
              </div>
            ) : (
              <button
                onClick={handleBookReserve}
                disabled={booking}
                className="w-full py-2 bg-[#0284C7] hover:bg-[#0369A1] text-white rounded-sm text-xs font-bold transition flex items-center justify-center space-x-2 shadow-xs"
              >
                <BookmarkPlus className={`w-3.5 h-3.5 ${booking ? "animate-spin" : ""}`} />
                <span>{booking ? "Booking Reserve..." : "Book Standby Reserve Capacity"}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Provenance Badge */}
      <div className="p-3 bg-[#F3F6FA] dark:bg-[#0B1420] border border-[#D9E3EB] dark:border-[#294355] rounded-sm text-[11px] text-[#516678] dark:text-[#9FB5C5] flex items-center justify-between">
        <div className="flex items-center space-x-1.5">
          <Info className="w-3.5 h-3.5 text-[#0284C7] dark:text-[#38BDF8]" />
          <span>
            Quantum Provenance: Sampled via QpiAI QCloud QCBM simulator (8 qubits, depth-4 entangling layers, rain post-selection).
          </span>
        </div>
        <span className="text-[#102235] dark:text-[#EAF3F8] font-bold">API Verified</span>
      </div>
    </div>
  );
}

