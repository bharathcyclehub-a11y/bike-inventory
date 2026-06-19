"use client";

import Link from "next/link";
import { Truck, CheckCircle2, Package } from "lucide-react";
import { DateFilter, type DateRangeKey } from "@/components/date-filter";
import type { Stats } from "./delivery-stats";

interface FilterItem {
  key: string;
  label: string;
  count?: number;
}

interface DeliveryFiltersProps {
  filter: string;
  onFilterChange: (status: string) => void;
  stats: Stats | null;
  dateRange: string;
  dateFrom: string | undefined;
  dateTo: string | undefined;
  onDateChange: (key: string, from: string | undefined, to: string | undefined) => void;
}

export function DeliveryFilters({
  filter,
  onFilterChange,
  stats,
  dateRange,
  onDateChange,
}: DeliveryFiltersProps) {
  const FILTERS: FilterItem[] = [
    { key: "PENDING", label: "Pending", count: stats?.pending },
    { key: "SCHEDULED", label: "Scheduled", count: stats?.scheduled },
    { key: "OUT_FOR_DELIVERY", label: "Out", count: stats?.outForDelivery },
    { key: "DELIVERED", label: "Delivered", count: stats?.delivered || stats?.deliveredToday },
    { key: "FLAGGED", label: "Flagged", count: stats?.flagged },
    { key: "PACKED", label: "Packed" },
    { key: "SHIPPED", label: "Shipped" },
    { key: "IN_TRANSIT", label: "In Transit" },
  ];

  return (
    <>
      {/* Status filter chips */}
      <div className="flex gap-1.5 overflow-x-auto lg:overflow-visible lg:flex-wrap scrollbar-hide mb-1.5 pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => onFilterChange(f.key)}
            className={`shrink-0 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === f.key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            {f.label}
            {f.count !== undefined && f.count > 0 ? ` (${f.count})` : ""}
          </button>
        ))}
      </div>

      {/* Sub-navigation links row */}
      <div className="flex gap-2 mb-2">
        <Link
          href="/deliveries/dispatch"
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors border bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100"
        >
          <Truck className="h-3.5 w-3.5" />
          Batch Dispatch
        </Link>
        <button
          onClick={() => onFilterChange("PREBOOKED")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors border ${
            filter === "PREBOOKED"
              ? "bg-purple-600 text-white border-purple-600"
              : "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100"
          }`}
        >
          <Package className="h-3.5 w-3.5" />
          Prebooked{stats?.prebooked ? ` (${stats.prebooked})` : ""}
        </button>
      </div>

      {/* Hub navigation: 3 delivery types */}
      <div className="grid grid-cols-3 gap-2 mb-2">
        <Link
          href="/deliveries/walkout"
          className="flex flex-col items-center gap-1 py-3 rounded-xl text-xs font-semibold transition-colors border bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
        >
          <CheckCircle2 className="h-5 w-5" />
          Walk-out
        </Link>
        <Link
          href="/deliveries/blr"
          className="flex flex-col items-center gap-1 py-3 rounded-xl text-xs font-semibold transition-colors border bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
        >
          <Truck className="h-5 w-5" />
          Bangalore
        </Link>
        <Link
          href="/deliveries/outstation"
          className="flex flex-col items-center gap-1 py-3 rounded-xl text-xs font-semibold transition-colors border bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
        >
          <Package className="h-5 w-5" />
          Outstation
        </Link>
      </div>

      {/* Date Range Filter */}
      <div className="mb-2">
        <DateFilter
          value={dateRange as DateRangeKey}
          onChange={(key, from, to) => onDateChange(key, from, to)}
        />
      </div>
    </>
  );
}
