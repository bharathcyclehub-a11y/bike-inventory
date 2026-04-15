"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Search, MapPin, Loader2, SlidersHorizontal, ChevronDown, RefreshCw } from "lucide-react";
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
  { header: "Size", key: "size" },
  { header: "Stock", key: "currentStock" },
  { header: "Reorder Level", key: "reorderLevel" },
  { header: "Bin", key: "bin.code" },
];

interface ProductItem {
  id: string;
  sku: string;
  name: string;
  type: string;
  size: string | null;
  status: string;
  currentStock: number;
  reorderLevel: number;
  category: { name: string } | null;
  brand: { id: string; name: string } | null;
  bin: { code: string; location: string } | null;
}

interface BrandItem { id: string; name: string; _count: { products: number }; }
interface BinItem { id: string; code: string; name: string; location: string; _count: { products: number }; }

type QuickFilter = "ALL" | "BICYCLES" | "SPARES" | "ACCESSORIES" | "LOW_STOCK" | "INACTIVE";

const QUICK_CHIPS: { key: QuickFilter; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "BICYCLES", label: "Bicycles" },
  { key: "SPARES", label: "Spares" },
  { key: "ACCESSORIES", label: "Accessories" },
  { key: "LOW_STOCK", label: "Low Stock" },
  { key: "INACTIVE", label: "Inactive" },
];

const BICYCLE_SIZES = ['12"', '14"', '16"', '20"', '24"', '26"', '27.5"', '29"'];

const PAGE_SIZE = 100;
const REFRESH_INTERVAL = 120_000; // 2 minutes

function getStockColor(p: ProductItem) {
  if (p.currentStock <= 0) return "text-red-600";
  if (p.reorderLevel > 0 && p.currentStock <= p.reorderLevel) return "text-yellow-600";
  return "text-green-600";
}

function getStockBadge(p: ProductItem) {
  if (p.currentStock <= 0) return { variant: "danger" as const, label: "Out" };
  if (p.reorderLevel > 0 && p.currentStock <= p.reorderLevel) return { variant: "warning" as const, label: "Low" };
  return { variant: "success" as const, label: "OK" };
}

export default function StockPage() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("ALL");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedBin, setSelectedBin] = useState("");
  const [brands, setBrands] = useState<BrandItem[]>([]);
  const [bins, setBins] = useState<BinItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch brands + categories + bins once
  useEffect(() => {
    Promise.all([
      fetch("/api/brands").then((r) => r.json()),
      fetch("/api/bins").then((r) => r.json()),
    ]).then(([brandsRes, binsRes]) => {
      if (brandsRes.success) setBrands(brandsRes.data);
      if (binsRes.success) setBins(binsRes.data);
    }).catch(() => {});
  }, []);

  const activeFilterCount = [selectedBrand, selectedSize, selectedBin].filter(Boolean).length;

  const buildParams = useCallback((pageNum: number) => {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), page: String(pageNum), sortBy: "currentStock", sortOrder: "desc" });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (quickFilter === "BICYCLES") { params.set("type", "BICYCLE"); params.set("status", "ACTIVE"); }
    else if (quickFilter === "SPARES") { params.set("type", "SPARE_PART"); params.set("status", "ACTIVE"); }
    else if (quickFilter === "ACCESSORIES") { params.set("type", "ACCESSORY"); params.set("status", "ACTIVE"); }
    else if (quickFilter === "INACTIVE") { params.set("status", "INACTIVE"); }
    else if (quickFilter === "ALL" || quickFilter === "LOW_STOCK") { params.set("status", "ACTIVE"); }
    if (selectedBrand) params.set("brandId", selectedBrand);
    if (selectedSize) params.set("size", selectedSize);
    if (selectedBin) params.set("binId", selectedBin);
    return params;
  }, [debouncedSearch, quickFilter, selectedBrand, selectedSize, selectedBin]);

  const fetchProducts = useCallback((pageNum: number, append = false, silent = false) => {
    if (!silent) { if (append) setLoadingMore(true); else setLoading(true); }
    else setRefreshing(true);

    const params = buildParams(pageNum);
    fetch(`/api/products?${params}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          if (append) setProducts((prev) => [...prev, ...res.data]);
          else setProducts(res.data);
          setTotal(res.pagination?.total || 0);
          setHasMore(res.pagination?.hasMore || false);
          setLastUpdated(new Date());
        }
      })
      .catch(() => {})
      .finally(() => {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      });
  }, [buildParams]);

  // Reset and fetch page 1 when filters/search change
  useEffect(() => {
    setPage(1);
    fetchProducts(1);
  }, [fetchProducts]);

  // Auto-refresh every 30 seconds (silent refresh, no loading spinner)
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      fetchProducts(1, false, true);
    }, REFRESH_INTERVAL);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchProducts]);

  function loadMore() {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchProducts(nextPage, true);
  }

  function clearFilters() {
    setSelectedBrand("");
    setSelectedSize("");
    setSelectedBin("");
  }

  const filtered = quickFilter === "LOW_STOCK"
    ? products.filter((p) => p.reorderLevel > 0 && p.currentStock <= p.reorderLevel)
    : products;

  const secondsAgo = Math.round((Date.now() - lastUpdated.getTime()) / 1000);

  // Show size filter only when filtering bicycles
  const showSizeFilter = quickFilter === "BICYCLES" || quickFilter === "ALL";

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-bold text-slate-900">Stock</h1>
        <div className="flex items-center gap-2">
          <ExportButtons
            onExcel={() => exportToExcel(filtered as unknown as Record<string, unknown>[], STOCK_COLUMNS, "stock-inventory")}
            onPDF={() => exportToPDF("Stock Inventory", filtered as unknown as Record<string, unknown>[], STOCK_COLUMNS, "stock-inventory")}
          />
        </div>
      </div>

      {/* Quick Views */}
      <div className="flex gap-2 mb-3">
        <Link href="/stock/by-brand"
          className="flex-1 flex items-center justify-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-700 py-2 rounded-lg text-xs font-medium">
          By Brand
        </Link>
        <Link href="/stock/by-bin"
          className="flex-1 flex items-center justify-center gap-1.5 bg-purple-50 border border-purple-200 text-purple-700 py-2 rounded-lg text-xs font-medium">
          <MapPin className="h-3 w-3" /> By Bin
        </Link>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search product, SKU, or brand..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Filter toggle + Quick chips row */}
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
            showFilters || activeFilterCount > 0
              ? "bg-slate-900 text-white border-slate-900"
              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
          }`}
        >
          <SlidersHorizontal className="h-3 w-3" />
          Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
          <ChevronDown className={`h-3 w-3 transition-transform ${showFilters ? "rotate-180" : ""}`} />
        </button>

        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
          {QUICK_CHIPS.map((chip) => (
            <button
              key={chip.key}
              onClick={() => setQuickFilter(chip.key)}
              className={`shrink-0 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
                quickFilter === chip.key
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* Collapsible filter panel */}
      {showFilters && (
        <Card className="mb-3 border-slate-200">
          <CardContent className="p-3 space-y-2.5">
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Brand</label>
                <select
                  value={selectedBrand}
                  onChange={(e) => setSelectedBrand(e.target.value)}
                  className="mt-0.5 flex h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="">All Brands ({brands.length})</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>{b.name} ({b._count.products})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Bin / Location</label>
                <select
                  value={selectedBin}
                  onChange={(e) => setSelectedBin(e.target.value)}
                  className="mt-0.5 flex h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="">All Bins ({bins.length})</option>
                  {bins.map((b) => (
                    <option key={b.id} value={b.id}>{b.name} ({b._count.products})</option>
                  ))}
                </select>
              </div>
            </div>

            {showSizeFilter && (
              <div>
                <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Size (Bicycles)</label>
                <select
                  value={selectedSize}
                  onChange={(e) => setSelectedSize(e.target.value)}
                  className="mt-0.5 flex h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="">All Sizes</option>
                  {BICYCLE_SIZES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            )}

            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="text-xs text-red-500 font-medium">
                Clear all filters
              </button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Status bar */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-slate-500">
          {quickFilter === "LOW_STOCK"
            ? `${filtered.length} low stock items`
            : `${filtered.length} of ${total.toLocaleString("en-IN")} products`}
        </p>
        <div className="flex items-center gap-1 text-[10px] text-slate-400">
          <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
          {secondsAgo < 5 ? "Just now" : `${secondsAgo}s ago`}
        </div>
      </div>

      {/* Product list */}
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
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => {
            const badge = getStockBadge(p);
            return (
              <Link key={p.id} href={`/stock/${p.id}`}>
                <Card className="hover:border-slate-300 transition-colors mb-2">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0 mr-3">
                        <p className="text-sm font-medium text-slate-900">{p.name}</p>
                        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                          <span className="text-xs text-slate-400">{p.sku}</span>
                          {p.brand && (
                            <span className="text-xs font-medium text-blue-600">{p.brand.name}</span>
                          )}
                          {p.category && (
                            <span className="text-xs text-slate-400">{p.category.name}</span>
                          )}
                          {p.size && (
                            <Badge variant="default" className="text-[9px] py-0">{p.size}</Badge>
                          )}
                        </div>
                        {p.bin && (
                          <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-0.5">
                            <MapPin className="h-3 w-3" />{p.bin.code} — {p.bin.location}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-xl font-bold ${getStockColor(p)}`}>{p.currentStock}</p>
                        <Badge variant={badge.variant} className="text-[10px]">{badge.label}</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}

          {hasMore && quickFilter !== "LOW_STOCK" && (
            <Button variant="outline" className="w-full" onClick={loadMore} disabled={loadingMore}>
              {loadingMore
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Loading...</>
                : `Load More (${(total - products.length).toLocaleString("en-IN")} remaining)`}
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
