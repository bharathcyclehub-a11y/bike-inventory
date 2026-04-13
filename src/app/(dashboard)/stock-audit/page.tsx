"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, ClipboardCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface StockCountItem {
  id: string;
  title: string;
  status: string;
  dueDate: string;
  completedAt: string | null;
  createdAt: string;
  notes: string | null;
  totalItems: number;
  countedItems: number;
  assignedTo: { name: string };
}

const STATUS_STYLE: Record<string, string> = {
  PENDING: "warning",
  IN_PROGRESS: "info",
  COMPLETED: "success",
};

export default function StockAuditPage() {
  const [counts, setCounts] = useState<StockCountItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");

  useEffect(() => {
    setLoading(true);
    const q = filter !== "ALL" ? `?status=${filter}` : "";
    fetch(`/api/stock-counts${q}`)
      .then((r) => r.json())
      .then((res) => { if (res.success) setCounts(res.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filter]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold text-slate-900">Stock Audit</h1>
        <Link href="/stock-audit/new"
          className="flex items-center gap-1.5 bg-slate-900 text-white px-3 py-2 rounded-lg text-sm font-medium">
          <Plus className="h-4 w-4" /> New Audit
        </Link>
      </div>

      <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-3 pb-1">
        {["ALL", "PENDING", "IN_PROGRESS", "COMPLETED"].map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === s ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
            }`}>
            {s === "ALL" ? "All" : s === "IN_PROGRESS" ? "In Progress" : s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : counts.length === 0 ? (
        <div className="text-center py-12">
          <ClipboardCheck className="h-10 w-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-400">No stock audits found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {counts.map((c) => {
            const progress = c.totalItems > 0 ? Math.round((c.countedItems / c.totalItems) * 100) : 0;
            return (
              <Link key={c.id} href={`/stock-audit/${c.id}`}>
                <Card className="mb-2">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex-1 min-w-0 mr-2">
                        <p className="text-sm font-medium text-slate-900 truncate">{c.title}</p>
                        <p className="text-xs text-slate-500">
                          Assigned: {c.assignedTo.name} | Due: {new Date(c.dueDate).toLocaleDateString("en-IN")}
                        </p>
                      </div>
                      <Badge variant={STATUS_STYLE[c.status] as "warning" | "info" | "success"}>
                        {c.status === "IN_PROGRESS" ? "In Progress" : c.status.charAt(0) + c.status.slice(1).toLowerCase()}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 bg-slate-200 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all ${
                            progress === 100 ? "bg-green-500" : progress > 0 ? "bg-blue-500" : "bg-slate-300"
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-500 shrink-0">
                        {c.countedItems}/{c.totalItems}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
