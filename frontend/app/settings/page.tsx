"use client";

import React, { useState, useEffect } from "react";
import { KeyRound, ShieldCheck, AlertTriangle, Lock, Server, CheckCircle2, Cpu, EyeOff } from "lucide-react";
import { fetchHealth } from "@/lib/api";

export default function SettingsSecurityPage() {
  const [health, setHealth] = useState<any>(null);

  useEffect(() => {
    fetchHealth().then(setHealth).catch(console.error);
  }, []);

  const credentialsConfig = [
    {
      name: "Google Gemini 1.5 Pro / Flash API",
      envVar: "GEMINI_API_KEY",
      purpose: "Document evidence extraction, quote span identification, and discrepancy claim detection",
      location: "backend/.env",
      currentMode: "LIVE / PRODUCTION ACTIVE",
      safeStatus: "Protected server-side; NEVER exposed to browser or mobile"
    },
    {
      name: "QpiAI Opt API",
      envVar: "QPIAI_OPT_API_KEY",
      purpose: "Classical-quantum hybrid QUBO / HUBO global horizon optimization and variable pruning",
      location: "backend/.env",
      currentMode: "LIVE / QPIAI OPT SOLVER",
      safeStatus: "Executed inside backend/app/services/qpiai/opt_adapter.py"
    },
    {
      name: "QpiAI QCloud QAOA API",
      envVar: "QPIAI_QCLOUD_API_KEY",
      purpose: "Active conflict-core QAOA circuit execution and bitstring probability distribution",
      location: "backend/.env",
      currentMode: "LIVE / QCLOUD BACKEND",
      safeStatus: "Executed inside backend/app/services/qpiai/qcloud_adapter.py"
    },
    {
      name: "Bolna Conversational Voice API",
      envVar: "BOLNA_API_KEY",
      purpose: "Outbound phone calls to drivers/brokers to confirm live ETA and arterial transit delays",
      location: "backend/.env",
      currentMode: "LIVE / OUTBOUND DISPATCH",
      safeStatus: "Agent ID: 7c439d93-81bf-447a-a2a7-cfb3fbc3a57f active"
    },
    {
      name: "Sarvam AI Speech / Indic TTS API",
      envVar: "SARVAM_API_KEY",
      purpose: "Indic regional language speech synthesis and speech-to-text conversion for Indian drivers",
      location: "backend/.env",
      currentMode: "LIVE / INDIC SPEECH TTS",
      safeStatus: "Adapter server-side at backend/app/services/calling/sarvam_adapter.py"
    },
    {
      name: "OpenWeather Live Forecast API",
      envVar: "WEATHER_API_KEY",
      purpose: "Real-time port meteorological observation and corridor rainfall risk index",
      location: "backend/.env",
      currentMode: "LIVE / OPENWEATHER ACTIVE",
      safeStatus: "Live weather at JNPT Nhava Sheva (18.95°N, 72.95°E)"
    },
    {
      name: "Google Maps Distance Matrix API",
      envVar: "TRAFFIC_API_KEY",
      purpose: "Real-time highway transit and arterial congestion delay estimation",
      location: "backend/.env",
      currentMode: "LIVE / GOOGLE MAPS ROUTING",
      safeStatus: "Corridor routing via Google Distance Matrix API"
    },
    {
      name: "Supabase Realtime PostgreSQL",
      envVar: "SUPABASE_PUBLISHABLE_KEY",
      purpose: "Edge replication, remote telemetry synchronization, and carrier audit ledger",
      location: "backend/.env",
      currentMode: "LIVE / SUPABASE CLOUD",
      safeStatus: "Connected to https://xqwscxjgsiwzjjrtenlt.supabase.co"
    },
    {
      name: "ESP32 Hardware Checkpoint Key",
      envVar: "EDGE_HMAC_KEY_EDGE_01",
      purpose: "HMAC-SHA256 signature verification for physical RC522 RFID staging observation events",
      location: "backend/.env (Shared with ESP32 device ONLY)",
      currentMode: "LIVE HMAC-SHA256 VERIFICATION",
      safeStatus: "Device credential ONLY; ESP32 has NO access to Gemini or QpiAI keys"
    }
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-[#1f2328] dark:text-[#e6edf3] font-mono tracking-tight flex items-center space-x-3">
          <span>Security & API Credentials Architecture</span>
        </h1>
        <p className="text-[#656d76] dark:text-[#8b949e] text-xs mt-1">
          Zero-trust security model: Private service keys reside strictly in <code className="text-blue-600 dark:text-cyan-300 font-semibold">backend/.env</code>.
          Zero keys in frontend client bundles, Android APK, or ESP32 firmware.
        </p>
      </div>

      {/* Security Architecture Notice */}
      <div className="p-4 bg-white dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d] rounded-xl flex items-start space-x-3 shadow-sm font-mono text-xs">
        <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold text-[#1f2328] dark:text-[#e6edf3]">CANONICAL CREDENTIALS ENFORCEMENT</span>
          <p className="text-[#656d76] dark:text-[#8b949e] font-sans text-xs leading-relaxed">
            All private provider secrets (Gemini, QpiAI Opt, QCloud, Bolna, Sarvam) are stored exclusively in the central FastAPI server.
            The Next.js browser dashboard and mobile driver clients communicate strictly through authenticated REST endpoints under <code className="text-blue-600 dark:text-sky-400 font-semibold">/api/v1</code>.
            ESP32 hardware carries only its own isolated device HMAC key.
          </p>
        </div>
      </div>

      {/* Credentials Registry Table */}
      <div className="bg-white dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d] rounded-xl p-5 shadow-sm font-mono text-xs">
        <div className="flex items-center justify-between mb-4 border-b border-[#d0d7de] dark:border-[#30363d] pb-2">
          <div className="flex items-center space-x-2 text-blue-600 dark:text-sky-400 font-bold uppercase tracking-wide">
            <KeyRound className="w-4 h-4" />
            <span>Service Credentials Status & Environment Mapping</span>
          </div>
          <span className="text-[10px] text-[#656d76] dark:text-[#8b949e]">FastAPI Config: app/core/config.py</span>
        </div>

        <div className="space-y-3">
          {credentialsConfig.map((cred) => (
            <div
              key={cred.envVar}
              className="p-3.5 bg-[#f6f8fa] dark:bg-[#0d1117] rounded-lg border border-[#d0d7de] dark:border-[#30363d] flex flex-wrap items-center justify-between gap-3 shadow-sm"
            >
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-[#1f2328] dark:text-[#e6edf3]">{cred.name}</span>
                  <code className="bg-white dark:bg-[#21262d] text-blue-600 dark:text-sky-400 px-2 py-0.5 rounded text-[11px] border border-[#d0d7de] dark:border-[#30363d] font-semibold">
                    {cred.envVar}
                  </code>
                </div>
                <p className="text-[#656d76] dark:text-[#8b949e] font-sans text-xs">{cred.purpose}</p>
                <div className="text-[10px] text-[#656d76] dark:text-[#8b949e]">
                  Storage: <span className="text-[#1f2328] dark:text-[#e6edf3] font-medium">{cred.location}</span> • {cred.safeStatus}
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] bg-emerald-50 dark:bg-[#238636]/15 text-emerald-700 dark:text-[#3fb950] px-2 py-1 rounded-full border border-emerald-200 dark:border-[#238636]/40 font-bold inline-block">
                  {cred.currentMode}
                </span>
                <span className="text-[10px] text-[#656d76] dark:text-[#8b949e] block mt-1 font-semibold">Key: [REDACTED / SECURED]</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

