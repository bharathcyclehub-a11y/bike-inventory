"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { TransactionItem } from "@/components/transaction-item";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ExportButtons } from "@/components/export-buttons";
import { exportToExcel, exportToPDF, type ExportColumn } from "@/lib/export";

const OUTWARD_COLUMNS: ExportColumn[] = [
  { header: "Product", key: "product.name" },
  { header: "SKU", key: "product.sku" },
  { header: "Quantity", key: "quantity" },
  { header: "Reference No", key: "referenceNo" },
  { header: "Recorded By", key: "user.name" },
  { header: "Date/Time", key: "createdAt", format: (v) => new Date(String(v)).toLocaleString("en-IN") },
];

interface OutwardTransaction {
  id: string;
  quantity: number;
  referenceNo: string | null;
  createdAt: string;
  product: { name: string; sku: string };
  user: { name: string };
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export default function OutwardsPage() {
  const [outwards, setOutwards] = useState<OutwardTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    fetch(`/api/inventory/outwards?dateFrom=${today}&limit=50`)
      .then((r) => r.json())
      .then((res) => { if (res.success) setOutwards(res.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalQty = outwards.reduce((sum, t) => sum + t.quantity, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Outwards</h1>
          <p className="text-sm text-slate-500">{outwards.length} entries | {totalQty} units today</p>
        </div>
        <ExportButtons
          onExcel={() => exportToExcel(outwards as unknown as Record<string, unknown>[], OUTWARD_COLUMNS, "outwards")}
          onPDF={() => exportToPDF("Outwards Report", outwards as unknown as Record<string, unknown>[], OUTWARD_COLUMNS, "outwards")}
        />
      </div>

      <Card>
        <CardHeader><CardTitle>Today&apos;s Outwards</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <div className="h-5 w-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : outwards.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">No outwards recorded today</p>
          ) : (
            outwards.map((t) => (
              <TransactionItem
                key={t.id}
                direction="out"
                productName={t.product.name}
                sku={t.product.sku}
                quantity={t.quantity}
                time={formatTime(t.createdAt)}
                reference={t.referenceNo || undefined}
              />
            ))
          )}
        </CardContent>
      </Card>

      <Link
        href="/outwards/new"
        className="fixed bottom-20 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-orange-500 text-white shadow-lg hover:bg-orange-600 active:scale-95 transition-transform"
      >
        <Plus className="h-6 w-6" />
      </Link>
    </div>
  );
}
