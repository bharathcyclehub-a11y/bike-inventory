"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronDown, ChevronRight, Search, AlertTriangle, Package, MapPin, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/lib/utils";

interface BinProduct {
  id: string;
  name: string;
  sku: string;
  type: string;
  currentStock: number;
  reorderLevel: number;
  sellingPrice: number;
  mrp: number;
  category: { name: string } | null;
  brand: { name: string } | null;
}

interface BinStock {
  id: string;
  code: string;
  name: string;
  location: string;
  zone: string | null;
  productCount: number;
  totalStock: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalValue: number;
  products?: BinProduct[];
}

function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

export default function BinStockPage() {
  const [bins, setBins] = useState<BinStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loadingBins, setLoadingBins] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);

  useEffect(() => {
    fetch("/api/stock/by-bin")
      .then((r) => r.json())
      .then((res) => { if (res.success) setBins(res.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const loadBinProducts = useCallback(async (binId: string) => {
    setLoadingBins((prev) => new Set(prev).add(binId));
    try {
      const res = await fetch(`/api/products?binId=${binId}&status=ACTIVE&limit=500&sortBy=name&sortOrder=asc`);
      const data = await res.json();
      if (data.success) {
        setBins((prev) => prev.map((b) =>
          b.id === binId ? { ...b, products: data.data } : b
        ));
      }
    } catch {}
    setLoadingBins((prev) => {
      const next = new Set(prev);
      next.delete(binId);
      return next;
    });
  }, []);

  const filtered = debouncedSearch
    ? bins.filter((b) =>
        b.code.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        b.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        b.location.toLowerCase().includes(debouncedSearch.toLowerCase())
      )
    : bins;

  // Group by zone/location
  const zoneGroups: Record<string, BinStock[]> = {};
  for (const b of filtered) {
    const zone = b.zone || b.location || "Other";
    if (!zoneGroups[zone]) zoneGroups[zone] = [];
    zoneGroups[zone].push(b);
  }

  const totalProducts = filtered.reduce((s, b) => s + b.productCount, 0);
  const totalStock = filtered.reduce((s, b) => s + b.totalStock, 0);
  const totalLow = filtered.reduce((s, b) => s + b.lowStockCount, 0);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        const bin = bins.find((b) => b.id === id);
        if (bin && !bin.products) {
          loadBinProducts(id);
        }
      }
      return next;
    });
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <Link href="/stock" className="p-1">
          <ArrowLeft className="h-5 w-5 text-slate-600" />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-slate-900">Stock by Bin</h1>
          <p className="text-xs text-slate-500">
            {filtered.length} bins | {totalProducts} products | {totalStock.toLocaleString("en-IN")} units | {totalLow} low stock
          </p>
        </div>
      </div>

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search bin or location..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="p-4 border border-slate-100 rounded-lg animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-1/3 mb-2" />
              <div className="h-3 bg-slate-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Package className="h-10 w-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-400">No bins found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(zoneGroups).map(([zone, zoneBins]) => (
            <div key={zone}>
              <p className="text-xs font-semibold text-slate-500 mb-1.5 flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {zone} ({zoneBins.reduce((s, b) => s + b.productCount, 0)} products)
              </p>
              <div className="space-y-2">
                {zoneBins.map((bin) => {
                  const isExpanded = expanded.has(bin.id);
                  const isLoadingProducts = loadingBins.has(bin.id);

                  return (
                    <Card key={bin.id}>
                      <CardContent className="p-0">
                        <button
                          onClick={() => toggle(bin.id)}
                          className="w-full p-3 flex items-center gap-3 text-left"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-slate-900">{bin.code}</p>
                              <span className="text-xs text-slate-500">{bin.name}</span>
                              {bin.lowStockCount > 0 && (
                                <Badge variant="warning" className="text-[10px]">
                                  <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                                  {bin.lowStockCount} low
                                </Badge>
                              )}
                              {bin.outOfStockCount > 0 && (
                                <Badge variant="danger" className="text-[10px]">
                                  {bin.outOfStockCount} out
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {bin.productCount} products | {bin.totalStock.toLocaleString("en-IN")} units
                            </p>
                          </div>
                          <div className="text-right shrink-0 mr-1">
                            <p className="text-sm font-bold text-slate-700">{bin.totalStock.toLocaleString("en-IN")} <span className="text-[10px] font-normal text-slate-400">units</span></p>
                          </div>
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                          )}
                        </button>

                        {isExpanded && (
                          <div className="border-t border-slate-100 px-3 pb-3">
                            {isLoadingProducts ? (
                              <div className="flex items-center justify-center py-4 gap-2">
                                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                                <span className="text-xs text-slate-400">Loading products...</span>
                              </div>
                            ) : bin.products ? (
                              bin.products.length === 0 ? (
                                <p className="text-xs text-slate-400 py-3 text-center">No products in this bin</p>
                              ) : (
                                bin.products.map((p) => (
                                  <Link key={p.id} href={`/stock/${p.id}`}>
                                    <div className="flex items-center gap-2 py-2 border-b border-slate-50 last:border-0 hover:bg-slate-50 -mx-1 px-1 rounded">
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-slate-800 truncate">{p.name}</p>
                                        <p className="text-[10px] text-slate-400">
                                          {p.sku} {p.brand ? `| ${p.brand.name}` : ""} {p.category ? `| ${p.category.name}` : ""}
                                        </p>
                                      </div>
                                      <div className="text-right shrink-0">
                                        <p className={`text-sm font-bold ${
                                          p.currentStock <= 0 ? "text-red-600" :
                                          p.reorderLevel > 0 && p.currentStock <= p.reorderLevel ? "text-yellow-600" : "text-green-600"
                                        }`}>{p.currentStock}</p>
                                      </div>
                                    </div>
                                  </Link>
                                ))
                              )
                            ) : null}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
