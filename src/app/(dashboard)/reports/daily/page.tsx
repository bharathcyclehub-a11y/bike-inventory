"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowDownCircle, ArrowUpCircle, CreditCard, Receipt } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface DailyData {
  date: string;
  inwards: { count: number; totalQty: number };
  outwards: { count: number; totalQty: number };
  payments: { count: number; totalAmount: number };
  expenses: { count: number; totalAmount: number };
  recentTransactions: Array<{
    id: string; type: string; quantity: number; createdAt: string;
    product: { name: string; sku: string };
    user: { name: string };
  }>;
}

function fmt(amount: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}

export default function DailyReportPage() {
  const [data, setData] = useState<DailyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports/daily?date=${date}`)
      .then((r) => r.json())
      .then((res) => { if (res.success) setData(res.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [date]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Link href="/reports" className="p-1"><ArrowLeft className="h-5 w-5 text-slate-600" /></Link>
        <h1 className="text-lg font-bold text-slate-900">Daily Activity</h1>
      </div>

      <div className="mb-4">
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : data && (
        <>
          <div className="grid grid-cols-2 gap-2 mb-4">
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <ArrowDownCircle className="h-4 w-4 text-blue-600" />
                  <span className="text-xs text-blue-600 font-medium">Inwards</span>
                </div>
                <p className="text-lg font-bold text-blue-700">{data.inwards.totalQty} units</p>
                <p className="text-[10px] text-blue-500">{data.inwards.count} transactions</p>
              </CardContent>
            </Card>

            <Card className="bg-orange-50 border-orange-200">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <ArrowUpCircle className="h-4 w-4 text-orange-600" />
                  <span className="text-xs text-orange-600 font-medium">Outwards</span>
                </div>
                <p className="text-lg font-bold text-orange-700">{data.outwards.totalQty} units</p>
                <p className="text-[10px] text-orange-500">{data.outwards.count} transactions</p>
              </CardContent>
            </Card>

            <Card className="bg-green-50 border-green-200">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <CreditCard className="h-4 w-4 text-green-600" />
                  <span className="text-xs text-green-600 font-medium">Payments</span>
                </div>
                <p className="text-lg font-bold text-green-700">{fmt(data.payments.totalAmount)}</p>
                <p className="text-[10px] text-green-500">{data.payments.count} payments</p>
              </CardContent>
            </Card>

            <Card className="bg-red-50 border-red-200">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Receipt className="h-4 w-4 text-red-600" />
                  <span className="text-xs text-red-600 font-medium">Expenses</span>
                </div>
                <p className="text-lg font-bold text-red-700">{fmt(data.expenses.totalAmount)}</p>
                <p className="text-[10px] text-red-500">{data.expenses.count} entries</p>
              </CardContent>
            </Card>
          </div>

          {data.recentTransactions.length > 0 && (
            <>
              <h2 className="text-sm font-semibold text-slate-900 mb-2">Transactions</h2>
              <div className="space-y-2">
                {data.recentTransactions.map((t) => (
                  <Card key={t.id} className="mb-2">
                    <CardContent className="p-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{t.product.name}</p>
                        <p className="text-xs text-slate-500">{t.product.sku} | By: {t.user.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-slate-900">{t.quantity}</p>
                        <Badge variant={t.type === "INWARD" ? "info" : "warning"}>{t.type}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
