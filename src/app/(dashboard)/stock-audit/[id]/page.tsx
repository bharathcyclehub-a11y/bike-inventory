"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import { ArrowLeft, Play, CheckCircle2, Save } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface StockCountItem {
  id: string;
  systemQty: number;
  countedQty: number | null;
  variance: number | null;
  notes: string | null;
  countedAt: string | null;
  product: {
    name: string;
    sku: string;
    currentStock: number;
    category: { name: string } | null;
    bin: { code: string } | null;
  };
}

interface StockCount {
  id: string;
  title: string;
  status: string;
  dueDate: string;
  completedAt: string | null;
  notes: string | null;
  assignedTo: { name: string };
  items: StockCountItem[];
  totalItems: number;
  countedItems: number;
  totalVariance: number;
  itemsWithVariance: number;
}

const STATUS_STYLE: Record<string, string> = {
  PENDING: "warning",
  IN_PROGRESS: "info",
  COMPLETED: "success",
};

export default function StockAuditDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<StockCount | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = useCallback(() => {
    setLoading(true);
    fetch(`/api/stock-counts/${id}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setData(res.data);
          const existing: Record<string, string> = {};
          res.data.items.forEach((item: StockCountItem) => {
            if (item.countedQty !== null) existing[item.id] = String(item.countedQty);
          });
          setCounts(existing);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = data?.items.filter((item) => {
    if (filter === "UNCOUNTED") return item.countedQty === null;
    if (filter === "COUNTED") return item.countedQty !== null;
    if (filter === "VARIANCE") return item.variance !== null && item.variance !== 0;
    return true;
  }) || [];

  const handleStatusChange = async (newStatus: string) => {
    setActionLoading(true);
    try {
      await fetch(`/api/stock-counts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      fetchData();
    } catch {
      // handle silently
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveAll = async () => {
    const items = Object.entries(counts)
      .filter(([, val]) => val !== "")
      .map(([itemId, val]) => ({
        id: itemId,
        countedQty: parseInt(val, 10),
      }))
      .filter((i) => !isNaN(i.countedQty));

    if (items.length === 0) return;

    setSaving(true);
    try {
      await fetch(`/api/stock-counts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      fetchData();
    } catch {
      // handle silently
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-slate-400">Stock audit not found</p>
        <Link href="/stock-audit" className="text-sm text-blue-600 mt-2 inline-block">Back to audits</Link>
      </div>
    );
  }

  const progress = data.totalItems > 0 ? Math.round((data.countedItems / data.totalItems) * 100) : 0;

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <Link href="/stock-audit" className="p-1">
          <ArrowLeft className="h-5 w-5 text-slate-600" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-slate-900 truncate">{data.title}</h1>
          <p className="text-xs text-slate-500">
            {data.assignedTo.name} | Due: {new Date(data.dueDate).toLocaleDateString("en-IN")}
          </p>
        </div>
        <Badge variant={STATUS_STYLE[data.status] as "warning" | "info" | "success"}>
          {data.status === "IN_PROGRESS" ? "In Progress" : data.status.charAt(0) + data.status.slice(1).toLowerCase()}
        </Badge>
      </div>

      {/* Progress + Stats */}
      <Card className="mb-3">
        <CardContent className="p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-slate-500">Progress</span>
            <span className="text-xs font-medium text-slate-700">{data.countedItems}/{data.totalItems} ({progress}%)</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2 mb-2">
            <div
              className={`h-2 rounded-full transition-all ${progress === 100 ? "bg-green-500" : "bg-blue-500"}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex gap-4 text-xs">
            <span className="text-slate-500">Variance items: <span className="font-medium text-slate-700">{data.itemsWithVariance}</span></span>
            <span className="text-slate-500">Total variance: <span className={`font-medium ${data.totalVariance !== 0 ? "text-red-600" : "text-green-600"}`}>{data.totalVariance > 0 ? "+" : ""}{data.totalVariance}</span></span>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      {data.status === "PENDING" && (
        <button
          onClick={() => handleStatusChange("IN_PROGRESS")}
          disabled={actionLoading}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium mb-3 disabled:opacity-50">
          <Play className="h-4 w-4" /> {actionLoading ? "Starting..." : "Start Counting"}
        </button>
      )}

      {data.status === "IN_PROGRESS" && (
        <div className="flex gap-2 mb-3">
          <button
            onClick={handleSaveAll}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 bg-slate-900 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
            <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save All"}
          </button>
          <button
            onClick={() => handleStatusChange("COMPLETED")}
            disabled={actionLoading}
            className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
            <CheckCircle2 className="h-4 w-4" /> {actionLoading ? "..." : "Complete Audit"}
          </button>
        </div>
      )}

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-3 pb-1">
        {["ALL", "UNCOUNTED", "COUNTED", "VARIANCE"].map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === f ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
            }`}>
            {f === "ALL" ? `All (${data.totalItems})` :
             f === "UNCOUNTED" ? `Uncounted (${data.totalItems - data.countedItems})` :
             f === "COUNTED" ? `Counted (${data.countedItems})` :
             `Variance (${data.itemsWithVariance})`}
          </button>
        ))}
      </div>

      {/* Items */}
      <div className="space-y-2">
        {filtered.map((item) => {
          const val = counts[item.id] ?? "";
          const variance = val !== "" ? parseInt(val, 10) - item.systemQty : null;
          const isCounted = item.countedQty !== null || val !== "";

          return (
            <Card key={item.id} className={`${isCounted ? "border-l-4 border-l-green-400" : ""}`}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between mb-1.5">
                  <div className="flex-1 min-w-0 mr-2">
                    <p className="text-sm font-medium text-slate-900 truncate">{item.product.name}</p>
                    <p className="text-xs text-slate-500">
                      {item.product.sku}
                      {item.product.category ? ` | ${item.product.category.name}` : ""}
                      {item.product.bin ? ` | Bin: ${item.product.bin.code}` : ""}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-slate-500">System</p>
                    <p className="text-sm font-bold text-slate-900">{item.systemQty}</p>
                  </div>
                </div>

                {data.status === "IN_PROGRESS" ? (
                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex-1">
                      <input
                        type="number"
                        inputMode="numeric"
                        placeholder="Count"
                        value={val}
                        onChange={(e) => setCounts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                      />
                    </div>
                    {variance !== null && !isNaN(variance) && (
                      <div className={`text-right shrink-0 min-w-[60px] ${variance === 0 ? "text-green-600" : "text-red-600"}`}>
                        <p className="text-xs">Variance</p>
                        <p className="text-sm font-bold">{variance > 0 ? "+" : ""}{variance}</p>
                      </div>
                    )}
                  </div>
                ) : item.countedQty !== null ? (
                  <div className="flex items-center gap-4 mt-2 text-xs">
                    <span className="text-blue-600">Counted: <span className="font-medium">{item.countedQty}</span></span>
                    {item.variance !== null && item.variance !== 0 && (
                      <span className="text-red-600">Variance: <span className="font-medium">{item.variance > 0 ? "+" : ""}{item.variance}</span></span>
                    )}
                    {item.variance === 0 && <span className="text-green-600">Match</span>}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && <p className="text-sm text-slate-400 text-center py-8">No items in this filter</p>}
      </div>
    </div>
  );
}
