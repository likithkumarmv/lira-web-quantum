"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Bot,
  Send,
  Sparkles,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  UserCheck,
  Terminal,
  Activity,
  Layers,
  ChevronRight
} from "lucide-react";
import { askCopilot, fetchCopilotHistory } from "@/lib/api";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  proposed_plan_id?: string;
  created_at: string;
}

interface ToolTrace {
  tool_name: string;
  thought?: string;
  arguments: any;
  result: any;
  duration_ms: number;
  status: "SUCCESS" | "FAILED";
}

const PROMPT_CHIPS = [
  "Driver T04 is stuck in landslide. What should we do?",
  "Explain why QpiAI chose chassis R-03 over R-07.",
  "What happens if we swap T09 and T11 slots?",
  "Run a 10-minute shadow QAOA on current plan.",
  "Show me demurrage risk if JNPT gate closes at 18:00.",
  "Re-solve current plan with minimum cost objective."
];

export default function QuantumCopilotPage() {
  const [sessionId, setSessionId] = useState<string>("COPILOT-SESSION-" + Math.floor(Math.random() * 90000 + 10000));
  const [inputPrompt, setInputPrompt] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "m0",
      role: "assistant",
      content:
        "Hello! I am the LIRA-Q Quantum Dispatch Copilot powered by Gemini 1.5 Flash and verified QpiAI tools. I can inspect live terminal state, formulate HUBO models, run QAOA shadow benchmarks, and propose recovery plans for manager approval. What scenario would you like to explore?",
      created_at: new Date().toISOString()
    }
  ]);
  const [toolTraces, setToolTraces] = useState<ToolTrace[]>([]);
  const [toolCallsCount, setToolCallsCount] = useState<number>(0);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async (textToSend?: string) => {
    const query = textToSend || inputPrompt;
    if (!query.trim() || loading) return;

    const userMsg: Message = {
      id: "u-" + Date.now(),
      role: "user",
      content: query,
      created_at: new Date().toISOString()
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputPrompt("");
    setLoading(true);

    try {
      const res = await askCopilot(query, sessionId);
      const assistantMsg: Message = {
        id: "a-" + Date.now(),
        role: "assistant",
        content: res.answer || "Plan formulated successfully.",
        proposed_plan_id: res.proposed_plan_id,
        created_at: new Date().toISOString()
      };
      setMessages((prev) => [...prev, assistantMsg]);

      if (res.traces && Array.isArray(res.traces)) {
        setToolTraces((prev) => [...prev, ...res.traces]);
        setToolCallsCount((prev) => prev + res.traces.length);
      }
    } catch (err: any) {
      const errorMsg: Message = {
        id: "e-" + Date.now(),
        role: "assistant",
        content: "Error executing copilot tools: " + err.message,
        created_at: new Date().toISOString()
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-mono pb-12">
      {/* Header */}
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
            <span className="text-xs px-2 py-0.5 rounded-sm bg-[#15803D]/10 text-[#15803D] dark:text-[#22C55E] border border-[#15803D]/30 font-bold">
              FEATURE 02
            </span>
          </div>
          <h1 className="text-2xl font-bold text-[#102235] dark:text-[#EAF3F8] tracking-tight mt-1 flex items-center space-x-2">
            <Bot className="w-6 h-6 text-[#15803D] dark:text-[#22C55E]" />
            <span>Quantum Dispatch Copilot (Gemini 1.5 Flash + 11 Tools)</span>
          </h1>
        </div>

        <div className="flex items-center space-x-3">
          <div className="text-xs px-3 py-1.5 bg-[#F3F6FA] dark:bg-[#111F2E] border border-[#D9E3EB] dark:border-[#294355] rounded-sm flex items-center space-x-2">
            <Activity className="w-4 h-4 text-[#067A9B] dark:text-[#39C9DF]" />
            <span>Tool Calls:</span>
            <span className="font-bold text-[#102235] dark:text-[#EAF3F8]">
              {toolCallsCount} / 12 Cap
            </span>
          </div>
          <span className="text-xs text-[#516678] dark:text-[#9FB5C5]">
            Session: <span className="font-mono">{sessionId.slice(0, 16)}</span>
          </span>
        </div>
      </div>

      {/* Suggested Prompt Chips */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1 text-xs">
        <span className="text-[#516678] dark:text-[#9FB5C5] shrink-0 font-bold">Suggested Prompts:</span>
        {PROMPT_CHIPS.map((chip, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(chip)}
            disabled={loading}
            className="px-2.5 py-1 bg-[#F3F6FA] dark:bg-[#111F2E] hover:bg-[#E3EBF2] dark:hover:bg-[#172B3D] border border-[#D9E3EB] dark:border-[#294355] text-[#102235] dark:text-[#EAF3F8] rounded-xs shrink-0 transition text-left text-[11px]"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Main 2-Column Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[640px]">
        {/* Left Column: Chat Conversation (7 cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-[#111F2E] rounded-sm border border-[#D9E3EB] dark:border-[#294355] shadow-xs flex flex-col justify-between overflow-hidden">
          {/* Messages Stream */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {messages.map((msg) => {
              const isAssistant = msg.role === "assistant";
              return (
                <div
                  key={msg.id}
                  className={`flex items-start space-x-3 ${isAssistant ? "" : "flex-row-reverse space-x-reverse"}`}
                >
                  <div
                    className={`w-7 h-7 rounded-sm flex items-center justify-center shrink-0 text-xs font-bold ${
                      isAssistant
                        ? "bg-[#15803D]/10 text-[#15803D] dark:text-[#22C55E] border border-[#15803D]/30"
                        : "bg-[#067A9B]/10 text-[#067A9B] dark:text-[#39C9DF] border border-[#067A9B]/30"
                    }`}
                  >
                    {isAssistant ? <Bot className="w-4 h-4" /> : "U"}
                  </div>

                  <div
                    className={`max-w-[85%] p-3 rounded-sm text-xs leading-relaxed space-y-2 ${
                      isAssistant
                        ? "bg-[#F3F6FA] dark:bg-[#0B1420] border border-[#D9E3EB] dark:border-[#294355] text-[#102235] dark:text-[#EAF3F8]"
                        : "bg-[#067A9B] text-white"
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{msg.content}</div>

                    {msg.proposed_plan_id && (
                      <div className="pt-2 border-t border-[#D9E3EB]/40 dark:border-[#294355]/40 flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-[#15803D] dark:text-[#22C55E]">
                          Plan Proposed: {msg.proposed_plan_id}
                        </span>
                        <Link
                          href="/demo/live-incident"
                          className="px-2 py-1 bg-[#15803D] hover:bg-[#116631] text-white rounded-xs text-[10px] font-bold flex items-center space-x-1"
                        >
                          <UserCheck className="w-3 h-3" />
                          <span>Manager Review</span>
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {loading && (
              <div className="flex items-center space-x-2 text-xs text-[#067A9B] dark:text-[#39C9DF] p-3 bg-[#067A9B]/5 rounded-sm">
                <div className="w-3.5 h-3.5 border-2 border-[#067A9B] border-t-transparent rounded-full animate-spin" />
                <span>Copilot executing tools (HUBO modeling, QpiAI solver, validator)...</span>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Chat Input Bar */}
          <div className="p-3 border-t border-[#D9E3EB] dark:border-[#294355] bg-[#F3F6FA] dark:bg-[#0B1420] flex items-center space-x-2">
            <input
              type="text"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask Copilot dispatch scenario (e.g., 'What if we swap T09 and T11?')..."
              className="flex-1 bg-white dark:bg-[#111F2E] border border-[#D9E3EB] dark:border-[#294355] rounded-sm px-3 py-2 text-xs text-[#102235] dark:text-[#EAF3F8] focus:outline-hidden focus:border-[#067A9B]"
            />
            <button
              onClick={() => handleSend()}
              disabled={loading || !inputPrompt.trim()}
              className="px-4 py-2 bg-[#067A9B] hover:bg-[#056782] disabled:opacity-50 text-white rounded-sm text-xs font-bold transition flex items-center space-x-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send</span>
            </button>
          </div>
        </div>

        {/* Right Column: Live Agent Trace Inspector (5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-[#111F2E] rounded-sm border border-[#D9E3EB] dark:border-[#294355] shadow-xs flex flex-col justify-between overflow-hidden">
          <div className="p-3.5 border-b border-[#D9E3EB] dark:border-[#294355] flex items-center justify-between">
            <div className="text-xs font-bold text-[#102235] dark:text-[#EAF3F8] uppercase tracking-wider flex items-center space-x-2">
              <Terminal className="w-4 h-4 text-[#067A9B] dark:text-[#39C9DF]" />
              <span>Live Agent Tool Traces</span>
            </div>
            <span className="text-[11px] text-[#516678] dark:text-[#9FB5C5]">
              Real-time Tool Invocations
            </span>
          </div>

          <div className="flex-1 p-3 overflow-y-auto space-y-3 font-mono text-[11px]">
            {toolTraces.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#516678] dark:text-[#9FB5C5] space-y-2">
                <Terminal className="w-8 h-8 opacity-40" />
                <p>No tool traces yet.</p>
                <p className="text-[10px] leading-relaxed">
                  Send a prompt from the left panel to watch the Copilot call verified QpiAI and terminal inspection tools in real time.
                </p>
              </div>
            ) : (
              toolTraces.map((trace, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-sm bg-[#F3F6FA] dark:bg-[#0B1420] border border-[#D9E3EB] dark:border-[#294355] space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[#067A9B] dark:text-[#39C9DF] font-bold flex items-center space-x-1">
                      <ChevronRight className="w-3 h-3" />
                      <span>{trace.tool_name}</span>
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-xs bg-[#15803D]/10 text-[#15803D] dark:text-[#22C55E] font-bold">
                      {trace.duration_ms}ms
                    </span>
                  </div>

                  {trace.thought && (
                    <div className="text-[10px] text-[#516678] dark:text-[#9FB5C5] italic">
                      &quot;{trace.thought}&quot;
                    </div>
                  )}

                  <div className="text-[10px] bg-black/5 dark:bg-white/5 p-1.5 rounded-xs space-y-1 overflow-x-auto">
                    <div>
                      <span className="text-[#516678] dark:text-[#9FB5C5]">Args: </span>
                      <span className="text-[#102235] dark:text-[#EAF3F8]">
                        {JSON.stringify(trace.arguments)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#516678] dark:text-[#9FB5C5]">Result: </span>
                      <span className="text-[#15803D] dark:text-[#22C55E]">
                        {JSON.stringify(trace.result).slice(0, 120)}...
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-2.5 border-t border-[#D9E3EB] dark:border-[#294355] bg-[#F3F6FA] dark:bg-[#0B1420] text-[10px] text-[#516678] dark:text-[#9FB5C5] flex items-center justify-between">
            <span>Non-negotiable rule: Copilot proposes plans only.</span>
            <span className="text-[#15803D] dark:text-[#22C55E] font-bold">Human Authorizes Live</span>
          </div>
        </div>
      </div>
    </div>
  );
}

