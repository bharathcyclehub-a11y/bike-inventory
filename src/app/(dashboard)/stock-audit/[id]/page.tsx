"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import { ArrowLeft, Play, CheckCircle2, Save, Search, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/lib/utils";

interface StockCountItemData {
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
    type: string;
    category: { name: string } | null;
    brand: { name: string } | null;
    bin: { code: string; location: string } | null;
  };
}

interface StockCountSummary {
  id: string;
  title: string;
  status: string;
  dueDate: string;
  completedAt: string | null;
  notes: string | null;
  assignedTo: { name: string };
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
  const [summary, setSummary] = useState<StockCountSummary | null>(null);
  const [items, setItems] = useState<StockCountItemData[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const [filter, setFilter] = useState("all");
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  // Fetch summary (lightweight — no items)
  const fetchSummary = useCallback(() => {
    fetch(`/api/stock-counts/${id}`)
      .then((r) => r.json())
      .then((res) => { if (res.success) setSummary(res.data); })
      .catch(() => {})
      .finally(() => setLoadingSummary(false));
  }, [id]);

  // Fetch items with search + filter (server-side, max 50)
  const fetchItems = useCallback(() => {
    setLoadingItems(true);
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (filter !== "all") params.set("filter", filter);

    fetch(`/api/stock-counts/${id}/items?${params}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setItems(res.data);
          // Preserve existing local counts, load server counts for new items
          setCounts((prev) => {
            const merged = { ...prev };
            res.data.forEach((item: StockCountItemData) => {
              if (!(item.id in merged) && item.countedQty !== null) {
                merged[item.id] = String(item.countedQty);
              }
            });
            return merged;
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoadingItems(false));
  }, [id, debouncedSearch, filter]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);
  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleStatusChange = async (newStatus: string) => {
    setActionLoading(true);
    try {
      await fetch(`/api/stock-counts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      fetchSummary();
    } catch { /* */ }
    finally { setActionLoading(false); }
  };

  const handleSaveBatch = async () => {
    const batch = Object.entries(counts)
      .filter(([, val]) => val !== "")
      .map(([itemId, val]) => ({ id: itemId, countedQty: parseInt(val, 10) }))
      .filter((i) => !isNaN(i.countedQty));

    if (batch.length === 0) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/stock-counts/${id}/items`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: batch }),
      });
      const data = await res.json();
      if (data.success) {
        setSavedCount(data.data.updated);
        setTimeout(() => setSavedCount(0), 2000);
        fetchSummary();
        fetchItems();
      }
    } catch { /* */ }
    finally { setSaving(false); }
  };

  if (loadingSummary) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-3 border border-slate-100 rounded-lg animate-pulse">
            <div className="h-4 bg-slate-200 rounded w-3/4 mb-2" />
            <div className="h-3 bg-slate-200 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-slate-400">Stock audit not found</p>
        <Link href="/stock-audit" className="text-sm text-blue-600 mt-2 inline-block">Back to audits</Link>
      </div>
    );
  }

  const progress = summary.totalItems > 0 ? Math.round((summary.countedItems / summary.totalItems) * 100) : 0;
  const unsavedCount = Object.entries(counts).filter(([itemId, val]) => {
    const item = items.find((i) => i.id === itemId);
    return val !== "" && item && String(item.countedQty ?? "") !== val;
  }).length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <Link href="/stock-audit" className="p-1">
          <ArrowLeft className="h-5 w-5 text-slate-600" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-slate-900 truncate">{summary.title}</h1>
          <p className="text-xs text-slate-500">
            {summary.assignedTo.name} | Due: {new Date(summary.dueDate).toLocaleDateString("en-IN")}
          </p>
        </div>
        <Badge variant={STATUS_STYLE[summary.status] as "warning" | "info" | "success"}>
          {summary.status === "IN_PROGRESS" ? "In Progress" : summary.status.charAt(0) + summary.status.slice(1).toLowerCase()}
        </Badge>
      </div>

      {/* Progress */}
      <Card className="mb-3">
        <CardContent className="p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-slate-500">Progress</span>
            <span className="text-xs font-medium text-slate-700">{summary.countedItems}/{summary.totalItems} ({progress}%)</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2 mb-2">
            <div
              className={`h-2 rounded-full transition-all ${progress === 100 ? "bg-green-500" : "bg-blue-500"}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex gap-4 text-xs">
            <span className="text-slate-500">Variance: <span className="font-medium text-slate-700">{summary.itemsWithVariance}</span></span>
            <span className="text-slate-500">Total: <span className={`font-medium ${summary.totalVariance !== 0 ? "text-red-600" : "text-green-600"}`}>{summary.totalVariance > 0 ? "+" : ""}{summary.totalVariance}</span></span>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      {summary.status === "PENDING" && (
        <button onClick={() => handleStatusChange("IN_PROGRESS")} disabled={actionLoading}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium mb-3 disabled:opacity-50">
          <Play className="h-4 w-4" /> {actionLoading ? "Starting..." : "Start Counting"}
        </button>
      )}

      {summary.status === "IN_PROGRESS" && (
        <div className="flex gap-2 mb-3">
          <button onClick={handleSaveBatch} disabled={saving || unsavedCount === 0}
            className="flex-1 flex items-center justify-center gap-2 bg-slate-900 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : savedCount > 0 ? `Saved ${savedCount}!` : unsavedCount > 0 ? `Save (${unsavedCount})` : "Save All"}
          </button>
          <button onClick={() => handleStatusChange("COMPLETED")} disabled={actionLoading}
            className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
            <CheckCircle2 className="h-4 w-4" /> {actionLoading ? "..." : "Complete"}
          </button>
        </div>
      )}

      {/* Smart Search */}
      <div className="relative mb-2">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search by name, SKU, brand, or category..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Filter Chips */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-3 pb-1">
        {[
          { key: "all", label: `All (${summary.totalItems})` },
          { key: "uncounted", label: `Uncounted (${summary.totalItems - summary.countedItems})` },
          { key: "counted", label: `Counted (${summary.countedItems})` },
          { key: "variance", label: `Variance (${summary.itemsWithVariance})` },
        ].map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === f.key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Items */}
      {loadingItems ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const val = counts[item.id] ?? "";
            const variance = val !== "" ? parseInt(val, 10) - item.systemQty : null;
            const isCounted = item.countedQty !== null || val !== "";

            return (
              <Card key={item.id} className={`${isCounted ? "border-l-4 border-l-green-400" : ""}`}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex-1 min-w-0 mr-2">
                      <p className="text-sm font-medium text-slate-900 truncate">{item.product.name}</p>
                      <p className="text-xs text-slate-500">
                        {item.product.sku}
                        {item.product.brand ? ` | ${item.product.brand.name}` : ""}
                        {item.product.category ? ` | ${item.product.category.name}` : ""}
                        {item.product.bin ? ` | ${item.product.bin.code}` : ""}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-slate-500">System</p>
                      <p className="text-sm font-bold text-slate-900">{item.systemQty}</p>
                    </div>
                  </div>

                  {summary.status === "IN_PROGRESS" ? (
                    <div className="flex items-center gap-3 mt-2">
                      <input
                        type="number"
                        inputMode="numeric"
                        placeholder="Physical count"
                        value={val}
                        onChange={(e) => setCounts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                      />
                      {variance !== null && !isNaN(variance) && (
                        <div className={`text-right shrink-0 min-w-[60px] ${variance === 0 ? "text-green-600" : "text-red-600"}`}>
                          <p className="text-xs">Var</p>
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

          {items.length === 0 && !loadingItems && (
            <p className="text-sm text-slate-400 text-center py-8">
              {search ? "No items match your search" : "No items in this filter"}
            </p>
          )}

          {items.length === 50 && (
            <p className="text-xs text-slate-400 text-center py-2">
              Showing first 50 results. Use search to find specific items.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
