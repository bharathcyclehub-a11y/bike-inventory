"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { exportToExcel, type ExportColumn } from "@/lib/export";

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
    type: string;
    category: { name: string } | null;
    brand: { name: string } | null;
    bin: { code: string; location: string } | null;
  };
}

interface StockCountData {
  id: string;
  title: string;
  status: string;
  dueDate: string;
  completedAt: string | null;
  notes: string | null;
  assignedTo: { name: string };
  bin: { code: string; name: string; location: string } | null;
  totalItems: number;
  countedItems: number;
  totalVariance: number;
  itemsWithVariance: number;
}

const EXPORT_COLS: ExportColumn[] = [
  { header: "SKU", key: "sku" },
  { header: "Product", key: "name" },
  { header: "Brand", key: "brand" },
  { header: "System Qty", key: "systemQty" },
  { header: "Counted Qty", key: "countedQty" },
  { header: "Variance", key: "variance" },
  { header: "Bin", key: "bin" },
];

export default function StockCountReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<StockCountData | null>(null);
  const [items, setItems] = useState<StockCountItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"all" | "counted" | "variance">("counted");

  useEffect(() => {
    Promise.all([
      fetch(`/api/stock-counts/${id}`).then((r) => r.json()),
      fetch(`/api/stock-counts/${id}/items`).then((r) => r.json()),
    ]).then(([summaryRes, itemsRes]) => {
      if (summaryRes.success) setData(summaryRes.data);
      if (itemsRes.success) setItems(itemsRes.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Stock count not found</p>
        <Link href="/stock-audit" className="text-blue-600 text-sm mt-2 inline-block">Back</Link>
      </div>
    );
  }

  const filtered = tab === "counted"
    ? items.filter((i) => i.countedQty !== null)
    : tab === "variance"
    ? items.filter((i) => i.variance !== null && i.variance !== 0)
    : items;

  const exportData = filtered.map((i) => ({
    sku: i.product.sku,
    name: i.product.name,
    brand: i.product.brand?.name || "—",
    systemQty: i.systemQty,
    countedQty: i.countedQty ?? "—",
    variance: i.variance ?? "—",
    bin: i.product.bin?.code || "—",
  }));

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <Link href={`/stock-audit/${id}`} className="p-1"><ArrowLeft className="h-5 w-5 text-slate-600" /></Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-slate-900 truncate">{data.title}</h1>
          <p className="text-xs text-slate-500">
            {data.assignedTo.name} | {data.bin?.name} ({data.bin?.location})
            {data.completedAt && ` | Completed: ${new Date(data.completedAt).toLocaleDateString("en-IN")}`}
          </p>
        </div>
        <Badge variant={data.status === "COMPLETED" ? "success" : "info"}>
          {data.status === "COMPLETED" ? "Completed" : data.status}
        </Badge>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        <Card><CardContent className="p-2 text-center">
          <p className="text-lg font-bold text-slate-900">{data.totalItems}</p>
          <p className="text-[10px] text-slate-500">Total</p>
        </CardContent></Card>
        <Card><CardContent className="p-2 text-center">
          <p className="text-lg font-bold text-blue-600">{data.countedItems}</p>
          <p className="text-[10px] text-slate-500">Counted</p>
        </CardContent></Card>
        <Card><CardContent className="p-2 text-center">
          <p className="text-lg font-bold text-yellow-600">{data.itemsWithVariance}</p>
          <p className="text-[10px] text-slate-500">Variance</p>
        </CardContent></Card>
        <Card><CardContent className="p-2 text-center">
          <p className={`text-lg font-bold ${data.totalVariance === 0 ? "text-green-600" : "text-red-600"}`}>
            {data.totalVariance > 0 ? "+" : ""}{data.totalVariance}
          </p>
          <p className="text-[10px] text-slate-500">Net</p>
        </CardContent></Card>
      </div>

      {/* Tabs + Export */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex gap-1.5">
          {(["counted", "variance", "all"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium ${tab === t ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}>
              {t === "counted" ? `Counted (${items.filter((i) => i.countedQty !== null).length})`
                : t === "variance" ? `Variance (${items.filter((i) => i.variance && i.variance !== 0).length})`
                : `All (${items.length})`}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => exportToExcel(exportData as unknown as Record<string, unknown>[], EXPORT_COLS, data.title)}>
          <Download className="h-3.5 w-3.5 mr-1" /> Excel
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-xs">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left p-2 font-medium text-slate-600">#</th>
              <th className="text-left p-2 font-medium text-slate-600">Product</th>
              <th className="text-left p-2 font-medium text-slate-600">Brand</th>
              <th className="text-right p-2 font-medium text-slate-600">System</th>
              <th className="text-right p-2 font-medium text-slate-600">Counted</th>
              <th className="text-right p-2 font-medium text-slate-600">Variance</th>
              <th className="text-left p-2 font-medium text-slate-600">Bin</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item, i) => (
              <tr key={item.id} className={`border-t border-slate-100 ${item.variance && item.variance !== 0 ? "bg-red-50" : ""}`}>
                <td className="p-2 text-slate-400">{i + 1}</td>
                <td className="p-2">
                  <p className="font-medium text-slate-900 truncate max-w-[180px]">{item.product.name}</p>
                  <p className="text-[10px] text-slate-400">{item.product.sku}</p>
                </td>
                <td className="p-2 text-slate-600">{item.product.brand?.name || "—"}</td>
                <td className="p-2 text-right font-medium">{item.systemQty}</td>
                <td className="p-2 text-right font-medium text-blue-600">{item.countedQty ?? "—"}</td>
                <td className={`p-2 text-right font-bold ${
                  item.variance === null || item.variance === 0 ? "text-green-600" :
                  item.variance > 0 ? "text-blue-600" : "text-red-600"
                }`}>
                  {item.variance === null ? "—" : item.variance > 0 ? `+${item.variance}` : item.variance}
                </td>
                <td className="p-2 text-slate-500">{item.product.bin?.code || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-6">No items in this view</p>
      )}
    </div>
  );
}
