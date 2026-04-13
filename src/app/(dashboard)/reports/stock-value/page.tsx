"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface StockValueData {
  totalItems: number;
  totalProducts: number;
  totalCostValue: number;
  totalSellingValue: number;
  totalMrpValue: number;
  breakdown: Array<{ name: string; count: number; qty: number; costValue: number; sellingValue: number; mrpValue: number }>;
}

function fmt(amount: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}

const TABS = [
  { key: "category", label: "By Category" },
  { key: "brand", label: "By Brand" },
  { key: "type", label: "By Type" },
];

export default function StockValuePage() {
  const [data, setData] = useState<StockValueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("category");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports/stock-value?groupBy=${tab}`)
      .then((r) => r.json())
      .then((res) => { if (res.success) setData(res.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tab]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Link href="/reports" className="p-1"><ArrowLeft className="h-5 w-5 text-slate-600" /></Link>
        <h1 className="text-lg font-bold text-slate-900">Stock Value</h1>
      </div>

      {/* Summary */}
      {data && (
        <div className="grid grid-cols-2 gap-2 mb-4">
          <Card><CardContent className="p-3">
            <p className="text-xs text-slate-500">Total Items</p>
            <p className="text-lg font-bold text-slate-900">{data.totalItems.toLocaleString("en-IN")}</p>
          </CardContent></Card>
          <Card><CardContent className="p-3">
            <p className="text-xs text-slate-500">Products</p>
            <p className="text-lg font-bold text-slate-900">{data.totalProducts}</p>
          </CardContent></Card>
          <Card className="bg-blue-50 border-blue-200"><CardContent className="p-3">
            <p className="text-xs text-blue-600">Cost Value</p>
            <p className="text-lg font-bold text-blue-700">{fmt(data.totalCostValue)}</p>
          </CardContent></Card>
          <Card className="bg-green-50 border-green-200"><CardContent className="p-3">
            <p className="text-xs text-green-600">Selling Value</p>
            <p className="text-lg font-bold text-green-700">{fmt(data.totalSellingValue)}</p>
          </CardContent></Card>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-slate-100 rounded-lg p-1">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 text-xs font-medium py-2 rounded-md transition-colors ${tab === t.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {data?.breakdown.map((group, i) => (
            <Card key={i}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium text-slate-900">{group.name}</p>
                  <span className="text-xs text-slate-500">{group.count} products | {group.qty} units</span>
                </div>
                <div className="flex gap-4 text-xs">
                  <span className="text-blue-600">Cost: {fmt(group.costValue)}</span>
                  <span className="text-green-600">Sell: {fmt(group.sellingValue)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
          {data?.breakdown.length === 0 && <p className="text-sm text-slate-400 text-center py-8">No stock data</p>}
        </div>
      )}
    </div>
  );
}
