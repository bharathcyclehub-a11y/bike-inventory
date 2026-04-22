"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ArrowLeft, ChevronDown, ChevronRight, Search, AlertTriangle, Package, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/lib/utils";

interface BrandProduct {
  id: string;
  name: string;
  sku: string;
  type: string;
  currentStock: number;
  reorderLevel: number;
  sellingPrice: number;
  mrp: number;
  category: { name: string } | null;
  bin: { code: string; name: string; location: string } | null;
}

interface BrandStock {
  id: string;
  name: string;
  contactPhone: string | null;
  whatsappNumber: string | null;
  productCount: number;
  totalStock: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalValue: number;
  products?: BrandProduct[];
}

type SortKey = "name" | "value" | "count" | "stock";

export default function BrandStockPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const isAdmin = role === "ADMIN";
  const [brands, setBrands] = useState<BrandStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loadingBrands, setLoadingBrands] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const [sortBy, setSortBy] = useState<SortKey>("name");

  useEffect(() => {
    fetch("/api/stock/by-brand")
      .then((r) => r.json())
      .then((res) => { if (res.success) setBrands(res.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Lazy-load products for a brand when expanded
  const loadBrandProducts = useCallback(async (brandId: string) => {
    setLoadingBrands((prev) => new Set(prev).add(brandId));
    try {
      const res = await fetch(`/api/products?brandId=${brandId}&status=ACTIVE&limit=500&sortBy=name&sortOrder=asc`);
      const data = await res.json();
      if (data.success) {
        setBrands((prev) => prev.map((b) =>
          b.id === brandId ? { ...b, products: data.data } : b
        ));
      }
    } catch {}
    setLoadingBrands((prev) => {
      const next = new Set(prev);
      next.delete(brandId);
      return next;
    });
  }, []);

  const searched = debouncedSearch
    ? brands.filter((b) =>
        b.name.toLowerCase().includes(debouncedSearch.toLowerCase())
      )
    : brands;

  const filtered = [...searched].sort((a, b) => {
    if (sortBy === "name") return a.name.localeCompare(b.name);
    if (sortBy === "value") return b.totalValue - a.totalValue;
    if (sortBy === "count") return b.productCount - a.productCount;
    if (sortBy === "stock") return b.totalStock - a.totalStock;
    return 0;
  });

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
        // Lazy-load products if not already loaded
        const brand = brands.find((b) => b.id === id);
        if (brand && !brand.products) {
          loadBrandProducts(id);
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
          <h1 className="text-lg font-bold text-slate-900">Stock by Brand</h1>
          <p className="text-xs text-slate-500">
            {totalProducts} products | {totalStock.toLocaleString("en-IN")} units | {totalLow} low stock
          </p>
        </div>
      </div>

      <div className="relative mb-2">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search brand..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="flex gap-1.5 mb-3 overflow-x-auto scrollbar-hide pb-1">
        {([
          { key: "name", label: "Name A-Z" },
          ...(isAdmin ? [{ key: "value" as SortKey, label: "Highest Value" }] : []),
          { key: "count", label: "Most Products" },
          { key: "stock", label: "Most Stock" },
        ] as { key: SortKey; label: string }[]).map((s) => (
          <button key={s.key} onClick={() => setSortBy(s.key)}
            className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
              sortBy === s.key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            }`}>
            {s.label}
          </button>
        ))}
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
          <p className="text-sm text-slate-400">No brands found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((brand) => {
            const isExpanded = expanded.has(brand.id);
            const isLoadingProducts = loadingBrands.has(brand.id);

            return (
              <Card key={brand.id}>
                <CardContent className="p-0">
                  <button
                    onClick={() => toggle(brand.id)}
                    className="w-full p-3 flex items-center gap-3 text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">{brand.name}</p>
                        {brand.lowStockCount > 0 && (
                          <Badge variant="warning" className="text-[10px]">
                            <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                            {brand.lowStockCount} low
                          </Badge>
                        )}
                        {brand.outOfStockCount > 0 && (
                          <Badge variant="danger" className="text-[10px]">
                            {brand.outOfStockCount} out
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {brand.productCount} products | {brand.totalStock.toLocaleString("en-IN")} units
                      </p>
                    </div>
                    {isAdmin && (
                      <div className="text-right shrink-0 mr-1">
                        <p className="text-sm font-bold text-slate-700">
                          {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(brand.totalValue)}
                        </p>
                      </div>
                    )}
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
                      ) : brand.products ? (
                        brand.products.filter((p) => p.currentStock >= 1).length === 0 ? (
                          <p className="text-xs text-slate-400 text-center py-3">No items in stock</p>
                        ) : (
                          brand.products.filter((p) => p.currentStock >= 1).map((p) => (
                            <Link key={p.id} href={`/stock/${p.id}`}>
                              <div className="flex items-center gap-2 py-2 border-b border-slate-50 last:border-0 hover:bg-slate-50 -mx-1 px-1 rounded">
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-slate-800 truncate">{p.name}</p>
                                  <p className="text-[10px] text-slate-400">
                                    {p.sku} | {p.category?.name || ""} {p.bin ? `| ${p.bin.code}` : ""}
                                  </p>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className={`text-sm font-bold ${
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
      )}
    </div>
  );
}
