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
  costPrice: number;
  sellingPrice: number | null;
  photoUrl: string;
  customerName: string;
  createdAt: string;
  isArchived: boolean;
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
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const debouncedSearch = useDebounce(search);

  const fetchData = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "100" });
    if (filter !== "ALL") params.set("status", filter);
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
  }, [filter, debouncedSearch, showArchived]);

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
    } catch { /* */ }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Second-Hand Cycles</h1>
          <p className="text-xs text-slate-500">Exchange inventory</p>
        </div>
        {canAdd && (
          <Link href="/second-hand/new">
            <Button size="sm" className="bg-orange-600 hover:bg-orange-700">
              <Plus className="h-4 w-4 mr-1" /> Add Exchange
            </Button>
          </Link>
        )}
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-1.5 mb-3">
          <Card className="bg-green-50 border-green-200"><CardContent className="p-2 text-center">
            <p className="text-lg font-bold text-green-700">{stats.inStock.count}</p>
            <p className="text-[9px] text-green-600">In Stock</p>
            <p className="text-[9px] text-green-500">{formatINR(stats.inStock.totalCostValue)}</p>
          </CardContent></Card>
          <Card className="bg-blue-50 border-blue-200"><CardContent className="p-2 text-center">
            <p className="text-lg font-bold text-blue-700">{stats.soldThisMonth.count}</p>
            <p className="text-[9px] text-blue-600">Sold (Month)</p>
            <p className="text-[9px] text-blue-500">{formatINR(stats.soldThisMonth.revenue)}</p>
          </CardContent></Card>
          <Card className="bg-purple-50 border-purple-200"><CardContent className="p-2 text-center">
            <p className="text-lg font-bold text-purple-700">{formatINR(stats.avgMargin)}</p>
            <p className="text-[9px] text-purple-600">Avg Margin</p>
            {stats.aging.over30 > 0 && (
              <p className="text-[9px] text-red-500">{stats.aging.over30} &gt;30d</p>
            )}
          </CardContent></Card>
        </div>
      )}

      {/* Filter */}
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
                          <span className="text-xs font-medium text-slate-700">
                            Cost: {formatINR(c.costPrice)}
                          </span>
                          {c.sellingPrice && (
                            <span className="text-xs font-medium text-green-600">
                              Sell: {formatINR(c.sellingPrice)}
                            </span>
                          )}
                        </div>
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
