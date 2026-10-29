"use client";

import React, { useState } from "react";
import { queryEvidenceAssistant } from "@/lib/api";
import { RAGResponse, RAGClaim } from "@/lib/types";

interface Props {
  containerId?: string;
  incidentId?: string;
}

export default function EvidenceAssistant({ containerId = "C102", incidentId }: Props) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RAGResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const QUICK_QUESTIONS = [
    "What blocks container C102?",
    "Which source states the e-DO cutoff?",
    "Which tariff backs this demurrage cost?",
    "Is Customs Out of Charge (OoC) granted on ICEGATE?"
  ];

  const handleSearch = async (qText: string) => {
    if (!qText.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await queryEvidenceAssistant(qText, containerId);
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Failed to query Evidence Assistant");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#10141B] border border-[#222936] rounded p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#222936] pb-3">
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
          <h3 className="text-sm font-semibold text-slate-100 tracking-wider uppercase font-mono">
            Evidence Assistant (Document RAG)
          </h3>
        </div>
        <div className="flex items-center space-x-2">
          <span className="px-2 py-0.5 text-[10px] font-mono bg-cyan-950/60 border border-cyan-800 text-cyan-300 rounded">
            HYBRID LEXICAL + VECTOR
          </span>
          <span className="px-2 py-0.5 text-[10px] font-mono bg-emerald-950/60 border border-emerald-800 text-emerald-300 rounded">
            ZERO HALLUCINATION GATE
          </span>
        </div>
      </div>

      <p className="text-xs text-slate-400">
        Query authorized, tamper-evident documents (carrier notices, ICEGATE bills of entry, packing lists, and JNPA port tariffs) for container <span className="text-slate-200 font-mono font-medium">{containerId}</span>. All claims require verbatim quote-span grounding.
      </p>

      {/* Quick Prompts */}
      <div className="flex flex-wrap gap-1.5">
        {QUICK_QUESTIONS.map((q, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => {
              setQuery(q);
              handleSearch(q);
            }}
            className="text-[11px] font-mono bg-[#161B22] hover:bg-[#1C2128] border border-[#30363D] hover:border-slate-500 text-slate-300 px-2.5 py-1 rounded transition-colors text-left"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input Box */}
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch(query)}
          placeholder="Ask a question grounded in authorized freight evidence..."
          className="flex-1 bg-[#090B0E] border border-[#222936] focus:border-cyan-500 rounded px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none font-mono"
        />
        <button
          type="button"
          onClick={() => handleSearch(query)}
          disabled={loading || !query.trim()}
          className="bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-600 text-slate-900 font-medium px-4 py-2 rounded text-xs transition-colors font-mono uppercase"
        >
          {loading ? "Searching..." : "Retrieve"}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-950/40 border border-red-800/80 rounded text-red-300 text-xs font-mono">
          {error}
        </div>
      )}

      {/* Result Display */}
      {result && (
        <div className="space-y-4 pt-2">
          {/* Status Bar */}
          <div className="flex items-center justify-between text-xs font-mono bg-[#090B0E] p-2.5 rounded border border-[#222936]">
            <div className="flex items-center space-x-2">
              <span className="text-slate-400">STATUS:</span>
              <span
                className={`font-semibold px-2 py-0.5 rounded text-[11px] ${
                  result.status === "VERIFIED_EVIDENCE_FOUND"
                    ? "bg-emerald-950 border border-emerald-700 text-emerald-300"
                    : result.status === "SECURITY_ALERT_PROMPT_INJECTION"
                    ? "bg-red-950 border border-red-700 text-red-300"
                    : "bg-amber-950 border border-amber-700 text-amber-300"
                }`}
              >
                {result.status}
              </span>
            </div>
            <div className="flex items-center space-x-2 text-[10px] text-slate-400">
              {result.prompt_injection_prevented && (
                <span className="text-red-400 border border-red-800 px-1.5 py-0.5 rounded bg-red-950/40">
                  SHIELD ACTIVE: INJECTION DEFLECTED
                </span>
              )}
              {result.tenant_isolation_enforced && (
                <span className="text-slate-400 border border-slate-700 px-1.5 py-0.5 rounded">
                  TENANT ISOLATION: VERIFIED
                </span>
              )}
            </div>
          </div>

          {/* Synthesized Answer */}
          <div className="bg-[#141923] p-3.5 rounded border border-[#222936] text-xs text-slate-200 leading-relaxed font-sans whitespace-pre-line">
            {result.answer}
          </div>

          {/* Contradiction Warning */}
          {result.contradictions_detected && (
            <div className="p-3 bg-amber-950/40 border border-amber-800 rounded text-amber-300 text-xs font-mono">
              <span className="font-bold">⚠️ CONTRADICTION DETECTED:</span> Source documents contain divergent operational statements. A physical verification action is recommended.
            </div>
          )}

          {/* Grounded Quote Spans */}
          {result.grounded_claims && result.grounded_claims.length > 0 && (
            <div className="space-y-2">
              <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                Verbatim Quote-Span Grounding ({result.grounded_claims.length} authoritative source matches)
              </div>
              <div className="space-y-2">
                {result.grounded_claims.map((claim, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-[#0D1117] border border-[#222936] rounded space-y-1.5 text-xs font-mono"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-cyan-300 font-semibold">{claim.document_name}</span>
                      <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-300 border border-slate-700">
                        {claim.issuer} • TIER {claim.authority_tier}
                      </span>
                    </div>
                    <div className="bg-[#161B22] p-2 rounded text-slate-200 border-l-2 border-cyan-500 italic font-sans text-xs">
                      "{claim.quote}"
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>Byte Offsets: L{claim.start_char} - R{claim.end_char}</span>
                      <span className="text-emerald-400 font-medium">GROUNDED & VERIFIED</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Proposed Verification Task if Insufficient Evidence */}
          {!result.is_sufficient && result.suggested_verification_task && (
            <div className="p-3 bg-blue-950/30 border border-blue-800 rounded space-y-2 text-xs font-mono">
              <div className="text-blue-300 font-bold">PROPOSED VERIFICATION TASK:</div>
              <div className="text-slate-300 font-sans">{result.suggested_verification_task.question}</div>
              <div className="text-[10px] text-slate-400">
                Target Authority: <span className="text-slate-200">{result.suggested_verification_task.target_authority}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

