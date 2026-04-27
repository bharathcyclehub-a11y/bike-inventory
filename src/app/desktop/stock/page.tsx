"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Package } from "lucide-react";
import { DataTable, type Column } from "@/components/desktop/data-table";
import { Badge } from "@/components/ui/badge";

interface Product {
  id: string;
  name: string;
  sku: string | null;
  currentStock: number;
  costPrice: number;
  sellingPrice: number;
  status: string;
  brand: { name: string } | null;
  category: { name: string } | null;
  bin: { label: string; location: string } | null;
}

function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

export default function DesktopStockPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState<"all" | "low" | "negative" | "zero">("all");

  const fetchData = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "500" });
    if (search) params.set("search", search);
    fetch(`/api/products?${params}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setProducts(res.data);
      })
      .finally(() => setLoading(false));
  }, [search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = products.filter((p) => {
    if (stockFilter === "low") return p.currentStock > 0 && p.currentStock <= 5;
    if (stockFilter === "negative") return p.currentStock < 0;
    if (stockFilter === "zero") return p.currentStock === 0;
    return true;
  });

  const columns: Column<Product>[] = [
    {
      key: "name",
      label: "Product",
      sortable: true,
      sortValue: (r) => r.name,
      render: (r) => (
        <div>
          <p className="font-medium text-slate-900 max-w-[280px] truncate">{r.name}</p>
          {r.sku && <p className="text-[11px] text-slate-400 font-mono">{r.sku}</p>}
        </div>
      ),
    },
    {
      key: "brand",
      label: "Brand",
      sortable: true,
      sortValue: (r) => r.brand?.name || "",
      render: (r) => r.brand ? <span className="text-slate-700">{r.brand.name}</span> : <span className="text-slate-300">—</span>,
    },
    {
      key: "category",
      label: "Category",
      render: (r) => r.category ? <span className="text-slate-600 text-xs">{r.category.name}</span> : <span className="text-slate-300">—</span>,
    },
    {
      key: "stock",
      label: "Stock",
      sortable: true,
      className: "text-right",
      sortValue: (r) => r.currentStock,
      render: (r) => (
        <span className={`font-semibold ${r.currentStock < 0 ? "text-red-600" : r.currentStock === 0 ? "text-slate-400" : r.currentStock <= 5 ? "text-amber-600" : "text-slate-900"}`}>
          {r.currentStock}
        </span>
      ),
    },
    {
      key: "costPrice",
      label: "Cost",
      sortable: true,
      className: "text-right",
      sortValue: (r) => r.costPrice,
      render: (r) => <span className="text-slate-600">{formatINR(r.costPrice)}</span>,
    },
    {
      key: "sellingPrice",
      label: "Selling",
      sortable: true,
      className: "text-right",
      sortValue: (r) => r.sellingPrice,
      render: (r) => <span className="text-slate-700 font-medium">{formatINR(r.sellingPrice)}</span>,
    },
    {
      key: "bin",
      label: "Bin",
      render: (r) => r.bin ? (
        <div>
          <p className="text-xs font-medium text-slate-700">{r.bin.label}</p>
          <p className="text-[10px] text-slate-400">{r.bin.location}</p>
        </div>
      ) : <span className="text-slate-300">—</span>,
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      sortValue: (r) => r.status,
      render: (r) => (
        <Badge variant={r.status === "ACTIVE" ? "success" : "default"}>
          {r.status === "ACTIVE" ? "Active" : r.status.toLowerCase()}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Package className="h-5 w-5 text-slate-700" />
          <h1 className="text-xl font-bold text-slate-900">Stock</h1>
          <span className="text-sm text-slate-400">{filtered.length} items</span>
        </div>
        <input
          type="text"
          placeholder="Search product, SKU..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-slate-300"
        />
      </div>

      <div className="flex gap-2">
        {(["all", "low", "zero", "negative"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setStockFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              stockFilter === f ? "bg-slate-900 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            {f === "all" ? "All" : f === "low" ? "Low (≤5)" : f === "zero" ? "Zero" : "Negative"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      ) : (
        <DataTable
          data={filtered}
          columns={columns}
          keyExtractor={(r) => r.id}
          onRowClick={(r) => router.push(`/desktop/stock/${r.id}`)}
          emptyMessage="No products found"
          pageSize={50}
        />
      )}
    </div>
  );
}
