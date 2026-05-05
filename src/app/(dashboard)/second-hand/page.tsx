"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Search, Plus, Bike, Loader2, Archive } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useDebounce } from "@/lib/utils";

interface SecondHandItem {
  id: string;
  sku: string;
  name: string;
  condition: string;
  status: string;
  costPrice?: number;
  sellingPrice?: number | null;
  size?: string | null;
  photoUrl: string;
  customerName: string;
  createdAt: string;
  isArchived: boolean;
  isVerified?: boolean;
  bin: { code: string; name: string } | null;
}

interface Stats {
  inStock: { count: number; totalCostValue: number };
  soldThisMonth: { count: number; revenue: number; profit: number };
  avgMargin: number;
  aging: { over7: number; over14: number; over30: number };
}

type StatusFilter = "ALL" | "IN_STOCK" | "SOLD";

const CONDITION_COLORS: Record<string, string> = {
  EXCELLENT: "bg-green-100 text-green-700",
  GOOD: "bg-blue-100 text-blue-700",
  FAIR: "bg-amber-100 text-amber-700",
  SCRAP: "bg-red-100 text-red-700",
};

function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

export default function SecondHandPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role || "";
  const canAdd = ["ADMIN", "OUTWARDS_CLERK"].includes(role);
  const isAdmin = role === "ADMIN";

  const [cycles, setCycles] = useState<SecondHandItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("IN_STOCK");
  const [conditionFilter, setConditionFilter] = useState("ALL");
  const [sizeFilter, setSizeFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const debouncedSearch = useDebounce(search);
  const [actionError, setActionError] = useState("");

  const fetchData = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "100" });
    if (filter !== "ALL") params.set("status", filter);
    if (conditionFilter !== "ALL") params.set("condition", conditionFilter);
    if (sizeFilter !== "ALL") params.set("size", sizeFilter);
    if (debouncedSearch.length >= 2) params.set("search", debouncedSearch);
    if (showArchived) params.set("showArchived", "true");

    Promise.all([
      fetch(`/api/second-hand?${params}`).then((r) => r.json()),
      fetch("/api/second-hand/stats").then((r) => r.json()),
    ])
      .then(([listRes, statsRes]) => {
        if (listRes.success) setCycles(listRes.data);
        if (statsRes.success) setStats(statsRes.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filter, conditionFilter, sizeFilter, debouncedSearch, showArchived]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleArchive = async (cycleId: string, cycleName: string) => {
    if (!confirm(`Archive "${cycleName}"? It will be hidden from the default list.`)) return;
    try {
      await fetch(`/api/second-hand/${cycleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived: true }),
      });
      fetchData();
    } catch (e) { setActionError(e instanceof Error ? e.message : "Archive failed"); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Second-Hand Cycles</h1>
          <p className="text-xs text-slate-500">Exchange inventory</p>
        </div>
        <div className="flex gap-2">
          {(role === "ADMIN" || role === "SUPERVISOR") && (
            <Link href="/second-hand/verify">
              <Button size="sm" variant="outline" className="text-amber-700 border-amber-300">
                Verify
              </Button>
            </Link>
          )}
          {canAdd && (
            <Link href="/second-hand/new">
              <Button size="sm" className="bg-orange-600 hover:bg-orange-700">
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </Link>
          )}
        </div>
      </div>

      {actionError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 mb-3 text-xs text-red-700">
          {actionError}
          <button onClick={() => setActionError("")} className="ml-2 underline">dismiss</button>
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className={`grid ${isAdmin ? "grid-cols-3" : "grid-cols-2"} gap-1.5 mb-3`}>
          <Card className="bg-green-50 border-green-200"><CardContent className="p-2 text-center">
            <p className="text-lg font-bold text-green-700">{stats.inStock.count}</p>
            <p className="text-[9px] text-green-600">In Stock</p>
            {isAdmin && <p className="text-[9px] text-green-500">{formatINR(stats.inStock.totalCostValue)}</p>}
          </CardContent></Card>
          <Card className="bg-blue-50 border-blue-200"><CardContent className="p-2 text-center">
            <p className="text-lg font-bold text-blue-700">{stats.soldThisMonth.count}</p>
            <p className="text-[9px] text-blue-600">Sold (Month)</p>
            {isAdmin && <p className="text-[9px] text-blue-500">{formatINR(stats.soldThisMonth.revenue)}</p>}
          </CardContent></Card>
          {isAdmin && (
            <Card className="bg-purple-50 border-purple-200"><CardContent className="p-2 text-center">
              <p className="text-lg font-bold text-purple-700">{formatINR(stats.avgMargin)}</p>
              <p className="text-[9px] text-purple-600">Avg Margin</p>
              {stats.aging.over30 > 0 && (
                <p className="text-[9px] text-red-500">{stats.aging.over30} &gt;30d</p>
              )}
            </CardContent></Card>
          )}
        </div>
      )}

      {/* Status Filter */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide mb-2 pb-1">
        {(["ALL", "IN_STOCK", "SOLD"] as StatusFilter[]).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === f ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}>
            {f === "ALL" ? "All" : f === "IN_STOCK" ? "In Stock" : "Sold"}
          </button>
        ))}
        {isAdmin && (
          <button onClick={() => setShowArchived(!showArchived)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ml-auto ${
              showArchived ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}>
            <Archive className="h-3 w-3 inline mr-1" />
            {showArchived ? "Showing Archived" : "Show Archived"}
          </button>
        )}
      </div>

      {/* Size + Condition Filters */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-1 pb-1">
        <span className="shrink-0 text-[10px] text-slate-400 self-center">Size:</span>
        {["ALL", '12"', '16"', '20"', '24"', '26"', '27.5"', '29"'].map((s) => (
          <button key={s} onClick={() => setSizeFilter(s)}
            className={`shrink-0 px-2 py-1 rounded-full text-[10px] font-medium transition-colors ${
              sizeFilter === s ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"
            }`}>
            {s === "ALL" ? "All" : s}
          </button>
        ))}
      </div>
      <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-2 pb-1">
        <span className="shrink-0 text-[10px] text-slate-400 self-center">Cond:</span>
        {["ALL", "EXCELLENT", "GOOD", "FAIR", "SCRAP"].map((c) => (
          <button key={c} onClick={() => setConditionFilter(c)}
            className={`shrink-0 px-2 py-1 rounded-full text-[10px] font-medium transition-colors ${
              conditionFilter === c ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"
            }`}>
            {c === "ALL" ? "All" : c.charAt(0) + c.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input placeholder="Search name, SKU, customer..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      ) : cycles.length === 0 ? (
        <div className="text-center py-12">
          <Bike className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400">No second-hand cycles found</p>
          {canAdd && (
            <Link href="/second-hand/new">
              <Button variant="outline" size="sm" className="mt-3">Add First Exchange</Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {cycles.map((c) => (
            <div key={c.id} className="relative">
              <Link href={`/second-hand/${c.id}`}>
                <Card className={`hover:border-slate-300 transition-colors mb-2 ${c.isArchived ? "opacity-50" : ""}`}>
                  <CardContent className="p-3">
                    <div className="flex gap-3">
                      {/* Photo thumbnail */}
                      <div className="w-16 h-16 rounded-lg bg-slate-100 overflow-hidden shrink-0">
                        {c.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.photoUrl} alt={c.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Bike className="h-6 w-6 text-slate-300" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-medium text-slate-900">
                              {c.name}
                              {c.isArchived && <span className="ml-1 text-[10px] text-amber-600 font-normal">(Archived)</span>}
                            </p>
                            <p className="text-xs text-slate-500">{c.sku} | {c.customerName}</p>
                          </div>
                          <Badge variant={c.status === "IN_STOCK" ? "success" : "default"}>
                            {c.status === "IN_STOCK" ? "In Stock" : "Sold"}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${CONDITION_COLORS[c.condition] || ""}`}>
                            {c.condition}
                          </span>
                          {c.size && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-indigo-100 text-indigo-700">
                              {c.size}
                            </span>
                          )}
                          {c.isVerified === false && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">
                              Pending
                            </span>
                          )}
                          {isAdmin && c.costPrice != null && (
                            <span className="text-xs font-medium text-slate-700">
                              Cost: {formatINR(c.costPrice)}
                            </span>
                          )}
                          {isAdmin && c.sellingPrice && (
                            <span className="text-xs font-medium text-green-600">
                              Sell: {formatINR(c.sellingPrice)}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">{new Date(c.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
              {isAdmin && !c.isArchived && (
                <button
                  onClick={(e) => { e.preventDefault(); handleArchive(c.id, c.name); }}
                  className="absolute top-2 right-2 p-1.5 rounded-md bg-slate-100 text-slate-500 hover:bg-amber-100 hover:text-amber-700 transition-colors z-10"
                  title="Archive"
                >
                  <Archive className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
