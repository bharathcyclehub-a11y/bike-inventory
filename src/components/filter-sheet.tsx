"use client";

import { useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { DateFilter, type DateRangeKey } from "@/components/date-filter";

export interface FilterGroup {
  /** Section heading shown in the sheet, e.g. "Status" */
  label: string;
  /** Currently selected option key */
  value: string;
  /** Key treated as "no filter" (usually "ALL"); used for active-count + reset */
  defaultValue: string;
  options: { key: string; label: string }[];
  onChange: (key: string) => void;
}

interface FilterSheetProps {
  /** Optional date-range filter. Omit on pages without dates. */
  dateValue?: DateRangeKey;
  onDateChange?: (key: DateRangeKey, from?: string, to?: string) => void;
  /** One or more chip groups (status, type, …). */
  groups?: FilterGroup[];
  className?: string;
}

const DATE_LABELS: Record<DateRangeKey, string> = {
  all: "All dates", today: "Today", "3days": "3 Days", week: "This Week", month: "This Month", custom: "Custom",
};

/**
 * Single "Filter" button that opens a bottom sheet holding a date range
 * and any number of chip groups. Replaces inline scrolling chip rows so
 * list pages stay clean. Selections apply immediately; the sheet just
 * houses them. Active filters surface as read-only chips next to the button.
 */
export function FilterSheet({ dateValue, onDateChange, groups = [], className = "" }: FilterSheetProps) {
  const [open, setOpen] = useState(false);

  const hasDate = !!onDateChange && dateValue !== undefined;
  const dateActive = hasDate && dateValue !== "all";
  const activeGroups = groups.filter((g) => g.value !== g.defaultValue);
  const activeCount = (dateActive ? 1 : 0) + activeGroups.length;

  const reset = () => {
    if (hasDate && onDateChange) onDateChange("all");
    groups.forEach((g) => g.onChange(g.defaultValue));
  };

  return (
    <div className={className}>
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
        <button
          onClick={() => setOpen(true)}
          className="shrink-0 flex items-center gap-1.5 px-3 min-h-[40px] rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:border-slate-400 cursor-pointer transition-colors"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filter
          {activeCount > 0 && (
            <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1 rounded-full bg-blue-600 text-white text-[10px] font-semibold">
              {activeCount}
            </span>
          )}
        </button>

        {/* Read-only chips showing what's active */}
        {dateActive && (
          <span className="shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-full bg-blue-600 text-white">
            {DATE_LABELS[dateValue]}
          </span>
        )}
        {activeGroups.map((g) => (
          <span key={g.label} className="shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-full bg-slate-900 text-white">
            {g.options.find((o) => o.key === g.value)?.label}
          </span>
        ))}
        {activeCount > 0 && (
          <button onClick={reset} className="shrink-0 text-xs text-slate-500 underline cursor-pointer">
            Clear
          </button>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative bg-white rounded-t-2xl p-4 pb-safe max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-900">Filters</h2>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
                aria-label="Close filters"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {hasDate && onDateChange && (
              <>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Date Range</p>
                <DateFilter value={dateValue} onChange={onDateChange} className="mb-5" />
              </>
            )}

            {groups.map((g) => (
              <div key={g.label} className="mb-5">
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">{g.label}</p>
                <div className="flex flex-wrap gap-2">
                  {g.options.map((o) => (
                    <button
                      key={o.key}
                      onClick={() => g.onChange(o.key)}
                      className={`min-h-[40px] px-3.5 rounded-full text-sm font-medium cursor-pointer transition-colors ${
                        g.value === o.key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <div className="flex gap-2">
              <button
                onClick={reset}
                className="flex-1 min-h-[44px] rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Reset
              </button>
              <button
                onClick={() => setOpen(false)}
                className="flex-1 min-h-[44px] rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
