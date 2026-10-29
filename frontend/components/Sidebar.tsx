"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileSearch,
  Workflow,
  Radio,
  Cpu,
  ShieldCheck,
  Server,
  Sparkles,
  PhoneCall,
  Bot,
  Flame,
  Trophy,
  CloudRain
} from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();

  const mainSections = [
    {
      href: "/",
      label: "Operations",
      description: "Live Incident Queue & Blocker DAG",
      icon: LayoutDashboard,
      badge: "LIVE"
    },
    {
      href: "/incidents",
      label: "Evidence & RAG",
      description: "Quote-Span Grounding & Bolna Calling",
      icon: FileSearch,
      badge: "T1-T4"
    },
    {
      href: "/recoveries",
      label: "Recovery Studio",
      description: "C1-C6 Freight Exception Explorer",
      icon: Workflow,
      badge: "Q-SOLVE"
    },
    {
      href: "/edge",
      label: "ResourceLock",
      description: "Buttonless RC522 Edge Verification",
      icon: Radio,
      badge: "HARDWARE"
    },
    {
      href: "/opt-lab",
      label: "Solver & Evaluation Lab",
      description: "Q1-Q6 Decision Modes & Benchmarks",
      icon: Cpu,
      badge: "QUBO/HUBO"
    },
    {
      href: "/audit",
      label: "Audit & Health",
      description: "Cryptographic Log & Provider Health",
      icon: ShieldCheck,
      badge: "VERIFIED"
    },
  ];

  const wowSections = [
    {
      href: "/demo",
      label: "Demo Control Hub",
      description: "Health Checks & Reset State",
      icon: Sparkles,
      badge: "HUB"
    },
    {
      href: "/demo/live-incident",
      label: "1. Driver Call Line",
      description: "Voice -> Q4 HUBO -> TFT Board",
      icon: PhoneCall,
      badge: "VOICE"
    },
    {
      href: "/copilot",
      label: "2. Dispatch Copilot",
      description: "Gemini 11-Tool Dispatch Agent",
      icon: Bot,
      badge: "AGENT"
    },
    {
      href: "/stress",
      label: "3. Red-Team Stress",
      description: "8 Perturbations & Greedy vs QpiAI",
      icon: Flame,
      badge: "STRESS"
    },
    {
      href: "/race",
      label: "4. Quantum vs Classical",
      description: "Race Panel & XY-Mixer QAOA",
      icon: Trophy,
      badge: "RACE"
    },
    {
      href: "/forecast",
      label: "5. Tomorrow's Risk",
      description: "8-Qubit QCBM & Stochastic Reserve",
      icon: CloudRain,
      badge: "QCBM"
    },
  ];

  return (
    <aside
      className="w-64 border-r border-[#D9E3EB] dark:border-[#294355] bg-white dark:bg-[#111F2E] flex flex-col justify-between p-3 shrink-0 overflow-y-auto"
      aria-label="LIRA-Q Sentinel Main Navigation"
    >
      <div className="space-y-4">
        {/* WOW Features Section */}
        <div className="space-y-1">
          <div className="px-2.5 py-1 text-[11px] font-bold text-[#067A9B] dark:text-[#39C9DF] uppercase tracking-wider font-mono flex items-center justify-between">
            <span>WOW / DEMO SUITE</span>
            <span className="text-[9px] px-1 py-0.2 bg-[#067A9B]/10 rounded border border-[#067A9B]/30">v13.1</span>
          </div>
          {wowSections.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== "/demo" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={`Navigate to ${item.label}`}
                className={`flex items-start space-x-2.5 p-2 rounded-sm text-xs font-mono transition-colors ${
                  isActive
                    ? "bg-[#067A9B]/10 dark:bg-[#067A9B]/20 text-[#067A9B] dark:text-[#39C9DF] border border-[#067A9B]/40 font-bold"
                    : "text-[#516678] dark:text-[#9FB5C5] hover:text-[#102235] dark:hover:text-[#EAF3F8] hover:bg-[#F3F6FA] dark:hover:bg-[#172B3D]"
                }`}
              >
                <Icon
                  className={`w-4 h-4 mt-0.5 shrink-0 ${
                    isActive ? "text-[#067A9B] dark:text-[#39C9DF]" : "text-[#516678] dark:text-[#9FB5C5]"
                  }`}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="truncate">{item.label}</span>
                    <span className="text-[9px] px-1 py-0.2 rounded-xs bg-[#067A9B]/10 text-[#067A9B] dark:text-[#39C9DF] font-semibold">
                      {item.badge}
                    </span>
                  </div>
                  <p className="text-[10px] text-[#516678] dark:text-[#9FB5C5] font-normal truncate mt-0.5 opacity-80">
                    {item.description}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Core Command Sections */}
        <div className="space-y-1">
          <div className="px-2.5 py-1 text-[11px] font-bold text-[#516678] dark:text-[#9FB5C5] uppercase tracking-wider font-mono">
            CORE COMMAND SECTIONS
          </div>
          {mainSections.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={`Navigate to ${item.label}`}
                className={`flex items-start space-x-2.5 p-2 rounded-sm text-xs font-mono transition-colors ${
                  isActive
                    ? "bg-[#EDF3F8] dark:bg-[#172B3D] text-[#102235] dark:text-[#EAF3F8] border border-[#D9E3EB] dark:border-[#294355] font-bold"
                    : "text-[#516678] dark:text-[#9FB5C5] hover:text-[#102235] dark:hover:text-[#EAF3F8] hover:bg-[#F3F6FA] dark:hover:bg-[#172B3D]"
                }`}
              >
                <Icon
                  className={`w-4 h-4 mt-0.5 shrink-0 ${
                    isActive ? "text-[#067A9B] dark:text-[#39C9DF]" : "text-[#516678] dark:text-[#9FB5C5]"
                  }`}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="truncate">{item.label}</span>
                    <span className="text-[9px] px-1 py-0.2 rounded-xs bg-[#D9E3EB]/40 dark:bg-[#294355]/40 text-[#516678] dark:text-[#9FB5C5]">
                      {item.badge}
                    </span>
                  </div>
                  <p className="text-[10px] text-[#516678] dark:text-[#9FB5C5] font-normal truncate mt-0.5 opacity-80">
                    {item.description}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Terminal Node Information Card */}
      <div className="bg-[#F3F6FA] dark:bg-[#0B1420] p-3 rounded-sm border border-[#D9E3EB] dark:border-[#294355] text-xs font-mono mt-4">
        <div className="flex items-center space-x-1.5 text-[#15803D] dark:text-[#22C55E] font-bold mb-1 text-[11px]">
          <Server className="w-3.5 h-3.5 text-[#15803D] dark:text-[#22C55E]" aria-hidden="true" />
          <span>JNPA Gateway Terminal</span>
        </div>
        <p className="text-[10px] text-[#516678] dark:text-[#9FB5C5] leading-relaxed">
          Quant-A-Maze 3.0 Track IV. Buttonless RC522 telemetry. Zero fake demurrage waivers.
        </p>
      </div>
    </aside>
  );
}
