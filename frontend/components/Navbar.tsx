"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Clock, Cpu, PhoneCall, Radio } from "lucide-react";
import { getCurrentUser, setCurrentUser, AuthUser } from "@/lib/auth";
import { fetchHealth } from "@/lib/api";
import ThemeToggle from "@/components/ThemeToggle";
import LiraLogo from "@/components/LiraLogo";

export default function Navbar() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [apiStatus, setApiStatus] = useState<any>(null);
  const [istTime, setIstTime] = useState("");

  useEffect(() => {
    setUser(getCurrentUser());

    const updateClock = () => {
      const d = new Date();
      const options: Intl.DateTimeFormatOptions = {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
      };
      setIstTime(d.toLocaleTimeString("en-GB", options) + " IST");
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);

    fetchHealth()
      .then(setApiStatus)
      .catch(() => setApiStatus({ status: "offline", mode: "LOCAL", version: "v11.0" }));

    return () => clearInterval(timer);
  }, []);

  const handleRoleChange = (role: AuthUser["role"]) => {
    const updated: AuthUser = {
      user_code: role === "DRIVER" ? "DRIVER_T07" : `${role}_01`,
      role,
      display_name: role === "DRIVER" ? "Driver T07" : role === "DISPATCHER" ? "Chief Dispatcher" : "Terminal Director",
      truck_id: role === "DRIVER" ? "T07" : undefined
    };
    setCurrentUser(updated);
    setUser(updated);
  };

  return (
    <header className="h-14 border-b border-[#D9E3EB] dark:border-[#294355] bg-white dark:bg-[#111F2E] px-4 sm:px-6 flex items-center justify-between sticky top-0 z-50">
      {/* Brand & Subsystem Label */}
      <div className="flex items-center space-x-3">
        <Link href="/" className="flex items-center space-x-2.5" aria-label="LIRA-Q Sentinel Home">
          <LiraLogo className="w-7 h-7 text-[#067A9B] dark:text-[#39C9DF]" />
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-sm tracking-tight text-[#102235] dark:text-[#EAF3F8] font-mono">
                LIRA-Q SENTINEL
              </span>
              <span className="text-[10px] bg-[#067A9B]/10 text-[#067A9B] dark:text-[#39C9DF] font-mono px-1.5 py-0.2 rounded-xs border border-[#067A9B]/30 font-bold">
                TRACK IV LIVE
              </span>
            </div>
            <p className="text-[10px] text-[#516678] dark:text-[#9FB5C5] font-mono tracking-tight hidden sm:block">
              Logistics Intelligence & Recovery Automation
            </p>
          </div>
        </Link>
      </div>

      {/* Center status indicators */}
      <div className="hidden lg:flex items-center space-x-2">
        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-xs bg-[#F3F6FA] dark:bg-[#0B1420] border border-[#D9E3EB] dark:border-[#294355] text-[11px] font-mono">
          <Cpu className="w-3.5 h-3.5 text-[#067A9B] dark:text-[#39C9DF]" aria-label="QpiAI Engine" />
          <span className="text-[#516678] dark:text-[#9FB5C5]">QpiAI:</span>
          <span className="text-[#067A9B] dark:text-[#39C9DF] font-bold">Q1-Q6 Engine Active</span>
        </div>

        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-xs bg-[#F3F6FA] dark:bg-[#0B1420] border border-[#D9E3EB] dark:border-[#294355] text-[11px] font-mono">
          <PhoneCall className="w-3.5 h-3.5 text-[#15803D] dark:text-[#22C55E]" aria-label="Bolna AI Voice" />
          <span className="text-[#516678] dark:text-[#9FB5C5]">Bolna AI:</span>
          <span className="text-[#15803D] dark:text-[#22C55E] font-bold">READY (bn-590...)</span>
        </div>

        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-xs bg-[#F3F6FA] dark:bg-[#0B1420] border border-[#D9E3EB] dark:border-[#294355] text-[11px] font-mono">
          <Radio className="w-3.5 h-3.5 text-[#B45309] dark:text-[#F59E0B]" aria-label="Buttonless ESP32 Edge" />
          <span className="text-[#516678] dark:text-[#9FB5C5]">Hardware:</span>
          <span className="text-[#B45309] dark:text-[#F59E0B] font-bold">Buttonless RC522</span>
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center space-x-2.5">
        {/* Clock IST */}
        <div className="hidden sm:flex items-center space-x-1.5 text-xs font-mono tabular-nums text-[#102235] dark:text-[#EAF3F8] bg-[#F3F6FA] dark:bg-[#0B1420] px-2.5 py-1 rounded-xs border border-[#D9E3EB] dark:border-[#294355]">
          <Clock className="w-3.5 h-3.5 text-[#067A9B] dark:text-[#39C9DF]" aria-hidden="true" />
          <span>{istTime || "16:04:12 IST"}</span>
        </div>

        {/* API connection status */}
        <div className="flex items-center space-x-1.5 text-xs font-mono px-2 py-1 rounded-xs border border-[#D9E3EB] dark:border-[#294355] bg-[#F3F6FA] dark:bg-[#0B1420]">
          <div className={`w-2 h-2 rounded-full ${apiStatus?.status === "ok" ? "bg-[#15803D] dark:bg-[#22C55E]" : "bg-[#B45309] dark:bg-[#F59E0B]"}`} />
          <span className="text-[#102235] dark:text-[#EAF3F8] font-bold">
            {apiStatus?.status === "ok" ? "0.0.0.0:8000" : "READY"}
          </span>
        </div>

        {/* Role Switcher */}
        <div className="flex items-center space-x-1 bg-[#F3F6FA] dark:bg-[#0B1420] border border-[#D9E3EB] dark:border-[#294355] rounded-xs p-0.5 text-[11px] font-mono">
          <button
            onClick={() => handleRoleChange("DISPATCHER")}
            aria-label="Switch to Dispatcher role"
            className={`px-2 py-0.5 rounded-xs ${
              user?.role === "DISPATCHER"
                ? "bg-[#067A9B] dark:bg-[#39C9DF] text-white dark:text-[#0B1420] font-bold"
                : "text-[#516678] dark:text-[#9FB5C5]"
            }`}
          >
            DISPATCH
          </button>
          <button
            onClick={() => handleRoleChange("OPS_MANAGER")}
            aria-label="Switch to Operations Manager role"
            className={`px-2 py-0.5 rounded-xs ${
              user?.role === "OPS_MANAGER"
                ? "bg-[#067A9B] dark:bg-[#39C9DF] text-white dark:text-[#0B1420] font-bold"
                : "text-[#516678] dark:text-[#9FB5C5]"
            }`}
          >
            MANAGER
          </button>
        </div>

        <ThemeToggle />
      </div>
    </header>
  );
}
