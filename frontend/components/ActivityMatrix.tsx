"use client";

import React, { useState, useEffect } from "react";
import { GitCommit, Calendar, ShieldCheck, Flame, Filter } from "lucide-react";
import { fetchAuditEvents } from "@/lib/api";
import { AuditEvent } from "@/lib/types";

interface DayActivity {
  date: string;
  count: number; // real audit actions
  incidents: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export default function ActivityMatrix() {
  const [filter, setFilter] = useState<"ALL" | "DEMURRAGE" | "GATE">("ALL");
  const [hoveredDay, setHoveredDay] = useState<DayActivity | null>(null);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [weeks, setWeeks] = useState<DayActivity[][]>([]);

  useEffect(() => {
    fetchAuditEvents()
      .then((events) => {
        setAuditEvents(events);
        buildMatrixFromRealEvents(events, filter);
      })
      .catch(() => {
        buildMatrixFromRealEvents([], filter);
      });
  }, [filter]);

  // Build matrix strictly from real audit ledger timestamps
  const buildMatrixFromRealEvents = (events: AuditEvent[], currentFilter: string) => {
    // Filter events
    const filteredEvents = events.filter((e) => {
      if (currentFilter === "DEMURRAGE") return e.event_type.includes("PLAN") || e.event_type.includes("SOLV");
      if (currentFilter === "GATE") return e.event_type.includes("EDGE") || e.event_type.includes("RFID");
      return true;
    });

    // Map events by ISO date string (YYYY-MM-DD)
    const eventCountsByDate: Record<string, { count: number; incidents: number }> = {};
    filteredEvents.forEach((e) => {
      // timestamp e.g. "2026-10-28T16:00:00+05:30" or ISO
      const dateKey = (e.timestamp || "").split("T")[0] || new Date().toISOString().split("T")[0];
      if (!eventCountsByDate[dateKey]) {
        eventCountsByDate[dateKey] = { count: 0, incidents: 0 };
      }
      eventCountsByDate[dateKey].count += 1;
      if (e.event_type.includes("BLOCK") || e.event_type.includes("FAIL")) {
        eventCountsByDate[dateKey].incidents += 1;
      }
    });

    const matrix: DayActivity[][] = [];
    const today = new Date();

    for (let w = 25; w >= 0; w--) {
      const week: DayActivity[] = [];
      for (let d = 0; d < 7; d++) {
        const dayOffset = w * 7 + (6 - d);
        const dayDate = new Date(today);
        dayDate.setDate(today.getDate() - dayOffset);
        const dateKey = dayDate.toISOString().split("T")[0];

        const dayData = eventCountsByDate[dateKey] || { count: 0, incidents: 0 };
        let level: 0 | 1 | 2 | 3 | 4 = 0;
        if (dayData.count > 6) level = 4;
        else if (dayData.count > 3) level = 3;
        else if (dayData.count > 1) level = 2;
        else if (dayData.count === 1) level = 1;

        week.push({
          date: dayDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
          count: dayData.count,
          incidents: dayData.incidents,
          level
        });
      }
      matrix.unshift(week);
    }
    setWeeks(matrix);
  };

  const getLevelColor = (level: number) => {
    // GitHub contribution green levels for light and dark modes
    switch (level) {
      case 4:
        return "bg-[#216e39] dark:bg-[#39d353]";
      case 3:
        return "bg-[#30a14e] dark:bg-[#26a641]";
      case 2:
        return "bg-[#40c463] dark:bg-[#006d32]";
      case 1:
        return "bg-[#9be9a8] dark:bg-[#0e4429]";
      default:
        return "bg-[#ebedf0] dark:bg-[#161b22]";
    }
  };

  return (
    <div className="bg-white dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d] rounded-xl p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d0d7de] dark:border-[#30363d] pb-3">
        <div className="flex items-center space-x-2">
          <GitCommit className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <h3 className="font-mono text-sm font-bold text-[#1f2328] dark:text-[#e6edf3] uppercase tracking-wide">
            Operational Cadence & Recovery Activity Matrix
          </h3>
        </div>

        <div className="flex items-center space-x-2 text-xs font-mono">
          <span className="text-[#656d76] dark:text-[#8b949e]">Filter:</span>
          {(["ALL", "DEMURRAGE", "GATE"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-0.5 rounded-md border text-[11px] font-semibold transition shadow-sm ${
                filter === f
                  ? "bg-blue-50 dark:bg-[#1f6feb]/20 border-blue-500 dark:border-[#388bfd] text-blue-700 dark:text-sky-400 font-bold"
                  : "bg-white dark:bg-[#21262d] border-[#d0d7de] dark:border-[#30363d] text-[#656d76] dark:text-[#8b949e]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Matrix Grid Visualization */}
      <div className="overflow-x-auto pb-1">
        <div className="min-w-[620px] flex space-x-1.5 items-end">
          {/* Day of Week Labels */}
          <div className="flex flex-col justify-between text-[9px] font-mono text-[#656d76] dark:text-[#8b949e] h-[84px] pr-2 select-none">
            <span>Mon</span>
            <span>Wed</span>
            <span>Fri</span>
          </div>

          {/* 26 Weeks of Activity Columns */}
          <div className="flex space-x-1">
            {weeks.map((week, wIdx) => (
              <div key={wIdx} className="flex flex-col space-y-1">
                {week.map((day, dIdx) => (
                  <div
                    key={dIdx}
                    onMouseEnter={() => setHoveredDay(day)}
                    onMouseLeave={() => setHoveredDay(null)}
                    className={`w-3 h-3 rounded-[2px] transition cursor-pointer hover:ring-1 hover:ring-blue-500 ${getLevelColor(
                      day.level
                    )}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Info & Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-[#656d76] dark:text-[#8b949e] pt-2 border-t border-[#d0d7de] dark:border-[#30363d]">
        <div className="flex items-center space-x-3">
          {hoveredDay ? (
            <span className="text-[#1f2328] dark:text-[#e6edf3]">
              <strong>{dayToString(hoveredDay)}</strong>
            </span>
          ) : (
            <span>Hover a day to inspect throughput & resolution rate</span>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center space-x-1 text-[10px]">
          <span>Less</span>
          <span className="w-2.5 h-2.5 rounded-[2px] bg-[#ebedf0] dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d]" />
          <span className="w-2.5 h-2.5 rounded-[2px] bg-[#9be9a8] dark:bg-[#0e4429]" />
          <span className="w-2.5 h-2.5 rounded-[2px] bg-[#40c463] dark:bg-[#006d32]" />
          <span className="w-2.5 h-2.5 rounded-[2px] bg-[#30a14e] dark:bg-[#26a641]" />
          <span className="w-2.5 h-2.5 rounded-[2px] bg-[#216e39] dark:bg-[#39d353]" />
          <span>More</span>
        </div>
      </div>
    </div>
  );
}

function dayToString(day: DayActivity) {
  if (day.count === 0) return `0 audit ledger events on ${day.date}`;
  return `${day.count} verified ledger actions (${day.incidents > 0 ? `${day.incidents} exception resolved` : "zero conflict operations"}) on ${day.date}`;
}

