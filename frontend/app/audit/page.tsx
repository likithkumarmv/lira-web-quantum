"use client";

import React, { useState, useEffect } from "react";
import { History, ShieldCheck, Clock, FileText, Cpu, Radio, PhoneCall, RefreshCw } from "lucide-react";
import { fetchAuditEvents } from "@/lib/api";
import { AuditEvent } from "@/lib/types";

export default function AuditTimelinePage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAudit = async () => {
    try {
      setLoading(true);
      const data = await fetchAuditEvents();
      setEvents(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAudit();
  }, []);

  const getEventIcon = (type: string) => {
    if (type.includes("CALL")) return <PhoneCall className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
    if (type.includes("EDGE") || type.includes("RFID")) return <Radio className="w-4 h-4 text-blue-600 dark:text-cyan-400" />;
    if (type.includes("PLAN") || type.includes("SOLV")) return <Cpu className="w-4 h-4 text-indigo-600 dark:text-purple-400" />;
    if (type.includes("INGEST") || type.includes("DOC")) return <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
    return <Clock className="w-4 h-4 text-[#656d76] dark:text-slate-400" />;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1f2328] dark:text-[#e6edf3] font-mono tracking-tight flex items-center space-x-3">
            <span>Correlation Audit Trail & Decision Lineage</span>
          </h1>
          <p className="text-[#656d76] dark:text-[#8b949e] text-xs mt-1">
            Complete immutable ledger binding carrier documents, AI voice calls, QpiAI solver formulation, and ESP32 physical observations.
          </p>
        </div>

        <button
          onClick={loadAudit}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-white dark:bg-[#21262d] border border-[#d0d7de] dark:border-[#30363d] hover:bg-gray-50 dark:hover:bg-[#30363d] text-[#1f2328] dark:text-[#e6edf3] rounded-md text-xs font-mono transition shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-blue-600 dark:text-sky-400" : "text-[#656d76] dark:text-[#8b949e]"}`} />
          <span>Refresh Ledger</span>
        </button>
      </div>

      {/* Audit Timeline */}
      <div className="bg-white dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d] rounded-xl p-5 shadow-sm font-mono text-xs">
        <div className="space-y-4">
          {events.length > 0 ? (
            events.map((evt) => (
              <div
                key={evt.audit_id}
                className="p-3.5 bg-[#f6f8fa] dark:bg-[#0d1117] rounded-lg border border-[#d0d7de] dark:border-[#30363d] flex items-start space-x-3 hover:border-[#656d76] dark:hover:border-[#8b949e]/60 transition shadow-sm"
              >
                <div className="p-2 rounded-md bg-white dark:bg-[#21262d] border border-[#d0d7de] dark:border-[#30363d] shrink-0 mt-0.5">
                  {getEventIcon(evt.event_type)}
                </div>

                <div className="flex-1 space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-[#1f2328] dark:text-[#e6edf3] text-xs">{evt.event_type}</span>
                      <span className="text-[10px] bg-white dark:bg-[#21262d] text-[#656d76] dark:text-[#8b949e] px-1.5 py-0.5 rounded border border-[#d0d7de] dark:border-[#30363d]">
                        {evt.audit_id}
                      </span>
                      <span className="text-[10px] bg-blue-50 dark:bg-[#1f6feb]/15 text-blue-600 dark:text-[#58a6ff] px-1.5 py-0.5 rounded-full border border-blue-200 dark:border-[#1f6feb]/30 font-semibold">
                        {evt.entity_type}: {evt.entity_id}
                      </span>
                    </div>

                    <span className="text-[10px] text-[#656d76] dark:text-[#8b949e] font-mono">{evt.timestamp}</span>
                  </div>

                  <p className="text-[#1f2328] dark:text-[#e6edf3] font-sans text-xs leading-relaxed">{evt.description}</p>

                  <div className="flex items-center space-x-4 text-[10px] text-[#656d76] dark:text-[#8b949e] pt-1">
                    <span>Actor: <strong className="text-[#1f2328] dark:text-[#e6edf3]">{evt.actor}</strong></span>
                    <span>Correlation: <strong className="text-[#1f2328] dark:text-[#e6edf3]">{evt.correlation_id}</strong></span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-[#656d76] dark:text-[#8b949e] text-center py-8">
              No audit records found. Execute actions in the dashboard to generate correlated audit lineage.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

