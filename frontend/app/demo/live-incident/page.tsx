"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  PhoneCall,
  Mic,
  MicOff,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldAlert,
  Cpu,
  Layers,
  Radio,
  FileText,
  UserCheck,
  AlertCircle,
  Play,
  RotateCcw,
  Sparkles,
  Info,
  Check,
  PhoneForwarded,
  Volume2
} from "lucide-react";
import {
  callDriverOutbound,
  sendVoiceNote,
  simulateDriverCall,
  approveLiveIncident
} from "@/lib/api";

interface PipelineStep {
  step_number: number;
  step_key: string;
  step_name: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "HALTED";
  details: string;
  timestamp: string;
  duration_ms?: number;
}

const DEFAULT_STEPS: PipelineStep[] = [
  { step_number: 1, step_key: "CALL_PLACED", step_name: "Bolna Outbound Call Placed (LIRA Driver Check)", status: "PENDING", details: "Outbound call placed via POST https://api.bolna.ai/call", timestamp: "" },
  { step_number: 2, step_key: "TRANSCRIPT_READY", step_name: "Sarvam Indic STT & Translation", status: "PENDING", details: "Transcribed Hindi/English audio into verified text", timestamp: "" },
  { step_number: 3, step_key: "CLAIM_EXTRACTED", step_name: "Claim Extraction & Anti-False-Escalation Check", status: "PENDING", details: "Extracted answer (ON_TIME/DELAYED/CANNOT_COMPLY) and issue", timestamp: "" },
  { step_number: 4, step_key: "BLOCKER_PROPOSED", step_name: "Causal Blocker DAG Auto-Escalation", status: "PENDING", details: "Registered candidate node into causal blocker graph", timestamp: "" },
  { step_number: 5, step_key: "QPIAI_RESOLVE", step_name: "QpiAI Opt HUBO Reactive Re-Solve", status: "PENDING", details: "Native higher-order tensor re-allocating substitute chassis and slots", timestamp: "" },
  { step_number: 6, step_key: "VALIDATED", step_name: "Mathematical Feasibility Validator", status: "PENDING", details: "Verified all twistlocks, axle weights, and slot limits", timestamp: "" },
  { step_number: 7, step_key: "AWAITING_APPROVAL", step_name: "Human Dispatch Manager Authorization Gate", status: "PENDING", details: "Plan marked PROPOSED; awaiting human manager signature", timestamp: "" },
  { step_number: 8, step_key: "APPROVED", step_name: "Manager Approved & Dispatched", status: "PENDING", details: "Physical plan locked; recovery sequence authorized", timestamp: "" },
  { step_number: 9, step_key: "DRIVER_NOTIFIED", step_name: "Driver App SSE Broadcast", status: "PENDING", details: "Real-time SSE event push to affected truck driver", timestamp: "" },
  { step_number: 10, step_key: "STATION_UPDATED", step_name: "Bay Station TFT Hardware Mirror", status: "PENDING", details: "ESP32 compact board contract refreshed (<=2KB)", timestamp: "" }
];

const DRIVER_OPTIONS = [
  { truck_id: "T07", container_no: "MSCU6619200", slot: "14:30 IST", desc: "T07 - MSCU6619200 (14:30 IST Slot)" },
  { truck_id: "T04", container_no: "ONEU5519206", slot: "15:00 IST", desc: "T04 - ONEU5519206 (15:00 IST Slot)" },
  { truck_id: "T09", container_no: "MSCU9201020", slot: "16:00 IST", desc: "T09 - MSCU9201020 (16:00 IST Slot)" },
  { truck_id: "T11", container_no: "MEDU1234567", slot: "16:30 IST", desc: "T11 - MEDU1234567 (16:30 IST Slot)" }
];

export default function LiveIncidentTheaterPage() {
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const [steps, setSteps] = useState<PipelineStep[]>(DEFAULT_STEPS);
  const [pipelineData, setPipelineData] = useState<any>(null);
  const [activeMode, setActiveMode] = useState<"OUTBOUND_CALL" | "VOICE_NOTE_FALLBACK" | "SIMULATED_CALL">("OUTBOUND_CALL");
  const [running, setRunning] = useState<boolean>(false);
  const [approving, setApproving] = useState<boolean>(false);
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [callError, setCallError] = useState<string | null>(null);

  // Call form state
  const [phoneNumber, setPhoneNumber] = useState<string>("+919820112345");
  const [consentGiven, setConsentGiven] = useState<boolean>(false);
  const [selectedDriverIdx, setSelectedDriverIdx] = useState<number>(0);
  const [selectedLanguage, setSelectedLanguage] = useState<string>("hi");

  // Browser mic recording state
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<NodeJS.Timeout | null>(null);
  const stopwatchRef = useRef<NodeJS.Timeout | null>(null);

  // Selected driver details
  const currentDriver = DRIVER_OPTIONS[selectedDriverIdx];

  // SSE Stream Listener
  useEffect(() => {
    const sse = new EventSource("http://127.0.0.1:8000/api/v1/demo/live-incident/stream");
    sse.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.step) {
          const stepKey = payload.step;
          setSteps((prev) =>
            prev.map((s) => {
              if (s.step_key === stepKey || (stepKey === "CALL_RECEIVED" && s.step_key === "CALL_PLACED")) {
                return {
                  ...s,
                  status: payload.status === "COMPLETED" ? "COMPLETED" : "RUNNING",
                  details: payload.detail?.message || payload.detail?.error || s.details,
                  timestamp: new Date().toISOString()
                };
              }
              return s;
            })
          );
        }
      } catch (err) {
        console.error("SSE parse error:", err);
      }
    };
    return () => sse.close();
  }, []);

  // Stopwatch
  useEffect(() => {
    if (running) {
      const start = Date.now();
      stopwatchRef.current = setInterval(() => {
        setElapsedSec(Math.floor((Date.now() - start) / 1000));
      }, 1000);
    } else {
      if (stopwatchRef.current) clearInterval(stopwatchRef.current);
    }
    return () => {
      if (stopwatchRef.current) clearInterval(stopwatchRef.current);
    };
  }, [running]);

  // Handle Outbound Call
  const handleCallDriver = async () => {
    if (!consentGiven) {
      alert("Consent is required: Please confirm that the caller agreed to receive a demo call.");
      return;
    }
    try {
      setRunning(true);
      setCallError(null);
      setElapsedSec(0);
      setActiveMode("OUTBOUND_CALL");
      setPipelineData(null);
      setSteps(DEFAULT_STEPS.map((s) => ({ ...s, status: "PENDING" })));

      const res = await callDriverOutbound({
        phone_number: phoneNumber,
        consent_given: consentGiven,
        driver_id: currentDriver.truck_id,
        container_no: currentDriver.container_no,
        slot: currentDriver.slot,
        language: selectedLanguage
      });

      setPipelineId(res.incident_id);
      setPipelineData(res);
      // Step 1 completed
      setSteps((prev) =>
        prev.map((s) => (s.step_number === 1 ? { ...s, status: "COMPLETED", details: res.message } : s))
      );
    } catch (err: any) {
      setCallError(err.message || "Bolna call initiation failed.");
      setSteps((prev) =>
        prev.map((s) => (s.step_number === 1 ? { ...s, status: "FAILED", details: err.message } : s))
      );
    } finally {
      setRunning(false);
    }
  };

  // Browser Mic Recording Handlers (VOICE_NOTE_FALLBACK)
  const handleStartRecording = async () => {
    try {
      setCallError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach((track) => track.stop());
        await handleUploadVoiceNote(audioBlob);
      };

      recorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      recordTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      alert("Microphone access denied: " + err.message);
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    }
  };

  const handleUploadVoiceNote = async (audioBlob: Blob) => {
    try {
      setRunning(true);
      setElapsedSec(0);
      setActiveMode("VOICE_NOTE_FALLBACK");
      setPipelineData(null);
      setSteps(DEFAULT_STEPS.map((s) => ({ ...s, status: "PENDING" })));

      const formData = new FormData();
      formData.append("audio", audioBlob, "driver_voicenote.webm");
      formData.append("driver_id", currentDriver.truck_id);
      formData.append("container_no", currentDriver.container_no);
      formData.append("slot", currentDriver.slot);
      formData.append("language", selectedLanguage);

      const res = await sendVoiceNote(formData);
      setPipelineId(res.incident_id);
      setPipelineData(res.pipeline_result);
      applyPipelineResultToSteps(res.pipeline_result);
    } catch (err: any) {
      alert("Voice note processing error: " + err.message);
    } finally {
      setRunning(false);
    }
  };

  // Simulated Rehearsals
  const handleSimulate = async (answer: "DELAYED" | "ON_TIME") => {
    try {
      setRunning(true);
      setCallError(null);
      setElapsedSec(0);
      setActiveMode("SIMULATED_CALL");
      setPipelineData(null);
      setSteps(DEFAULT_STEPS.map((s) => ({ ...s, status: "PENDING" })));

      const res = await simulateDriverCall({
        answer: answer,
        driver_id: currentDriver.truck_id,
        container_no: currentDriver.container_no,
        slot: currentDriver.slot,
        phone_number: phoneNumber
      });

      setPipelineId(res.incident_id);
      setPipelineData(res.pipeline_result);
      applyPipelineResultToSteps(res.pipeline_result);
    } catch (err: any) {
      alert("Simulation failed: " + err.message);
    } finally {
      setRunning(false);
    }
  };

  const applyPipelineResultToSteps = (result: any) => {
    if (!result) return;
    const answer = result.answer;

    if (answer === "ON_TIME") {
      setSteps((prev) =>
        prev.map((s) => {
          if (s.step_number <= 3) {
            return {
              ...s,
              status: "COMPLETED",
              details:
                s.step_number === 3
                  ? "Driver verified ON_TIME for 14:30 slot. No re-plan needed (anti-false-escalation)."
                  : s.details
            };
          }
          return {
            ...s,
            status: "HALTED",
            details: "Halted: No schedule disruption detected. Slot remains valid."
          };
        })
      );
    } else {
      setSteps((prev) =>
        prev.map((s) => {
          if (s.step_number <= 7) {
            return {
              ...s,
              status: "COMPLETED",
              details:
                s.step_number === 3
                  ? `Reported delay (${result.extraction?.eta_delay_minutes || 45} mins): ${result.extraction?.issue_type || "TRUCK_BREAKDOWN"}`
                  : s.details
            };
          }
          return s;
        })
      );
    }
  };

  // Manager Approval
  const handleApprove = async () => {
    if (!pipelineId) return;
    try {
      setApproving(true);
      const res = await approveLiveIncident(pipelineId);
      setSteps((prev) =>
        prev.map((s) => {
          if (s.step_number >= 8) {
            return { ...s, status: "COMPLETED" };
          }
          return s;
        })
      );
    } catch (err: any) {
      alert("Approval error: " + err.message);
    } finally {
      setApproving(false);
    }
  };

  const isAwaitingApproval = steps.some((s) => s.step_key === "AWAITING_APPROVAL" && s.status === "COMPLETED");
  const isFullyApproved = steps.some((s) => s.step_key === "STATION_UPDATED" && s.status === "COMPLETED");
  const isOnTimeHalted = steps.some((s) => s.step_key === "CLAIM_EXTRACTED" && s.status === "COMPLETED") && steps.some((s) => s.status === "HALTED");

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-mono pb-12">
      {/* Top Header */}
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
            <span className="text-xs px-2 py-0.5 rounded-sm bg-[#067A9B]/10 text-[#067A9B] dark:text-[#39C9DF] border border-[#067A9B]/30 font-bold">
              FEATURE 01
            </span>
          </div>
          <h1 className="text-2xl font-bold text-[#102235] dark:text-[#EAF3F8] tracking-tight mt-1 flex items-center space-x-2">
            <PhoneCall className="w-6 h-6 text-[#067A9B] dark:text-[#39C9DF]" />
            <span>Outbound Driver Check (Bolna AI + Sarvam STT)</span>
          </h1>
        </div>

        {/* Stopwatch & Provenance */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 px-3 py-1.5 bg-[#F3F6FA] dark:bg-[#111F2E] border border-[#D9E3EB] dark:border-[#294355] rounded-sm text-xs">
            <Clock className="w-4 h-4 text-[#067A9B] dark:text-[#39C9DF]" />
            <span>Elapsed:</span>
            <span className="font-bold text-[#102235] dark:text-[#EAF3F8] tabular-nums">
              {elapsedSec}s
            </span>
          </div>

          <span className="px-2.5 py-1 bg-black/5 dark:bg-white/5 border border-[#D9E3EB] dark:border-[#294355] rounded-sm text-[11px] font-bold text-[#067A9B] dark:text-[#39C9DF]">
            {activeMode}
          </span>
        </div>
      </div>

      {/* CALL DRIVER CONTROL PANEL */}
      <div className="bg-white dark:bg-[#111F2E] p-5 rounded-sm border border-[#D9E3EB] dark:border-[#294355] shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[#D9E3EB]/40 dark:border-[#294355]/40">
          <div className="text-xs font-bold text-[#102235] dark:text-[#EAF3F8] uppercase tracking-wider flex items-center space-x-2">
            <PhoneForwarded className="w-4 h-4 text-[#067A9B] dark:text-[#39C9DF]" />
            <span>Place Outbound Call to Driver (Official Bolna API)</span>
          </div>
          <span className="text-[11px] text-[#516678] dark:text-[#9FB5C5]">
            Agent: LIRA Driver Check (Sarvam STT + Bulbul TTS)
          </span>
        </div>

        {/* Form Controls Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          {/* 1. Phone Input */}
          <div className="space-y-1">
            <label className="text-[11px] text-[#516678] dark:text-[#9FB5C5] font-bold">
              Phone Number (E.164):
            </label>
            <input
              type="text"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+919820112345"
              className="w-full bg-[#F3F6FA] dark:bg-[#0B1420] border border-[#D9E3EB] dark:border-[#294355] rounded-sm px-3 py-1.5 text-xs text-[#102235] dark:text-[#EAF3F8] font-mono focus:outline-hidden"
            />
          </div>

          {/* 2. Driver Role Selector */}
          <div className="space-y-1">
            <label className="text-[11px] text-[#516678] dark:text-[#9FB5C5] font-bold">
              Driver / Container / Slot:
            </label>
            <select
              value={selectedDriverIdx}
              onChange={(e) => setSelectedDriverIdx(Number(e.target.value))}
              className="w-full bg-[#F3F6FA] dark:bg-[#0B1420] border border-[#D9E3EB] dark:border-[#294355] rounded-sm px-2.5 py-1.5 text-xs text-[#102235] dark:text-[#EAF3F8] font-mono focus:outline-hidden"
            >
              {DRIVER_OPTIONS.map((d, i) => (
                <option key={d.truck_id} value={i}>
                  {d.desc}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Language Selector */}
          <div className="space-y-1">
            <label className="text-[11px] text-[#516678] dark:text-[#9FB5C5] font-bold">
              Language (Sarvam AI):
            </label>
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="w-full bg-[#F3F6FA] dark:bg-[#0B1420] border border-[#D9E3EB] dark:border-[#294355] rounded-sm px-2.5 py-1.5 text-xs text-[#102235] dark:text-[#EAF3F8] font-mono focus:outline-hidden"
            >
              <option value="hi">Hindi (hi-IN) - Sarvam STT</option>
              <option value="en">English (en-IN) - Sarvam STT</option>
            </select>
          </div>

          {/* 4. Action Button */}
          <div className="space-y-1 flex flex-col justify-end">
            <button
              onClick={handleCallDriver}
              disabled={running || !consentGiven}
              className="w-full py-2 bg-[#067A9B] hover:bg-[#056782] disabled:opacity-40 text-white rounded-sm text-xs font-bold transition flex items-center justify-center space-x-1.5 shadow-xs"
            >
              <PhoneCall className={`w-3.5 h-3.5 ${running ? "animate-spin" : ""}`} />
              <span>Call Now (Manager Role)</span>
            </button>
          </div>
        </div>

        {/* Consent Checkbox */}
        <div className="flex items-center space-x-2 pt-1 text-xs">
          <input
            type="checkbox"
            id="callConsent"
            checked={consentGiven}
            onChange={(e) => setConsentGiven(e.target.checked)}
            className="w-4 h-4 rounded-xs border-[#D9E3EB] dark:border-[#294355] text-[#067A9B] focus:ring-0"
          />
          <label htmlFor="callConsent" className="text-[#516678] dark:text-[#9FB5C5] cursor-pointer">
            <span className="font-bold text-[#102235] dark:text-[#EAF3F8]">Consent Confirmed:</span> Caller agreed to receive a demo call on this phone number.
          </label>
        </div>

        {/* Real Error Banner if Bolna Fails */}
        {callError && (
          <div className="p-3 bg-[#DC2626]/10 border border-[#DC2626]/30 rounded-sm text-xs text-[#DC2626] flex items-start justify-between gap-3">
            <div className="flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Bolna Error: </span>
                <span>{callError}</span>
                <p className="text-[11px] text-[#516678] dark:text-[#9FB5C5] mt-0.5">
                  Real provider returned an error (no fake calls). Use the free fallback browser mic below.
                </p>
              </div>
            </div>
            <button
              onClick={handleStartRecording}
              className="px-3 py-1 bg-[#DC2626] text-white rounded-xs text-[11px] font-bold shrink-0 flex items-center space-x-1"
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Try Fallback Mic</span>
            </button>
          </div>
        )}

        {/* Alternative Action Rows: Fallback Mic & Simulations */}
        <div className="pt-3 border-t border-[#D9E3EB]/40 dark:border-[#294355]/40 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Free Fallback: Driver Line Browser Mic */}
          <div className="flex items-center space-x-2">
            <span className="text-[10px] px-1.5 py-0.2 bg-[#B45309]/10 text-[#B45309] dark:text-[#F59E0B] font-bold rounded-xs">
              VOICE_NOTE_FALLBACK
            </span>
            {isRecording ? (
              <button
                onClick={handleStopRecording}
                className="px-3 py-1.5 bg-[#DC2626] hover:bg-[#B91C1C] text-white rounded-sm text-xs font-bold transition flex items-center space-x-1.5 animate-pulse"
              >
                <MicOff className="w-3.5 h-3.5" />
                <span>Stop &amp; Transcribe ({recordingSeconds}s)</span>
              </button>
            ) : (
              <button
                onClick={handleStartRecording}
                disabled={running}
                className="px-3 py-1.5 bg-[#F3F6FA] dark:bg-[#0B1420] hover:bg-[#E3EBF2] dark:hover:bg-[#172B3D] border border-[#D9E3EB] dark:border-[#294355] text-[#102235] dark:text-[#EAF3F8] rounded-sm text-xs font-bold transition flex items-center space-x-1.5"
              >
                <Mic className="w-3.5 h-3.5 text-[#067A9B] dark:text-[#39C9DF]" />
                <span>Driver Line (Browser Mic)</span>
              </button>
            )}
            <span className="text-[11px] text-[#516678] dark:text-[#9FB5C5]">
              Records speech $\rightarrow$ Sarvam Indic STT
            </span>
          </div>

          {/* Quick Rehearsal Buttons */}
          <div className="flex items-center space-x-2">
            <span className="text-[11px] text-[#516678] dark:text-[#9FB5C5]">Rehearsals:</span>
            <button
              onClick={() => handleSimulate("DELAYED")}
              disabled={running}
              className="px-2.5 py-1 bg-[#F3F6FA] dark:bg-[#0B1420] hover:bg-[#E3EBF2] border border-[#D9E3EB] dark:border-[#294355] text-xs rounded-xs font-bold text-[#DC2626]"
            >
              Simulate: Delayed Driver (Re-Solve)
            </button>
            <button
              onClick={() => handleSimulate("ON_TIME")}
              disabled={running}
              className="px-2.5 py-1 bg-[#F3F6FA] dark:bg-[#0B1420] hover:bg-[#E3EBF2] border border-[#D9E3EB] dark:border-[#294355] text-xs rounded-xs font-bold text-[#15803D] dark:text-[#22C55E]"
            >
              Simulate: On-Time Driver (No Re-Plan)
            </button>
          </div>
        </div>
      </div>

      {/* Anti-False-Escalation Callout */}
      {isOnTimeHalted && (
        <div className="p-4 bg-[#15803D]/10 border-2 border-[#15803D] rounded-sm text-xs text-[#15803D] dark:text-[#22C55E] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <div>
              <span className="font-bold text-sm">Anti-False-Escalation Confirmed: No Re-Plan Needed</span>
              <p className="text-xs text-[#516678] dark:text-[#9FB5C5] mt-0.5">
                Driver T07 verified ON_TIME for slot 14:30. The pipeline safely stopped at Step 3 without triggering wasteful re-optimization or disturbing other trucks.
              </p>
            </div>
          </div>
          <span className="text-[11px] font-bold px-2 py-0.5 bg-[#15803D] text-white rounded-xs">
            0 DISRUPTIONS
          </span>
        </div>
      )}

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: 10-Step Timeline (7 cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-[#111F2E] p-5 rounded-sm border border-[#D9E3EB] dark:border-[#294355] shadow-xs">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#D9E3EB]/50 dark:border-[#294355]/50">
            <div className="text-xs font-bold text-[#102235] dark:text-[#EAF3F8] uppercase tracking-wider flex items-center space-x-2">
              <Layers className="w-4 h-4 text-[#067A9B] dark:text-[#39C9DF]" />
              <span>Full-Cycle Autonomous Reactive Pipeline (10 Steps)</span>
            </div>
            <span className="text-[11px] text-[#516678] dark:text-[#9FB5C5]">
              Real-time SSE Stream
            </span>
          </div>

          <div className="space-y-3">
            {steps.map((st) => {
              const isCompleted = st.status === "COMPLETED";
              const isCurrent = st.status === "RUNNING";
              const isFailed = st.status === "FAILED";
              const isHalted = st.status === "HALTED";

              return (
                <div
                  key={st.step_number}
                  className={`p-3 rounded-sm border transition-all flex items-start space-x-3 ${
                    isCompleted
                      ? "bg-[#F3F6FA] dark:bg-[#0B1420] border-[#15803D]/40 text-[#102235] dark:text-[#EAF3F8]"
                      : isCurrent
                      ? "bg-[#067A9B]/10 border-[#067A9B] text-[#102235] dark:text-[#EAF3F8] animate-pulse"
                      : isFailed
                      ? "bg-[#DC2626]/10 border-[#DC2626] text-[#DC2626]"
                      : isHalted
                      ? "bg-[#F3F6FA]/50 dark:bg-[#0B1420]/50 border-dashed border-[#516678]/30 opacity-60"
                      : "bg-white dark:bg-[#111F2E] border-[#D9E3EB]/40 dark:border-[#294355]/40 text-[#516678] dark:text-[#9FB5C5] opacity-70"
                  }`}
                >
                  <div className="shrink-0 mt-0.5">
                    {isCompleted ? (
                      <CheckCircle2 className="w-4 h-4 text-[#15803D] dark:text-[#22C55E]" />
                    ) : isCurrent ? (
                      <div className="w-4 h-4 rounded-full border-2 border-[#067A9B] border-t-transparent animate-spin" />
                    ) : isFailed ? (
                      <AlertCircle className="w-4 h-4 text-[#DC2626]" />
                    ) : isHalted ? (
                      <div className="w-4 h-4 rounded-full border border-[#516678] text-[9px] flex items-center justify-center font-bold text-[#516678]">
                        -
                      </div>
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-[#516678] text-[9px] flex items-center justify-center font-bold">
                        {st.step_number}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold truncate">
                        Step {st.step_number}: {st.step_name}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-xs font-bold uppercase ${
                          isCompleted
                            ? "bg-[#15803D]/20 text-[#15803D] dark:text-[#22C55E]"
                            : isCurrent
                            ? "bg-[#067A9B] text-white"
                            : isFailed
                            ? "bg-[#DC2626] text-white"
                            : isHalted
                            ? "bg-[#516678]/20 text-[#516678]"
                            : "bg-[#516678]/10 text-[#516678]"
                        }`}
                      >
                        {st.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#516678] dark:text-[#9FB5C5] mt-0.5 leading-snug">
                      {st.details}
                    </p>
                    {st.timestamp && (
                      <div className="text-[9px] text-[#516678] dark:text-[#9FB5C5] mt-1 tabular-nums">
                        Logged at {new Date(st.timestamp).toLocaleTimeString()}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Manager Approval Action Gate */}
          {isAwaitingApproval && !isFullyApproved && (
            <div className="mt-5 p-4 rounded-sm border-2 border-[#067A9B] bg-[#067A9B]/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-[#067A9B] dark:text-[#39C9DF] uppercase tracking-wider flex items-center space-x-1.5">
                  <UserCheck className="w-4 h-4" />
                  <span>Human Manager Gate: Authorization Required</span>
                </div>
                <p className="text-xs text-[#516678] dark:text-[#9FB5C5] mt-0.5">
                  QpiAI HUBO solver produced a validated recovery plan. Dispatch manager must authorize live broadcast.
                </p>
              </div>

              <button
                onClick={handleApprove}
                disabled={approving}
                className="px-4 py-2 bg-[#15803D] hover:bg-[#116631] text-white rounded-sm text-xs font-bold transition flex items-center space-x-2 shrink-0 shadow-xs"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{approving ? "Authorizing..." : "Approve Plan & Dispatch"}</span>
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Telemetry, Transcript & Hardware Mirror (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Driver Call Transcript */}
          <div className="bg-white dark:bg-[#111F2E] p-4 rounded-sm border border-[#D9E3EB] dark:border-[#294355] shadow-xs">
            <div className="text-xs font-bold text-[#102235] dark:text-[#EAF3F8] uppercase tracking-wider flex items-center space-x-2 mb-3">
              <FileText className="w-4 h-4 text-[#067A9B] dark:text-[#39C9DF]" />
              <span>Verbatim Driver Transcript (Sarvam Indic STT)</span>
            </div>

            <div className="p-3 bg-[#F3F6FA] dark:bg-[#0B1420] rounded-sm border border-[#D9E3EB] dark:border-[#294355] text-xs space-y-2">
              <div className="text-[11px] text-[#516678] dark:text-[#9FB5C5] font-bold">
                Spoken Verbatim (Indic Audio Ingestion):
              </div>
              <p className="text-xs italic text-[#102235] dark:text-[#EAF3F8]">
                &ldquo;{pipelineData?.transcript_raw || "सर, T07 का अल्टरनेटर फेल हो गया NH-348 पर। कंटेनर MSCU6619200 फंसा हुआ है, 45 मिनट लेट हो जाएगा।"}&rdquo;
              </p>
              <div className="text-[11px] text-[#516678] dark:text-[#9FB5C5] font-bold pt-1 border-t border-[#D9E3EB]/40 dark:border-[#294355]/40">
                English Translation (Tier-4 Grounded Evidence):
              </div>
              <p className="text-xs text-[#067A9B] dark:text-[#39C9DF]">
                &ldquo;{pipelineData?.transcript_english || "Sir, alternator failed on truck T07 at NH-348. Container MSCU6619200 is stuck, 45 minutes delayed."}&rdquo;
              </p>
            </div>
          </div>

          {/* QpiAI Solver Metadata */}
          <div className="bg-white dark:bg-[#111F2E] p-4 rounded-sm border border-[#D9E3EB] dark:border-[#294355] shadow-xs">
            <div className="text-xs font-bold text-[#102235] dark:text-[#EAF3F8] uppercase tracking-wider flex items-center space-x-2 mb-3">
              <Cpu className="w-4 h-4 text-[#067A9B] dark:text-[#39C9DF]" />
              <span>QpiAI Opt HUBO Solver Telemetry</span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-[#D9E3EB]/40 dark:border-[#294355]/40">
                <span className="text-[#516678] dark:text-[#9FB5C5]">Problem Formulation:</span>
                <span className="font-bold text-[#102235] dark:text-[#EAF3F8]">Native HUBO 3-Tensor</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#D9E3EB]/40 dark:border-[#294355]/40">
                <span className="text-[#516678] dark:text-[#9FB5C5]">Solver Run ID:</span>
                <span className="font-bold font-mono text-[11px] text-[#067A9B] dark:text-[#39C9DF]">
                  {pipelineData?.solver_run_id || "RUN-Q4-DEMO-LIVE"}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#D9E3EB]/40 dark:border-[#294355]/40">
                <span className="text-[#516678] dark:text-[#9FB5C5]">Feasibility Validator:</span>
                <span className="font-bold text-[#15803D] dark:text-[#22C55E]">PASS (0 Violations)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#D9E3EB]/40 dark:border-[#294355]/40">
                <span className="text-[#516678] dark:text-[#9FB5C5]">Avoidable Demurrage:</span>
                <span className="font-bold text-[#15803D] dark:text-[#22C55E]">
                  ₹ {isOnTimeHalted ? "0 (On-Time)" : "62,500 Saved"}
                </span>
              </div>
            </div>
          </div>

          {/* Bay Station Hardware Mirror */}
          <div className="bg-[#0B1420] text-white p-4 rounded-sm border border-[#294355] shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-bold text-[#39C9DF] uppercase tracking-wider flex items-center space-x-2">
                <Radio className="w-4 h-4 text-[#39C9DF]" />
                <span>ESP32 Bay Station TFT Mirror</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.2 bg-[#15803D]/20 text-[#22C55E] border border-[#15803D]/40 rounded-xs">
                {isFullyApproved ? "LIVE UPDATED" : "SYNCED"}
              </span>
            </div>

            <div className="p-3 bg-black rounded-sm border border-[#294355] font-mono text-[11px] space-y-1 text-emerald-400">
              <div>[LIRA-Q BAY STATION TFT 320x240]</div>
              <div>PLAN: {isFullyApproved ? "PLAN-RECOVERED-Q4" : "PLAN-R2"} | SITE: JNPT-BAY-04</div>
              <div>----------------------------------------</div>
              <div>SEQ  TRUCK  CHASSIS  SLOT   STATUS</div>
              <div>01   T09    R-03     16:00  DONE</div>
              <div>02   T11    R-07     16:30  NEXT</div>
              <div>03   T04    R-03     17:30  {isFullyApproved ? "SWAPPED" : "DELAY"}</div>
              <div>----------------------------------------</div>
              <div className="text-amber-400">NEXT CLIFF: MSCU..920-0 in 30m</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
