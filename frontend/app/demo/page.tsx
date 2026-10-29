"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Sparkles,
  PhoneCall,
  Bot,
  Flame,
  Trophy,
  CloudRain,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  Server,
  Zap,
  Clock
} from "lucide-react";
import { fetchDemoHealth, resetDemoState } from "@/lib/api";

export default function DemoHubPage() {
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [resetting, setResetting] = useState<boolean>(false);
  const [resetStatus, setResetStatus] = useState<string | null>(null);

  const loadHealth = async () => {
    try {
      setLoading(true);
      const data = await fetchDemoHealth();
      setHealth(data);
    } catch (err) {
      console.error("Failed to load demo health:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHealth();
  }, []);

  const handleReset = async () => {
    if (!confirm("Reset demo state? This will clear test blocker nodes, restore baseline plan PLAN-R2, and reset sandbox sessions.")) {
      return;
    }
    try {
      setResetting(true);
      const res = await resetDemoState();
      setResetStatus("Demo state reset successfully. All baselines and seeds restored.");
      setTimeout(() => setResetStatus(null), 5000);
      await loadHealth();
    } catch (err: any) {
      alert("Reset failed: " + err.message);
    } finally {
      setResetting(false);
    }
  };

  const featureCards = [
    {
      num: "01",
      title: "Judge, Call the Driver Line",
      subtitle: "Full-Cycle Voice-to-Quantum Loop",
      href: "/demo/live-incident",
      icon: PhoneCall,
      color: "border-[#067A9B] text-[#067A9B] dark:text-[#39C9DF]",
      badge: "LIVE VOICE / TFT",
      description:
        "Trigger a real or simulated voice call to driver T04. Watch Sarvam transcribe Hindi, Blocker DAG auto-escalate, QpiAI Q4 HUBO re-solve, validator verify, manager approve, and ESP32 Bay Station TFT board update in real time.",
      steps: ["Voice Call / Sarvam STT", "Tier 4 Blocker Ingestion", "QpiAI Q4 HUBO Re-Solve", "Bay Station Board Update"]
    },
    {
      num: "02",
      title: "Quantum Dispatch Copilot",
      subtitle: "Gemini 1.5 Flash Function-Calling Agent",
      href: "/copilot",
      icon: Bot,
      color: "border-[#15803D] text-[#15803D] dark:text-[#22C55E]",
      badge: "11 VERIFIED TOOLS",
      description:
        "Ask natural language dispatch questions. Watch the Copilot inspect QpiAI models, run classical baselines, validate constraints, and propose plans with live tool call streaming and full agent traces.",
      steps: ["Inspect HUBO Models", "Validate Constraints", "Propose Plans Only (No Self-Approve)", "Live Agent Trace Stream"]
    },
    {
      num: "03",
      title: "Judge-Controlled Red-Team Stress Test",
      subtitle: "Interactive Multi-Disruption Sandbox",
      href: "/stress",
      icon: Flame,
      color: "border-[#B45309] text-[#B45309] dark:text-[#F59E0B]",
      badge: "GREEDY vs QPIAI",
      description:
        "Inject 8 compound perturbations (Monsoon +40mm/h, NH-348 landslide, twistlock crack, strike). Compare classical Greedy heuristic vs QpiAI Opt HUBO side-by-side with cumulative ₹ savings.",
      steps: ["8 Perturbation Buttons", "Parallel Greedy vs HUBO", "Zero Live Contamination", "Manager Promotion to Live"]
    },
    {
      num: "04",
      title: "Quantum vs Classical Race Panel",
      subtitle: "Objective Head-to-Head Benchmarks",
      href: "/race",
      icon: Trophy,
      color: "border-[#7C3AED] text-[#7C3AED] dark:text-[#A78BFA]",
      badge: "4-SOLVER BENCHMARK",
      description:
        "Head-to-head comparison of Greedy, CP-SAT, QpiAI Opt HUBO, and QAOA with XY-Mixer. Formulation blowup curve, mixer constraint preservation histogram, and empirical scaling sweep cache.",
      steps: ["HUBO vs QUBO Tensor Scaling", "Constraint-Preserving XY-Mixer", "N=4 to 32 Scaling Cache", "Defensible Quantum Claims"]
    },
    {
      num: "05",
      title: "Tomorrow's Risk Forecast & Reserve",
      subtitle: "8-Qubit QCBM Correlation Sampling",
      href: "/forecast",
      icon: CloudRain,
      color: "border-[#0284C7] text-[#0284C7] dark:text-[#38BDF8]",
      badge: "QCBM HEATMAP",
      description:
        "Live OpenWeather forecast + 8-qubit QCBM joint sampling with rain post-selection. 8x8 co-occurrence matrix, top-5 failure scenarios, independent vs quantum risk gap, and stochastic reserve booking.",
      steps: ["Real OpenWeather Telemetry", "8x8 Symmetric Co-occurrence", "Top-5 Joint Scenarios", "Standby Reserve Booking"]
    }
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-mono pb-12">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-[#D9E3EB] dark:border-[#294355] gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs px-2 py-0.5 rounded-sm bg-[#067A9B]/10 text-[#067A9B] dark:text-[#39C9DF] border border-[#067A9B]/30 font-bold">
              v13.1 WOW SUITE
            </span>
            <span className="text-xs text-[#516678] dark:text-[#9FB5C5]">
              Real Hardware · Real Solvers · Zero Gimmicks
            </span>
          </div>
          <h1 className="text-2xl font-bold text-[#102235] dark:text-[#EAF3F8] tracking-tight mt-1 flex items-center space-x-2">
            <Sparkles className="w-6 h-6 text-[#067A9B] dark:text-[#39C9DF]" />
            <span>Judge Demo Control Hub</span>
          </h1>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={loadHealth}
            disabled={loading}
            className="px-3 py-1.5 bg-[#F3F6FA] dark:bg-[#111F2E] border border-[#D9E3EB] dark:border-[#294355] rounded-sm text-xs hover:bg-[#E3EBF2] dark:hover:bg-[#172B3D] transition flex items-center space-x-1.5"
          >
            <Clock className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Check Providers</span>
          </button>

          <button
            onClick={handleReset}
            disabled={resetting}
            className="px-3.5 py-1.5 bg-[#B45309]/10 text-[#B45309] dark:text-[#F59E0B] border border-[#B45309]/30 rounded-sm text-xs hover:bg-[#B45309]/20 transition flex items-center space-x-1.5 font-bold"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${resetting ? "animate-spin" : ""}`} />
            <span>Reset Demo State</span>
          </button>
        </div>
      </div>

      {resetStatus && (
        <div className="p-3 bg-[#15803D]/10 border border-[#15803D]/30 rounded-sm text-xs text-[#15803D] dark:text-[#22C55E] flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{resetStatus}</span>
        </div>
      )}

      {/* Live Provider Health Bar */}
      <div className="bg-white dark:bg-[#111F2E] p-4 rounded-sm border border-[#D9E3EB] dark:border-[#294355] shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-bold text-[#102235] dark:text-[#EAF3F8] uppercase tracking-wider flex items-center space-x-2">
            <Server className="w-4 h-4 text-[#067A9B] dark:text-[#39C9DF]" />
            <span>Connected Production Providers & Hardware Interfaces</span>
          </div>
          <span className="text-[11px] text-[#516678] dark:text-[#9FB5C5]">
            Target: port 8000 (FastAPI) · port 3000 (Next.js)
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 text-xs">
          {health?.providers ? (
            Object.entries(health.providers).map(([name, prov]: [string, any]) => (
              <div
                key={name}
                className="p-2 rounded-sm border border-[#D9E3EB] dark:border-[#294355] bg-[#F3F6FA] dark:bg-[#0B1420] text-center"
              >
                <div className="text-[10px] text-[#516678] dark:text-[#9FB5C5] uppercase truncate font-bold">
                  {name}
                </div>
                <div className="mt-1 flex items-center justify-center space-x-1">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      prov.status === "READY"
                        ? "bg-[#15803D] dark:bg-[#22C55E]"
                        : "bg-[#B45309] dark:bg-[#F59E0B]"
                    }`}
                  />
                  <span
                    className={`text-[11px] font-bold ${
                      prov.status === "READY"
                        ? "text-[#15803D] dark:text-[#22C55E]"
                        : "text-[#B45309] dark:text-[#F59E0B]"
                    }`}
                  >
                    {prov.status}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-8 text-center py-2 text-[#516678] text-xs">
              Loading provider telemetry...
            </div>
          )}
        </div>
      </div>

      {/* 5 Demo Feature Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {featureCards.map((feat) => {
          const Icon = feat.icon;
          return (
            <div
              key={feat.num}
              className="bg-white dark:bg-[#111F2E] border border-[#D9E3EB] dark:border-[#294355] rounded-sm p-5 shadow-xs flex flex-col justify-between hover:border-[#067A9B] transition-all group"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xl font-bold text-[#516678] dark:text-[#9FB5C5] font-mono">
                    {feat.num}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-xs bg-[#F3F6FA] dark:bg-[#172B3D] border border-[#D9E3EB] dark:border-[#294355] font-bold text-[#102235] dark:text-[#EAF3F8]">
                    {feat.badge}
                  </span>
                </div>

                <div className="flex items-center space-x-2.5 mb-2">
                  <div className={`p-2 rounded-sm border bg-[#F3F6FA] dark:bg-[#0B1420] ${feat.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-[#102235] dark:text-[#EAF3F8] leading-tight">
                      {feat.title}
                    </h2>
                    <p className="text-[11px] text-[#516678] dark:text-[#9FB5C5]">{feat.subtitle}</p>
                  </div>
                </div>

                <p className="text-xs text-[#516678] dark:text-[#9FB5C5] leading-relaxed mt-3 mb-4">
                  {feat.description}
                </p>

                <div className="space-y-1.5 pt-3 border-t border-[#D9E3EB]/50 dark:border-[#294355]/50">
                  {feat.steps.map((step, idx) => (
                    <div key={idx} className="flex items-center space-x-2 text-[11px] text-[#102235] dark:text-[#EAF3F8]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#067A9B] dark:bg-[#39C9DF]" />
                      <span className="truncate">{step}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-[#D9E3EB] dark:border-[#294355]">
                <Link
                  href={feat.href}
                  className="w-full inline-flex items-center justify-center space-x-2 px-4 py-2 bg-[#067A9B] hover:bg-[#056782] text-white rounded-sm text-xs font-bold transition group-hover:shadow-xs"
                >
                  <span>Launch Feature {feat.num}</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>
          );
        })}

        {/* Presentation Cheat-Sheet Card */}
        <div className="bg-[#0B1420] text-white border border-[#294355] rounded-sm p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 text-[#39C9DF] mb-2 text-xs font-bold uppercase tracking-wider">
              <Zap className="w-4 h-4" />
              <span>7-Minute Presentation Sequence</span>
            </div>
            <h2 className="text-sm font-bold mb-3">Live Judge Pitch Runbook</h2>
            <div className="space-y-2 text-xs text-[#9FB5C5]">
              <div className="flex items-start space-x-2">
                <span className="text-[#39C9DF] font-bold">1:00</span>
                <span>Open <b>Feature 1</b>: trigger Driver Call, observe Sarvam + Q4 re-solve + TFT board.</span>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-[#39C9DF] font-bold">2:30</span>
                <span>Open <b>Feature 2</b>: ask Copilot natural dispatch questions; watch live Agent Trace tools.</span>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-[#39C9DF] font-bold">4:00</span>
                <span>Open <b>Feature 3</b>: red-team stress test; inject compound disruptions in isolated sandbox.</span>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-[#39C9DF] font-bold">5:30</span>
                <span>Open <b>Feature 4</b>: race panel; demonstrate XY-Mixer QAOA constraint-preservation & HUBO scaling.</span>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-[#39C9DF] font-bold">6:30</span>
                <span>Open <b>Feature 5</b>: QCBM 8x8 correlation matrix & book tomorrow&apos;s stochastic buffer.</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#294355] text-[11px] text-[#9FB5C5]">
            Reference: <span className="text-white font-mono">docs/DEMO_RUNBOOK.md</span>
          </div>
        </div>
      </div>
    </div>
  );
}

