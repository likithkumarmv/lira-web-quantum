"use client";

import React, { useState } from "react";
import { GitBranch, AlertTriangle, ShieldAlert, CheckCircle2, ArrowRight, UserCheck } from "lucide-react";
import { BlockerNode } from "@/lib/types";

interface BlockerDAGProps {
  nodes: BlockerNode[];
  onNodeClick?: (node: BlockerNode) => void;
}

export default function BlockerDAG({ nodes, onNodeClick }: BlockerDAGProps) {
  const [selectedNode, setSelectedNode] = useState<BlockerNode | null>(nodes[0] || null);

  const handleSelect = (n: BlockerNode) => {
    setSelectedNode(n);
    if (onNodeClick) onNodeClick(n);
  };

  return (
    <div className="bg-white dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d] rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <GitBranch className="w-5 h-5 text-blue-600 dark:text-sky-400" />
          <h3 className="font-mono text-sm font-bold text-[#1f2328] dark:text-[#e6edf3] uppercase tracking-wide">
            Causal Blocker Graph (DAG)
          </h3>
        </div>
        <div className="flex items-center space-x-3 text-xs font-mono">
          <span className="flex items-center space-x-1.5 text-red-600 dark:text-[#f85149]">
            <span className="w-2 h-2 rounded-full bg-red-600 dark:bg-[#da3633] inline-block" />
            <span>Hard Blocker</span>
          </span>
          <span className="flex items-center space-x-1.5 text-amber-600 dark:text-[#e3b341]">
            <span className="w-2 h-2 rounded-full bg-amber-500 dark:bg-[#d29922] inline-block" />
            <span>Needs Verification</span>
          </span>
          <span className="flex items-center space-x-1.5 text-emerald-600 dark:text-[#3fb950]">
            <span className="w-2 h-2 rounded-full bg-emerald-600 dark:bg-[#238636] inline-block" />
            <span>Cleared</span>
          </span>
        </div>
      </div>

      {/* Visual DAG Flow */}
      <div className="p-4 bg-[#f6f8fa] dark:bg-[#0d1117] rounded-lg border border-[#d0d7de] dark:border-[#30363d] mb-4 overflow-x-auto">
        <div className="flex items-center space-x-3 min-w-[650px] py-4 px-2">
          {nodes.map((node, index) => {
            const isHard = node.status === "HARD_BLOCKER";
            const isCleared = node.status === "CLEARED";
            const isSelected = selectedNode?.node_id === node.node_id;

            return (
              <React.Fragment key={node.node_id}>
                {/* Node Box */}
                <div
                  onClick={() => handleSelect(node)}
                  className={`w-52 p-3 rounded-lg border cursor-pointer transition transform hover:-translate-y-0.5 shadow-sm ${
                    isSelected
                      ? "bg-blue-50 dark:bg-[#21262d] border-blue-500 dark:border-[#388bfd] ring-1 ring-blue-500/40 dark:ring-[#388bfd]/40"
                      : isHard
                      ? "bg-red-50 dark:bg-[#da3633]/10 border-red-300 dark:border-[#da3633]/40 hover:border-red-500 dark:hover:border-[#da3633]"
                      : isCleared
                      ? "bg-emerald-50 dark:bg-[#238636]/10 border-emerald-300 dark:border-[#238636]/40 hover:border-emerald-500 dark:hover:border-[#238636]"
                      : "bg-amber-50 dark:bg-[#d29922]/10 border-amber-300 dark:border-[#d29922]/40 hover:border-amber-500 dark:hover:border-[#d29922]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1 text-[10px] font-mono">
                    <span className="text-[#656d76] dark:text-[#8b949e] font-semibold">{node.code}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded-full font-bold ${
                        isHard
                          ? "bg-red-100 dark:bg-[#da3633]/20 text-red-700 dark:text-[#f85149]"
                          : isCleared
                          ? "bg-emerald-100 dark:bg-[#238636]/20 text-emerald-700 dark:text-[#3fb950]"
                          : "bg-amber-100 dark:bg-[#d29922]/20 text-amber-700 dark:text-[#e3b341]"
                      }`}
                    >
                      {node.status}
                    </span>
                  </div>

                  <p className="text-xs font-medium text-[#1f2328] dark:text-[#e6edf3] line-clamp-2 mb-2 leading-snug">
                    {node.claim}
                  </p>

                  <div className="flex items-center justify-between text-[10px] text-[#656d76] dark:text-[#8b949e] font-mono border-t border-[#d0d7de] dark:border-[#30363d] pt-1.5">
                    <span>{node.responsible_role}</span>
                    <span>Tier: {node.authority_tier}</span>
                  </div>
                </div>

                {/* Connecting Arrow */}
                {index < nodes.length - 1 && (
                  <div className="flex items-center justify-center text-[#656d76] dark:text-[#8b949e] shrink-0">
                    <div className="w-6 h-0.5 bg-[#d0d7de] dark:bg-[#30363d]" />
                    <ArrowRight className="w-4 h-4 -ml-1 text-[#656d76] dark:text-[#8b949e]" />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Selected Node Details Drawer */}
      {selectedNode && (
        <div className="bg-[#f6f8fa] dark:bg-[#0d1117] p-4 rounded-lg border border-[#d0d7de] dark:border-[#30363d] text-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono font-bold text-blue-600 dark:text-sky-400 uppercase tracking-wide">
              Blocker Evidence Inspection: {selectedNode.node_id}
            </span>
            <span className="text-[11px] font-mono text-[#656d76] dark:text-[#8b949e]">
              Responsible Owner: <strong className="text-[#1f2328] dark:text-[#e6edf3]">{selectedNode.responsible_role}</strong>
            </span>
          </div>

          <p className="text-[#1f2328] dark:text-[#e6edf3] mb-2.5 text-xs leading-relaxed">{selectedNode.claim}</p>

          {selectedNode.quote && (
            <div className="p-2.5 bg-white dark:bg-[#161b22] rounded-md font-mono text-[11px] text-amber-800 dark:text-amber-300 border border-[#d0d7de] dark:border-[#30363d] mb-2">
              <span className="text-[10px] text-[#656d76] dark:text-[#8b949e] block mb-0.5">
                Verbatim Quote Grounding [{selectedNode.start_char}:{selectedNode.end_char}]
              </span>
              &ldquo;{selectedNode.quote}&rdquo;
            </div>
          )}

          <div className="flex items-center justify-between text-[11px] font-mono text-[#656d76] dark:text-[#8b949e] pt-1 border-t border-[#d0d7de] dark:border-[#30363d]">
            <span>Authority Tier: {selectedNode.authority_tier} (Deterministic Icegate / Carrier Validation)</span>
            <span>Container: {selectedNode.container_id}</span>
          </div>
        </div>
      )}
    </div>
  );
}

