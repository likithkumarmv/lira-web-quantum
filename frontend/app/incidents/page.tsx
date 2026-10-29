"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  FileText,
  Upload,
  AlertTriangle,
  ShieldAlert,
  Clock,
  ArrowRight,
  RefreshCw,
  Search,
  CheckCircle2,
  FileCode,
  Paperclip
} from "lucide-react";
import { fetchIncidents, ingestDocument, fetchIngestJob } from "@/lib/api";
import { Incident, IngestJob } from "@/lib/types";
import EvidenceViewer from "@/components/EvidenceViewer";

const PRESET_SCENARIOS = [
  {
    name: "Customs BoE Section 149 (C102)",
    containerId: "C102",
    sourceId: "SRC-MAERSK-EMAIL-01",
    tier: "T2",
    text: `FROM: operations@maersk-liner-agency.com
TO: logistics-dispatch@lira.in
SUBJECT: Exception Notice: Consignment C102 clearance variance

Container C102 arrived on vessel Maersk Saltoro.
Gross weight: 12,450 kg declared on invoice differs from Packing List (14,200 kg).
Bill of Entry pending amendment under Section 149.
Free time expires 2026-10-28 18:30 IST.
Immediate customs broker resolution required to avoid port demurrage.`
  },
  {
    name: "Direct Port Delivery (DPD) 48h Cliff (C105)",
    containerId: "C105",
    sourceId: "SRC-JNPT-TOS-DPD-02",
    tier: "T1",
    text: `TERMINAL NOTICE: JNPT Port Operations
VESSEL / BERTH: MSC Laurence / Berth 02
CONTAINER: C105 (DPD Priority)
DPD evacuation cutoff approaching: 48-hour DPD window expires at 19:30 IST.
Direct port delivery cliff warning: CFS transfer penalty applicable (₹15,000 en-route haulage) if not evacuated before deadline.`
  },
  {
    name: "Heavy-Haul Tri-Axle Chassis Mandate (C105)",
    containerId: "C105",
    sourceId: "SRC-WEIGHBRIDGE-SLIP-09",
    tier: "T1",
    text: `PORT WEIGHBRIDGE INWARD SLIP #WB-88192
CONTAINER ID: C105 (Auto Components)
Verified Gross Mass (VGM): cargo weight exceeds 24,000 kg (Actual: 26,000 kg).
Statutory Motor Vehicles Act: tri-axle chassis required. Tandem-axle dispatch prohibited.`
  },
  {
    name: "Perishable Reefer Genset Disconnect (C108)",
    containerId: "C108",
    sourceId: "SRC-REEFER-MONITOR-04",
    tier: "T2",
    text: `COLD CHAIN EXCEPTION: Reefer Container C108
CARGO: Frozen Seafood (-20C)
Current yard status: clip-on genset required prior to gate-out.
Trailer APU auxiliary power unit required to maintain temperature integrity during transit.`
  },
  {
    name: "FSSAI Statutory PGA Sampling Hold (C109)",
    containerId: "C109",
    sourceId: "SRC-ICEGATE-PGA-771",
    tier: "T1",
    text: `CUSTOMS ICEGATE STATUS ADVICE
CONTAINER: C109 | BILL OF ENTRY: 9912044
PGA STATUS: FSSAI statutory sampling pending physical inspection at CFS laboratory.
Customs release unconfirmed until testing lab NOC is uploaded.`
  },
  {
    name: "Empty Return Depot Rejection (C110)",
    containerId: "C110",
    sourceId: "SRC-DEPOT-LOG-33",
    tier: "T2",
    text: `DISPATCH NOTICE: NSICT Empty Holding Yard
CONTAINER: C110
NOTICE: empty return depot full. Gate security has suspended inward receipt.
Depot rejected empty box; equipment detention accumulation starting.`
  }
];

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [rawText, setRawText] = useState(PRESET_SCENARIOS[0].text);
  const [containerId, setContainerId] = useState("C102");
  const [sourceId, setSourceId] = useState("SRC-MAERSK-EMAIL-01");
  const [tier, setTier] = useState("T2");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [ingesting, setIngesting] = useState(false);
  const [activeJob, setActiveJob] = useState<IngestJob | null>(null);
  const [filterSeverity, setFilterSeverity] = useState("ALL");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchIncidents().then(setIncidents).catch(console.error);
  }, []);

  const handleApplyPreset = (p: typeof PRESET_SCENARIOS[0]) => {
    setSelectedFile(null);
    setRawText(p.text);
    setContainerId(p.containerId);
    setSourceId(p.sourceId);
    setTier(p.tier);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setSourceId(file.name);
      // Auto-detect container from filename or keep existing
      const m = file.name.match(/C\d{3}/i);
      if (m) setContainerId(m[0].toUpperCase());
    }
  };

  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIngesting(true);
      const formData = new FormData();
      if (selectedFile) {
        formData.append("file", selectedFile);
      } else {
        formData.append("raw_text", rawText);
      }
      formData.append("source_id", sourceId);
      formData.append("container_id", containerId);
      formData.append("tier", tier);

      const res = await ingestDocument(formData);
      // Fetch job details using API wrapper
      const jobData = await fetchIngestJob(res.job_id);
      setActiveJob(jobData);

      // Refresh incident list
      const updated = await fetchIncidents();
      setIncidents(updated);
    } catch (err) {
      console.error(err);
    } finally {
      setIngesting(false);
    }
  };

  const filteredIncidents = incidents.filter((inc) => {
    if (filterSeverity === "ALL") return true;
    return inc.severity === filterSeverity;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1f2328] dark:text-[#e6edf3] font-mono tracking-tight">
            Document Ingestion & Incident Queue
          </h1>
          <p className="text-[#656d76] dark:text-[#8b949e] text-xs mt-1">
            Multi-format evidence fabric extraction (PDF, EML, CSV, Text), verbatim quote verification, and causal blocker tracking.
          </p>
        </div>
      </div>

      {/* Top Document Upload Section */}
      <div className="bg-white dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d] rounded-xl p-5 shadow-sm">
        <div className="flex items-center space-x-2 mb-3">
          <Upload className="w-5 h-5 text-blue-600 dark:text-sky-400" />
          <h3 className="font-mono text-sm font-bold text-[#1f2328] dark:text-[#e6edf3] uppercase tracking-wide">
            Carrier Freight Ingestion (Gemini 1.5 Flash / Deterministic Evidence Fabric)
          </h3>
        </div>

        {/* Quick Presets for the 15 Freight Blocker Scenarios */}
        <div className="mb-4">
          <label className="block text-[10px] font-mono text-[#656d76] dark:text-[#8b949e] uppercase mb-1.5 font-bold">
            Freight Domain Scenarios (PRD v5.0 Master Presets):
          </label>
          <div className="flex flex-wrap gap-2">
            {PRESET_SCENARIOS.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleApplyPreset(p)}
                className="px-2.5 py-1 text-xs font-mono rounded bg-[#f6f8fa] dark:bg-[#21262d] border border-[#d0d7de] dark:border-[#30363d] hover:border-blue-500 hover:text-blue-600 dark:hover:text-sky-400 text-[#1f2328] dark:text-[#e6edf3] transition"
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleIngest} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-mono text-[#656d76] dark:text-[#8b949e] mb-1 font-semibold">CONTAINER ID:</label>
              <input
                type="text"
                value={containerId}
                onChange={(e) => setContainerId(e.target.value)}
                className="w-full bg-[#f6f8fa] dark:bg-[#0d1117] border border-[#d0d7de] dark:border-[#30363d] rounded-md px-3 py-1.5 text-xs font-mono text-[#1f2328] dark:text-[#e6edf3] focus:outline-none focus:border-blue-500 shadow-sm"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono text-[#656d76] dark:text-[#8b949e] mb-1 font-semibold">SOURCE IDENTIFIER:</label>
              <input
                type="text"
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
                className="w-full bg-[#f6f8fa] dark:bg-[#0d1117] border border-[#d0d7de] dark:border-[#30363d] rounded-md px-3 py-1.5 text-xs font-mono text-[#1f2328] dark:text-[#e6edf3] focus:outline-none focus:border-blue-500 shadow-sm"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono text-[#656d76] dark:text-[#8b949e] mb-1 font-semibold">AUTHORITY TIER:</label>
              <select
                value={tier}
                onChange={(e) => setTier(e.target.value)}
                className="w-full bg-[#f6f8fa] dark:bg-[#0d1117] border border-[#d0d7de] dark:border-[#30363d] rounded-md px-3 py-1.5 text-xs font-mono text-[#1f2328] dark:text-[#e6edf3] focus:outline-none focus:border-blue-500 shadow-sm"
              >
                <option value="T1">T1 — Statutory / Port TOS / Customs</option>
                <option value="T2">T2 — Carrier / Shipping Line / Terminal</option>
                <option value="T3">T3 — Telematics / IoT / Checkpoint</option>
                <option value="T4">T4 — Driver / Broker Phone Statement</option>
                <option value="T5">T5 — AI Interpretation / Unverified</option>
              </select>
            </div>
          </div>

          {/* File Upload or Raw Text */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-mono text-[#656d76] dark:text-[#8b949e] font-semibold">
                RAW FREIGHT TEXT OR UPLOAD FILE (PDF, EML, CSV, TXT):
              </label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs font-mono text-blue-600 dark:text-sky-400 hover:underline flex items-center space-x-1"
              >
                <Paperclip className="w-3.5 h-3.5" />
                <span>{selectedFile ? `Selected: ${selectedFile.name}` : "Attach File"}</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.eml,.csv,.txt"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {selectedFile ? (
              <div className="p-4 bg-[#f6f8fa] dark:bg-[#0d1117] border border-blue-500 rounded-md text-xs font-mono text-[#1f2328] dark:text-[#e6edf3] flex items-center justify-between">
                <div>
                  <span className="font-bold text-blue-600 dark:text-sky-400">{selectedFile.name}</span>
                  <span className="text-[#656d76] dark:text-[#8b949e] ml-2">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                  <div className="text-[11px] text-[#656d76] dark:text-[#8b949e] mt-1">
                    Will be parsed by backend multi-format engine ({selectedFile.name.split('.').pop()?.toUpperCase()} stream parser).
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  className="text-xs text-rose-500 hover:underline"
                >
                  Remove
                </button>
              </div>
            ) : (
              <textarea
                rows={5}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                className="w-full bg-[#f6f8fa] dark:bg-[#0d1117] border border-[#d0d7de] dark:border-[#30363d] rounded-md p-3 text-xs font-mono text-[#1f2328] dark:text-[#e6edf3] focus:outline-none focus:border-blue-500 leading-relaxed shadow-sm"
              />
            )}
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={ingesting}
              className="px-5 py-2 bg-[#2da44e] hover:bg-[#2c974b] text-white border border-[#2c974b] rounded-md font-mono text-xs font-semibold transition flex items-center space-x-2 shadow-sm disabled:opacity-50"
            >
              {ingesting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Extracting Evidence Spans...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>Run Evidence Extraction</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Evidence Viewer (If Ingested) */}
      {activeJob && (
        <div>
          <EvidenceViewer job={activeJob} />
        </div>
      )}

      {/* Incident Queue Table */}
      <div className="bg-white dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d] rounded-xl p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-blue-600 dark:text-sky-400" />
            <h3 className="font-mono text-sm font-bold text-[#1f2328] dark:text-[#e6edf3] uppercase tracking-wide">
              Active Exception Queue ({filteredIncidents.length})
            </h3>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs font-mono text-[#656d76] dark:text-[#8b949e]">Filter Severity:</span>
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="text-xs font-mono bg-[#f6f8fa] dark:bg-[#0d1117] border border-[#d0d7de] dark:border-[#30363d] rounded-md px-2.5 py-1 text-[#1f2328] dark:text-[#e6edf3]"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#f6f8fa] dark:bg-[#0d1117] text-[#656d76] dark:text-[#8b949e] border-b border-[#d0d7de] dark:border-[#30363d] uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-3">Container / ID</th>
                <th className="p-3">Severity</th>
                <th className="p-3">Status</th>
                <th className="p-3">Root Blocker</th>
                <th className="p-3">Owner Role</th>
                <th className="p-3">Deadline</th>
                <th className="p-3 text-right">Avoidable Cost</th>
                <th className="p-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#d0d7de] dark:divide-[#30363d]">
              {filteredIncidents.map((inc) => (
                <tr key={inc.incident_id} className="hover:bg-gray-50 dark:hover:bg-[#21262d]/50 transition">
                  <td className="p-3 font-bold text-blue-600 dark:text-sky-400">
                    <div>{inc.container_id}</div>
                    <div className="text-[10px] text-[#656d76] dark:text-[#8b949e] font-normal">{inc.incident_id}</div>
                  </td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        inc.severity === "CRITICAL"
                          ? "bg-red-100 dark:bg-[#da3633]/15 text-red-700 dark:text-[#f85149] border border-red-200 dark:border-[#da3633]/40"
                          : "bg-amber-100 dark:bg-[#d29922]/15 text-amber-700 dark:text-[#e3b341] border border-amber-200 dark:border-[#d29922]/40"
                      }`}
                    >
                      {inc.severity}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className="text-[#1f2328] dark:text-[#e6edf3]">{inc.status}</span>
                  </td>
                  <td className="p-3 font-medium text-[#1f2328] dark:text-[#e6edf3]">{inc.root_blocker_code}</td>
                  <td className="p-3 text-[#656d76] dark:text-[#8b949e]">{inc.owner_role}</td>
                  <td className="p-3 text-amber-600 dark:text-amber-400 font-semibold">18:30 IST</td>
                  <td className="p-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                    ₹{inc.projected_avoidable_cost_inr.toLocaleString("en-IN")}
                  </td>
                  <td className="p-3 text-center">
                    <Link
                      href={`/incidents/${inc.incident_id}`}
                      className="px-2.5 py-1 bg-[#f6f8fa] hover:bg-[#eaeef2] dark:bg-[#21262d] dark:hover:bg-[#30363d] text-blue-600 dark:text-sky-400 rounded-md border border-[#d0d7de] dark:border-[#30363d] font-semibold inline-flex items-center space-x-1 shadow-sm"
                    >
                      <span>DAG</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
