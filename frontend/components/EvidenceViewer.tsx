"use client";

import React, { useState } from "react";
import { FileText, ShieldAlert, CheckCircle2, AlertTriangle, Eye, Hash } from "lucide-react";
import { IngestJob } from "@/lib/types";

interface EvidenceViewerProps {
  job: IngestJob | null;
  onSelectBlocker?: (blocker: any) => void;
}

export default function EvidenceViewer({ job, onSelectBlocker }: EvidenceViewerProps) {
  const [selectedIdx, setSelectedIdx] = useState<number>(0);

  if (!job) {
    return (
      <div className="bg-white dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d] rounded-xl p-8 text-center text-[#656d76] dark:text-[#8b949e] font-mono text-xs shadow-sm">
        No document ingested yet. Upload a shipping document above to extract evidence fabric.
      </div>
    );
  }

  const rawText = job.raw_source_text || "";
  const blockers = job.candidate_blockers || [];
  const activeBlocker = blockers[selectedIdx];

  // Highlight quotes in raw text
  const renderHighlightedText = () => {
    if (!blockers.length || !activeBlocker) return rawText;

    const start = activeBlocker.start_char;
    const end = activeBlocker.end_char;

    const before = rawText.slice(0, start);
    const highlighted = rawText.slice(start, end);
    const after = rawText.slice(end);

    return (
      <>
        <span>{before}</span>
        <mark className="bg-amber-100 dark:bg-amber-400/20 text-amber-900 dark:text-amber-300 border-b-2 border-amber-500 font-semibold px-1 rounded-sm">
          {highlighted}
        </mark>
        <span>{after}</span>
      </>
    );
  };

  return (
    <div className="bg-white dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d] rounded-xl overflow-hidden shadow-sm">
      <div className="bg-[#f6f8fa] dark:bg-[#0d1117] px-5 py-3 border-b border-[#d0d7de] dark:border-[#30363d] flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <FileText className="w-4 h-4 text-blue-600 dark:text-sky-400" />
          <h4 className="font-mono text-xs font-bold text-[#1f2328] dark:text-[#e6edf3] uppercase tracking-wide">
            Evidence Fabric Inspector: {job.job_id}
          </h4>
        </div>
        <div className="flex items-center space-x-2 text-[11px] font-mono">
          <span className="text-[#656d76] dark:text-[#8b949e]">Claims Extracted:</span>
          <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-[#1f6feb]/15 text-blue-600 dark:text-[#58a6ff] font-bold border border-blue-200 dark:border-[#1f6feb]/30">
            {blockers.length}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[#d0d7de] dark:divide-[#30363d]">
        {/* Raw Text Window with Highlights */}
        <div className="p-4 bg-[#f6f8fa]/60 dark:bg-[#0d1117]/60">
          <div className="flex items-center justify-between text-[11px] font-mono text-[#656d76] dark:text-[#8b949e] mb-2">
            <span>VERBATIM SOURCE DOCUMENT</span>
            <span className="text-[10px] text-[#656d76] dark:text-[#8b949e]">Exact Span Verification</span>
          </div>
          <pre className="p-4 bg-white dark:bg-[#0d1117] rounded-md text-[#1f2328] dark:text-[#e6edf3] font-mono text-xs whitespace-pre-wrap leading-relaxed border border-[#d0d7de] dark:border-[#30363d] max-h-80 overflow-y-auto">
            {renderHighlightedText()}
          </pre>
          <div className="mt-2 text-[11px] font-mono text-[#656d76] dark:text-[#8b949e] flex items-center justify-between">
            <span>Container: {job.container_id || "C102"}</span>
            <span>Character Count: {rawText.length}</span>
          </div>
        </div>

        {/* Structured Blocker Claims List */}
        <div className="p-4 flex flex-col space-y-3">
          <div className="text-[11px] font-mono text-[#656d76] dark:text-[#8b949e]">
            EXTRACTED CANDIDATE BLOCKERS ({blockers.length})
          </div>

          <div className="space-y-2.5 overflow-y-auto max-h-80 pr-1">
            {blockers.map((b, idx) => {
              const isSelected = idx === selectedIdx;
              const isHard = b.status === "HARD_BLOCKER";
              return (
                <div
                  key={idx}
                  onClick={() => {
                    setSelectedIdx(idx);
                    if (onSelectBlocker) onSelectBlocker(b);
                  }}
                  className={`p-3 rounded-lg border text-xs cursor-pointer transition shadow-sm ${
                    isSelected
                      ? "bg-blue-50 dark:bg-[#21262d] border-blue-500 dark:border-[#388bfd] ring-1 ring-blue-500/30 dark:ring-[#388bfd]/30"
                      : "bg-[#f6f8fa] dark:bg-[#0d1117] border-[#d0d7de] dark:border-[#30363d] hover:border-[#656d76] dark:hover:border-[#8b949e]/60"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono font-bold text-[#1f2328] dark:text-[#e6edf3] flex items-center space-x-1.5">
                      {isHard ? (
                        <ShieldAlert className="w-3.5 h-3.5 text-red-600 dark:text-rose-400" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      )}
                      <span>{b.type}</span>
                    </span>

                    <div className="flex items-center space-x-1 font-mono text-[10px]">
                      <span className="bg-white dark:bg-[#21262d] text-[#656d76] dark:text-[#8b949e] px-1.5 py-0.5 rounded border border-[#d0d7de] dark:border-[#30363d]">
                        {b.authority_tier}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded-full font-bold ${
                          isHard
                            ? "bg-red-100 dark:bg-[#da3633]/15 text-red-700 dark:text-[#f85149] border border-red-200 dark:border-[#da3633]/40"
                            : "bg-amber-100 dark:bg-[#d29922]/15 text-amber-700 dark:text-[#e3b341] border border-amber-200 dark:border-[#d29922]/40"
                        }`}
                      >
                        {b.status}
                      </span>
                    </div>
                  </div>

                  <p className="text-[#1f2328] dark:text-[#e6edf3] mb-2 leading-relaxed text-[11px]">{b.claim}</p>

                  <div className="bg-white dark:bg-[#161b22] p-2 rounded-md text-[11px] font-mono text-amber-800 dark:text-amber-300 border border-[#d0d7de] dark:border-[#30363d]">
                    <span className="text-[10px] text-[#656d76] dark:text-[#8b949e] block mb-0.5 font-sans">
                      Verified Quote [{b.start_char}:{b.end_char}]
                    </span>
                    &ldquo;{b.quote}&rdquo;
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[10px] text-[#656d76] dark:text-[#8b949e] font-mono">
                    <span>Owner: {b.responsible_role}</span>
                    <span>Confidence: {(b.confidence * 100).toFixed(0)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

