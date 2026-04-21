"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Wrench, Phone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface ServiceInvoice {
  id: string;
  invoiceNo: string;
  invoiceDate: string;
  invoiceAmount: number;
  customerName: string;
  customerPhone: string | null;
  lineItems: Array<{ name: string; quantity: number; rate?: number }> | null;
  salesPerson: string | null;
}

interface DailyBreakdown {
  date: string;
  total: number;
  count: number;
  invoices: ServiceInvoice[];
}

function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

export default function ServiceRevenuePage() {
  const [loading, setLoading] = useState(true);
  const [grandTotal, setGrandTotal] = useState(0);
  const [totalInvoices, setTotalInvoices] = useState(0);
  const [dailyBreakdown, setDailyBreakdown] = useState<DailyBreakdown[]>([]);
  const [days, setDays] = useState(30);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/deliveries/service-revenue?days=${days}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setGrandTotal(res.data.grandTotal);
          setTotalInvoices(res.data.totalInvoices);
          setDailyBreakdown(res.data.dailyBreakdown);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [days]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Link href="/more" className="p-1"><ArrowLeft className="h-5 w-5 text-slate-600" /></Link>
        <div>
          <h1 className="text-lg font-bold text-slate-900">Service Revenue</h1>
          <p className="text-xs text-slate-500">Service invoice earnings</p>
        </div>
      </div>

      {/* Period selector */}
      <div className="flex gap-2 mb-3">
        {[7, 15, 30, 90].map((d) => (
          <button key={d} onClick={() => setDays(d)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              days === d ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
            }`}>
            {d}d
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Card className="bg-amber-50 border-amber-200">
              <CardContent className="p-3 text-center">
                <p className="text-xl font-bold text-amber-700">{formatINR(grandTotal)}</p>
                <p className="text-[10px] text-amber-600">Total Service Revenue</p>
              </CardContent>
            </Card>
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-3 text-center">
                <p className="text-xl font-bold text-blue-700">{totalInvoices}</p>
                <p className="text-[10px] text-blue-600">Service Invoices</p>
              </CardContent>
            </Card>
          </div>

          {dailyBreakdown.length === 0 ? (
            <div className="text-center py-12">
              <Wrench className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No service invoices in this period</p>
            </div>
          ) : (
            <div className="space-y-2">
              {dailyBreakdown.map((day) => (
                <div key={day.date}>
                  <button onClick={() => setExpandedDate(expandedDate === day.date ? null : day.date)}
                    className="w-full">
                    <Card className={expandedDate === day.date ? "border-amber-300 bg-amber-50/30" : ""}>
                      <CardContent className="p-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{formatDate(day.date)}</p>
                          <p className="text-[10px] text-slate-500">{day.count} invoice{day.count !== 1 ? "s" : ""}</p>
                        </div>
                        <p className="text-sm font-bold text-amber-700">{formatINR(day.total)}</p>
                      </CardContent>
                    </Card>
                  </button>

                  {expandedDate === day.date && (
                    <div className="ml-3 mt-1 space-y-1 mb-2">
                      {day.invoices.map((inv) => (
                        <Card key={inv.id} className="border-slate-200">
                          <CardContent className="p-2.5">
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0 mr-2">
                                <p className="text-xs font-medium text-slate-900">{inv.invoiceNo}</p>
                                <p className="text-[10px] text-slate-600">{inv.customerName}</p>
                                {inv.lineItems && inv.lineItems.length > 0 && (
                                  <p className="text-[10px] text-slate-500 mt-0.5">
                                    {inv.lineItems.map((li) => li.name).join(", ")}
                                  </p>
                                )}
                                {inv.salesPerson && (
                                  <p className="text-[10px] text-purple-500">Sales: {inv.salesPerson}</p>
                                )}
                              </div>
                              <div className="text-right">
                                <p className="text-xs font-semibold text-amber-700">{formatINR(inv.invoiceAmount)}</p>
                                {inv.customerPhone && (
                                  <a href={`https://wa.me/91${inv.customerPhone.replace(/\D/g, "").slice(-10)}`}
                                    target="_blank" rel="noopener noreferrer"
                                    className="inline-block mt-1">
                                    <Phone className="h-3 w-3 text-green-500" />
                                  </a>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
