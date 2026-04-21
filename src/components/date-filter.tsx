"use client";

import { useState } from "react";
import { Calendar } from "lucide-react";

export type DateRangeKey = "all" | "today" | "3days" | "week" | "month" | "custom";

interface DateFilterProps {
  value: DateRangeKey;
  onChange: (key: DateRangeKey, from?: string, to?: string) => void;
  className?: string;
}

const CHIPS: { key: DateRangeKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "today", label: "Today" },
  { key: "3days", label: "3 Days" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "custom", label: "Custom" },
];

function getDateRange(key: DateRangeKey): { from: string; to: string } | null {
  const now = new Date();
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const today = fmt(now);

  switch (key) {
    case "today":
      return { from: today, to: today };
    case "3days": {
      const d = new Date();
      d.setDate(d.getDate() - 3);
      return { from: fmt(d), to: today };
    }
    case "week": {
      const d = new Date();
      const day = d.getDay();
      d.setDate(d.getDate() - (day === 0 ? 6 : day - 1)); // Monday
      return { from: fmt(d), to: today };
    }
    case "month": {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: fmt(d), to: today };
    }
    default:
      return null;
  }
}

export function DateFilter({ value, onChange, className = "" }: DateFilterProps) {
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const handleChip = (key: DateRangeKey) => {
    if (key === "custom") {
      onChange("custom");
      return;
    }
    const range = getDateRange(key);
    onChange(key, range?.from, range?.to);
  };

  const handleCustomApply = () => {
    if (customFrom && customTo) {
      onChange("custom", customFrom, customTo);
    }
  };

  return (
    <div className={className}>
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
        {CHIPS.map((chip) => (
          <button
            key={chip.key}
            onClick={() => handleChip(chip.key)}
            className={`shrink-0 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
              value === chip.key
                ? "bg-blue-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {chip.key === "custom" && <Calendar className="h-3 w-3 inline mr-1" />}
            {chip.label}
          </button>
        ))}
      </div>
      {value === "custom" && (
        <div className="flex items-center gap-2 mt-2">
          <input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="flex-1 px-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <span className="text-xs text-slate-400">to</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="flex-1 px-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <button
            onClick={handleCustomApply}
            disabled={!customFrom || !customTo}
            className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg disabled:opacity-50"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}

export { getDateRange };
