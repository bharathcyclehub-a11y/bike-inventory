"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Search, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useDebounce } from "@/lib/utils";
import type { FilterChip } from "@/types";

interface ProductItem {
  id: string;
  sku: string;
  name: string;
  type: string;
  currentStock: number;
  reorderLevel: number;
  category: { name: string } | null;
  brand: { name: string } | null;
  bin: { code: string } | null;
}

const FILTER_CHIPS: { key: FilterChip; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "BICYCLES", label: "Bicycles" },
  { key: "SPARES", label: "Spares" },
  { key: "ACCESSORIES", label: "Accessories" },
  { key: "LOW_STOCK", label: "Low Stock" },
];

function getStockVariant(p: ProductItem) {
  if (p.currentStock <= 0) return "danger";
  if (p.currentStock <= p.reorderLevel) return "warning";
  return "success";
}

function getStockLabel(p: ProductItem) {
  if (p.currentStock <= 0) return "Out of Stock";
  if (p.currentStock <= p.reorderLevel) return "Low";
  return "OK";
}

export default function StockPage() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const [activeFilter, setActiveFilter] = useState<FilterChip>("ALL");

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "200" });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (activeFilter === "BICYCLES") params.set("type", "BICYCLE");
    else if (activeFilter === "SPARES") params.set("type", "SPARE_PART");
    else if (activeFilter === "ACCESSORIES") params.set("type", "ACCESSORY");

    fetch(`/api/products?${params}`)
      .then((r) => r.json())
      .then((res) => { if (res.success) setProducts(res.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [debouncedSearch, activeFilter]);

  const filtered = activeFilter === "LOW_STOCK"
    ? products.filter((p) => p.currentStock <= p.reorderLevel)
    : products;

  return (
    <div>
      <h1 className="text-lg font-bold text-slate-900 mb-3">Stock</h1>

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search SKU, product, category, or bin..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-4 pb-1">
        {FILTER_CHIPS.map((chip) => (
          <button
            key={chip.key}
            onClick={() => setActiveFilter(chip.key)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              activeFilter === chip.key
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <p className="text-xs text-slate-500 mb-2">
        {filtered.length} product{filtered.length !== 1 ? "s" : ""}
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => (
            <Link key={p.id} href={`/stock/${p.id}`}>
              <Card className="hover:border-slate-300 transition-colors mb-2">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0 mr-3">
                      <p className="text-sm font-medium text-slate-900 truncate">{p.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{p.sku} | {p.brand?.name}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Badge variant="default">{p.category?.name}</Badge>
                        {p.bin && (
                          <span className="inline-flex items-center text-xs text-slate-500">
                            <MapPin className="h-3 w-3 mr-0.5" />{p.bin.code}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-xl font-bold ${
                        p.currentStock <= 0 ? "text-red-600" :
                        p.currentStock <= p.reorderLevel ? "text-yellow-600" : "text-green-600"
                      }`}>{p.currentStock}</p>
                      <Badge variant={getStockVariant(p)} className="text-[10px]">{getStockLabel(p)}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm text-slate-400">No products found</p>
        </div>
      )}
    </div>
  );
}
