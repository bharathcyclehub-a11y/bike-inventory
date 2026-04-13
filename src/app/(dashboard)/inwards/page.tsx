"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { TransactionItem } from "@/components/transaction-item";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface InwardTransaction {
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

export default function InwardsPage() {
  const [inwards, setInwards] = useState<InwardTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    fetch(`/api/inventory/inwards?dateFrom=${today}&limit=50`)
      .then((r) => r.json())
      .then((res) => { if (res.success) setInwards(res.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalQty = inwards.reduce((sum, t) => sum + t.quantity, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Inwards</h1>
          <p className="text-sm text-slate-500">{inwards.length} entries | {totalQty} units today</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Today&apos;s Inwards</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <div className="h-5 w-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : inwards.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">No inwards recorded today</p>
          ) : (
            inwards.map((t) => (
              <TransactionItem
                key={t.id}
                direction="in"
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
        href="/inwards/new"
        className="fixed bottom-20 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 active:scale-95 transition-transform"
      >
        <Plus className="h-6 w-6" />
      </Link>
    </div>
  );
}
