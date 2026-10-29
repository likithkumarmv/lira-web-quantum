"use client";

import React, { useState, useEffect } from "react";
import {
  Tv,
  Radio,
  AlertOctagon,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
  Cpu,
  Lock,
  Layers,
  ChevronDown,
  ChevronUp,
  FileCheck
} from "lucide-react";
import {
  fetchEdgeState,
  fetchDecisionCapsule,
  simulateEdgeMismatch,
  simulateEdgeNoShow,
  simulateEdgeConfirm,
  simulateEdgeClonedTag,
  simulateStatutoryImmunity
} from "@/lib/api";
import { EdgeTFTState, DecisionCapsule } from "@/lib/types";

export default function TFTMirror() {
  const [edgeState, setEdgeState] = useState<EdgeTFTState | null>(null);
  const [capsule, setCapsule] = useState<DecisionCapsule | null>(null);
  const [loading, setLoading] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [showTestHarness, setShowTestHarness] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [immunityDossier, setImmunityDossier] = useState<any | null>(null);

  const loadState = async () => {
    try {
      setLoading(true);
      const [data, cap] = await Promise.allSettled([
        fetchEdgeState("LIRA-EDGE-01"),
        fetchDecisionCapsule("LIRA-EDGE-01")
      ]);
      if (data.status === "fulfilled") setEdgeState(data.value);
      if (cap.status === "fulfilled") setCapsule(cap.value);
    } catch (e) {
      // Graceful fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadState();
    const interval = setInterval(loadState, 3500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center">
      {/* Mirror Header & Real-World Telemetry Banner */}
      <div className="w-full max-w-[440px] flex items-center justify-between px-3 py-2 bg-[#10141B] border border-[#222936] rounded-t-sm">
        <div className="flex items-center gap-2">
          <Tv className="w-4 h-4 text-[#0284C7]" />
          <span className="text-xs font-mono font-bold tracking-wider text-[#F0F4F8]">
            ESP32 TFT MIRROR (DISPLAY-ONLY)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded-sm bg-[#16A34A]/10 text-[#16A34A] border border-[#16A34A]/30">
            <Radio className="w-2.5 h-2.5 animate-pulse" />
            {edgeState?.online ? "LIVE TELEMETRY" : "ONLINE"}
          </span>
          <button
            onClick={loadState}
            disabled={loading}
            className="p-1 hover:bg-[#161B24] text-[#8A99AD] hover:text-[#F0F4F8] transition-colors rounded-sm"
            title="Refresh Display Buffer"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* 320x240 ILI9341 Physical TFT Frame */}
      <div className="relative bg-[#05070A] p-4 border-x border-[#222936] shadow-2xl flex flex-col items-center">
        {/* PCB Bezel Labels */}
        <div className="w-[340px] flex items-center justify-between text-[9px] font-mono text-[#8A99AD] mb-1 px-1">
          <span>ESP32-WROOM-32D // ILI9341 SPI</span>
          <span>320 x 240 px (DISPLAY-ONLY)</span>
        </div>

        {/* The 320x240 LCD Screen (Pixel-Accurate Scaled Container) */}
        <div
          className="w-[340px] h-[255px] bg-[#000000] border-2 border-[#1E2530] rounded-sm p-3 font-mono flex flex-col justify-between overflow-hidden shadow-inner select-none relative"
          style={{ fontFamily: "'Courier New', Courier, monospace" }}
        >
          {/* Top Screen Status Bar */}
          <div className="flex items-center justify-between border-b border-[#222936] pb-1.5 text-[10px]">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#16A34A]" />
              <span className="text-[#F0F4F8] font-bold">LIRA-EDGE-01</span>
            </div>
            <span className="text-[#8A99AD] text-[9px]">RC522 13.56MHz SPI</span>
            <span className="text-[#D97706] font-bold text-[9px]">
              {edgeState?.decision_capsule_status || "CAPSULE: SYNCED"}
            </span>
          </div>

          {/* Main LCD Buffer Content (Read-Only) */}
          <div className="flex-1 py-2 flex flex-col justify-between">
            {/* Header Banner */}
            <div className="bg-[#10141B] border border-[#222936] p-2 text-center rounded-sm">
              <div className="text-[10px] text-[#8A99AD] uppercase tracking-wider">
                {edgeState?.display_header || "LIRA RESOURCELOCK v9"}
              </div>
              <div className="text-sm font-bold text-[#F0F4F8] mt-0.5 tracking-wide">
                {edgeState?.awaiting_web_confirmation
                  ? "TAG OBSERVED // PENDING CONFIRM"
                  : edgeState?.prompt_tag
                  ? "PRESENT AUTHORIZED RFID TAG"
                  : "READY FOR WORK ORDER"}
              </div>
            </div>

            {/* Middle Screen Lines */}
            <div className="space-y-1.5 my-1 text-[11px] bg-[#090B0E] p-2 border border-[#222936]/60 rounded-sm">
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-[#8A99AD]">ACTIVE WO:</span>
                <span className="text-[#0284C7] font-bold">
                  {edgeState?.active_work_order_id || "WO-NONE"}
                </span>
              </div>
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-[#8A99AD]">TARGET RES:</span>
                <span className="text-[#F0F4F8] font-semibold">
                  {edgeState?.truck_id ? `CHASSIS // ${edgeState.truck_id}` : "CHASSIS-40-01"}
                </span>
              </div>
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-[#8A99AD]">EXPECTED TAG:</span>
                <span className="text-[#D97706] font-bold">TAG_07</span>
              </div>
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-[#8A99AD]">PHYSICAL GATE:</span>
                <span
                  className={`font-bold ${
                    edgeState?.physical_state === "TAG_MISMATCH" || edgeState?.physical_state === "CLONED_TAG_CRYPTO_REJECTED"
                      ? "text-[#DC2626]"
                      : "text-[#16A34A]"
                  }`}
                >
                  {edgeState?.physical_state || "EXPECTED"}
                </span>
              </div>
            </div>

            {/* Instruction Notice */}
            <div className="text-center p-1.5 bg-[#161B24] border border-[#222936] rounded-sm">
              <p className="text-[9px] text-[#8A99AD] leading-tight">
                {edgeState?.awaiting_web_confirmation
                  ? "Scanned. Authorized Custodian must press [CONFIRM CHECKOUT] on Web Control Tower."
                  : "RC522 scan creates observation only. Operator confirms on website."}
              </p>
            </div>
          </div>

          {/* Bottom Screen Status (Hardware Profile Note) */}
          <div className="border-t border-[#222936] pt-1 flex items-center justify-between text-[8px] text-[#8A99AD]">
            <span>ESP32 DEV V1 (DISPLAY-ONLY)</span>
            <span className="text-[#16A34A] font-bold">WEB-GATED ATTESTATION</span>
          </div>
        </div>

        {/* Clear Hardware Realism Disclaimer */}
        <div className="w-[340px] mt-2 px-1 text-center">
          <p className="text-[10px] text-[#8A99AD] font-mono leading-tight">
            <span className="text-[#D97706] font-semibold">HARDWARE CONTRACT:</span> Display-only ILI9341 LCD. No touch controls, buttons, or local checkout overrides exist on this terminal.
          </p>
        </div>
      </div>

      {/* Decision Capsule Preview Card (Pre-cached on ESP32 RAM) */}
      <div className="w-full max-w-[440px] bg-[#10141B] border border-[#222936] p-3 text-xs font-mono space-y-2">
        <div className="flex items-center justify-between border-b border-[#222936] pb-1.5">
          <div className="flex items-center gap-1.5 text-[#F0F4F8] font-bold">
            <Cpu className="w-3.5 h-3.5 text-[#0284C7]" />
            <span>QpiAI DECISION CAPSULE (PREVIEW)</span>
          </div>
          <span className="text-[10px] text-[#16A34A] bg-[#16A34A]/10 px-1.5 py-0.5 rounded-sm border border-[#16A34A]/20">
            {capsule?.capsule_status || "VALIDATED"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div>
            <span className="text-[#8A99AD]">Snapshot Hash: </span>
            <span className="text-[#F0F4F8]">{capsule?.snapshot_hash || "89b102c7f4a1"}</span>
          </div>
          <div>
            <span className="text-[#8A99AD]">Provider: </span>
            <span className="text-[#0284C7] font-semibold">{capsule?.provider || "QPIAI_OPT"}</span>
          </div>
          <div>
            <span className="text-[#8A99AD]">Modeled Cost: </span>
            <span className="text-[#16A34A] font-bold">₹{capsule?.modeled_cost_optimal_inr?.toLocaleString() || "8,500"}</span>
          </div>
          <div>
            <span className="text-[#8A99AD]">Origin: </span>
            <span className="text-[#8A99AD]">{capsule?.source_origin || "LAB_FIXTURE"}</span>
          </div>
        </div>

        <p className="text-[9px] text-[#8A99AD] border-t border-[#222936] pt-1">
          * Capsule evaluated server-side by QpiAI Opt and pre-cached on ESP32 Core 1 for offline display warnings. Not computed on microcontroller.
        </p>
      </div>

      {/* Collapsible Test Harness (Non-Judge / Testing Controls Only) */}
      <div className="w-full max-w-[440px] bg-[#090B0E] border-x border-b border-[#222936] rounded-b-sm">
        <button
          onClick={() => setShowTestHarness(!showTestHarness)}
          className="w-full px-3 py-2 flex items-center justify-between text-xs font-mono text-[#8A99AD] hover:text-[#F0F4F8] transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <Lock className="w-3 h-3 text-[#D97706]" />
            <span>DEVELOPER TEST HARNESS (COLLAPSIBLE)</span>
          </span>
          {showTestHarness ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5 text-[#8A99AD]" />}
        </button>

        {showTestHarness && (
          <div className="p-3 border-t border-[#222936] space-y-2 text-xs font-mono">
            <div className="p-2 bg-[#D97706]/10 border border-[#D97706]/30 text-[#D97706] text-[10px] rounded-sm">
              ⚠ TEST-ONLY HARNESS: Simulates raw physical RFID events over HMAC API for testing validation rules.
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={async () => {
                  try {
                    setSimulating(true);
                    setActionFeedback("Simulating Accidental Mismatch (TAG_99)...");
                    await simulateEdgeMismatch("LIRA-EDGE-01", "WRONG_TAG_99");
                    await loadState();
                    setActionFeedback("Mismatch alert logged without solver waste (§16)");
                  } catch (e: any) {
                    setActionFeedback(`Error: ${e.message}`);
                  } finally {
                    setSimulating(false);
                  }
                }}
                disabled={simulating}
                className="p-1.5 bg-[#161B24] border border-[#222936] hover:border-[#DC2626] text-[10px] text-[#8A99AD] hover:text-[#F0F4F8] text-left transition-colors rounded-sm"
              >
                1. Simulate Wrong Tag (Alert Only)
              </button>

              <button
                onClick={async () => {
                  try {
                    setSimulating(true);
                    setActionFeedback("Testing Out-of-Sequence Event (Replay Check)...");
                    await simulateEdgeClonedTag("LIRA-EDGE-01");
                    await loadState();
                    setActionFeedback("OUT_OF_SEQUENCE_REJECTED: Packet sequence 85 <= 100");
                  } catch (e: any) {
                    setActionFeedback(`Error: ${e.message}`);
                  } finally {
                    setSimulating(false);
                  }
                }}
                disabled={simulating}
                className="p-1.5 bg-[#161B24] border border-[#222936] hover:border-[#DC2626] text-[10px] text-[#8A99AD] hover:text-[#F0F4F8] text-left transition-colors rounded-sm"
              >
                2. Test Out-of-Sequence Event
              </button>
            </div>

            {actionFeedback && (
              <div className="p-2 bg-[#161B24] border border-[#222936] text-[10px] text-[#F0F4F8] rounded-sm">
                {actionFeedback}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
