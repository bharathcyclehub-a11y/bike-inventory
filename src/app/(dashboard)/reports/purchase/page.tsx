"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface PurchaseData {
  totalOrders: number;
  totalAmount: number;
  vendors: Array<{ name: string; code: string; orderCount: number; totalAmount: number; pendingAmount: number }>;
}

function fmt(amount: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}

export default function PurchaseReportPage() {
  const [data, setData] = useState<PurchaseData | null>(null);
  const [loading, setLoading] = useState(true);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
  const today = new Date().toISOString().split("T")[0];
  const [dateFrom, setDateFrom] = useState(thirtyDaysAgo);
  const [dateTo, setDateTo] = useState(today);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports/purchase?dateFrom=${dateFrom}&dateTo=${dateTo}`)
      .then((r) => r.json())
      .then((res) => { if (res.success) setData(res.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [dateFrom, dateTo]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Link href="/reports" className="p-1"><ArrowLeft className="h-5 w-5 text-slate-600" /></Link>
        <h1 className="text-lg font-bold text-slate-900">Purchase Report</h1>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div><label className="text-xs text-slate-500">From</label><Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></div>
        <div><label className="text-xs text-slate-500">To</label><Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></div>
      </div>

      {data && (
        <div className="grid grid-cols-2 gap-2 mb-4">
          <Card><CardContent className="p-3">
            <p className="text-xs text-slate-500">Total Orders</p>
            <p className="text-lg font-bold text-slate-900">{data.totalOrders}</p>
          </CardContent></Card>
          <Card className="bg-purple-50 border-purple-200"><CardContent className="p-3">
            <p className="text-xs text-purple-600">Total Amount</p>
            <p className="text-lg font-bold text-purple-700">{fmt(data.totalAmount)}</p>
          </CardContent></Card>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {data?.vendors.map((v, i) => (
            <Card key={i}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{v.name}</p>
                    <p className="text-xs text-slate-500">{v.code} | {v.orderCount} orders</p>
                  </div>
                  <p className="text-sm font-bold text-slate-900">{fmt(v.totalAmount)}</p>
                </div>
                {v.pendingAmount > 0 && (
                  <p className="text-xs text-amber-600">Pending: {fmt(v.pendingAmount)}</p>
                )}
              </CardContent>
            </Card>
          ))}
          {data?.vendors.length === 0 && <p className="text-sm text-slate-400 text-center py-8">No purchase data</p>}
        </div>
      )}
    </div>
  );
}
