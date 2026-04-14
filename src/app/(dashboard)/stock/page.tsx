"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Search, MapPin, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useDebounce } from "@/lib/utils";
import { ExportButtons } from "@/components/export-buttons";
import { exportToExcel, exportToPDF, type ExportColumn } from "@/lib/export";

const STOCK_COLUMNS: ExportColumn[] = [
  { header: "SKU", key: "sku" },
  { header: "Product Name", key: "name" },
  { header: "Type", key: "type" },
  { header: "Category", key: "category.name" },
  { header: "Brand", key: "brand.name" },
  { header: "Stock", key: "currentStock" },
  { header: "Reorder Level", key: "reorderLevel" },
  { header: "Bin", key: "bin.code" },
];

interface ProductItem {
  id: string;
  sku: string;
  name: string;
  type: string;
  status: string;
  currentStock: number;
  reorderLevel: number;
  category: { name: string } | null;
  brand: { id: string; name: string } | null;
  bin: { code: string } | null;
}

interface BrandItem {
  id: string;
  name: string;
  _count: { products: number };
}

type StockFilter = "ALL" | "BICYCLES" | "SPARES" | "ACCESSORIES" | "LOW_STOCK" | "INACTIVE";

const FILTER_CHIPS: { key: StockFilter; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "BICYCLES", label: "Bicycles" },
  { key: "SPARES", label: "Spares" },
  { key: "ACCESSORIES", label: "Accessories" },
  { key: "LOW_STOCK", label: "Low Stock" },
  { key: "INACTIVE", label: "Inactive" },
];

const PAGE_SIZE = 50;

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
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const [activeFilter, setActiveFilter] = useState<StockFilter>("ALL");
  const [selectedBrand, setSelectedBrand] = useState<string>("ALL");
  const [brands, setBrands] = useState<BrandItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  // Fetch brands once
  useEffect(() => {
    fetch("/api/brands")
      .then((r) => r.json())
      .then((res) => { if (res.success) setBrands(res.data); })
      .catch(() => {});
  }, []);

  const buildParams = useCallback((pageNum: number) => {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), page: String(pageNum) });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (activeFilter === "BICYCLES") { params.set("type", "BICYCLE"); params.set("status", "ACTIVE"); }
    else if (activeFilter === "SPARES") { params.set("type", "SPARE_PART"); params.set("status", "ACTIVE"); }
    else if (activeFilter === "ACCESSORIES") { params.set("type", "ACCESSORY"); params.set("status", "ACTIVE"); }
    else if (activeFilter === "INACTIVE") { params.set("status", "INACTIVE"); }
    else if (activeFilter === "ALL" || activeFilter === "LOW_STOCK") { params.set("status", "ACTIVE"); }
    if (selectedBrand !== "ALL") params.set("brandId", selectedBrand);
    return params;
  }, [debouncedSearch, activeFilter, selectedBrand]);

  // Reset and fetch page 1 when filters/search change
  useEffect(() => {
    setLoading(true);
    setPage(1);
    const params = buildParams(1);

    fetch(`/api/products?${params}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setProducts(res.data);
          setTotal(res.pagination?.total || 0);
          setHasMore(res.pagination?.hasMore || false);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [buildParams]);

  // Load more
  function loadMore() {
    const nextPage = page + 1;
    setLoadingMore(true);
    const params = buildParams(nextPage);

    fetch(`/api/products?${params}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setProducts((prev) => [...prev, ...res.data]);
          setPage(nextPage);
          setHasMore(res.pagination?.hasMore || false);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  }

  const filtered = activeFilter === "LOW_STOCK"
    ? products.filter((p) => p.currentStock <= p.reorderLevel)
    : products;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-bold text-slate-900">Stock</h1>
        <ExportButtons
          onExcel={() => exportToExcel(filtered as unknown as Record<string, unknown>[], STOCK_COLUMNS, "stock-inventory")}
          onPDF={() => exportToPDF("Stock Inventory", filtered as unknown as Record<string, unknown>[], STOCK_COLUMNS, "stock-inventory")}
        />
      </div>

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search SKU, product, category, or bin..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-2 pb-1">
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

      {/* Brand Filter */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-4 pb-1">
        <button
          onClick={() => setSelectedBrand("ALL")}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            selectedBrand === "ALL" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >All Brands</button>
        {brands.map((b) => (
          <button
            key={b.id}
            onClick={() => setSelectedBrand(b.id)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              selectedBrand === b.id ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {b.name} ({b._count.products})
          </button>
        ))}
      </div>

      <p className="text-xs text-slate-500 mb-2">
        Showing {filtered.length} of {activeFilter === "LOW_STOCK" ? `${filtered.length} low stock` : total.toLocaleString("en-IN")} products
      </p>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="p-3 border border-slate-100 rounded-lg animate-pulse">
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 bg-slate-200 rounded w-3/4" />
                  <div className="h-3 bg-slate-200 rounded w-1/2" />
                </div>
                <div className="h-6 w-14 bg-slate-200 rounded-full" />
              </div>
              <div className="flex gap-3 mt-2">
                <div className="h-3 bg-slate-200 rounded w-16" />
                <div className="h-3 bg-slate-200 rounded w-20" />
              </div>
            </div>
          ))}
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

          {hasMore && activeFilter !== "LOW_STOCK" && (
            <Button variant="outline" className="w-full" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Loading...</> : `Load More (${(total - products.length).toLocaleString("en-IN")} remaining)`}
            </Button>
          )}
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
