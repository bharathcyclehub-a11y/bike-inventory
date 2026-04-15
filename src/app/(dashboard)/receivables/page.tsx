"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { FileText, AlertTriangle, Search, Plus, IndianRupee } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/lib/utils";

interface InvoiceItem {
  id: string;
  invoiceNo: string;
  amount: number;
  paidAmount: number;
  status: string;
  invoiceDate: string;
  dueDate: string;
  customer: { name: string; phone?: string };
}

const STATUS_FILTERS = ["ALL", "OVERDUE", "PENDING", "PARTIALLY_PAID", "PAID"];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}

export default function ReceivablesPage() {
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);

  // Summary stats
  const totalOutstanding = invoices.reduce((sum, inv) => sum + Math.max(0, inv.amount - inv.paidAmount), 0);
  const overdueCount = invoices.filter(
    (inv) => new Date(inv.dueDate) < new Date() && inv.amount - inv.paidAmount > 0
  ).length;

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "50" });
    if (filter === "OVERDUE") {
      params.set("overdue", "true");
    } else if (filter !== "ALL") {
      params.set("status", filter);
    }
    if (debouncedSearch.length >= 2) params.set("search", debouncedSearch);

    fetch(`/api/customer-invoices?${params}`)
      .then((r) => r.json())
      .then((res) => { if (res.success) setInvoices(res.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filter, debouncedSearch]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-bold text-slate-900">Receivables</h1>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <IndianRupee className="h-4 w-4 text-red-500" />
              <span className="text-xs text-slate-500">Total Outstanding</span>
            </div>
            <p className="text-lg font-bold text-red-600">{formatCurrency(totalOutstanding)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="text-xs text-slate-500">Overdue</span>
            </div>
            <p className="text-lg font-bold text-amber-600">{overdueCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search invoice or customer..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Status Filters */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-4 pb-1">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === s ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {s === "ALL" ? "All" : s.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {/* Invoice List */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-3 border border-slate-100 rounded-lg animate-pulse">
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 bg-slate-200 rounded w-3/4" />
                  <div className="h-3 bg-slate-200 rounded w-1/2" />
                </div>
                <div className="text-right space-y-1.5">
                  <div className="h-4 bg-slate-200 rounded w-16 ml-auto" />
                  <div className="h-5 w-14 bg-slate-200 rounded-full ml-auto" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {invoices.map((inv) => {
            const remaining = inv.amount - inv.paidAmount;
            const isOverdue = new Date(inv.dueDate) < new Date() && remaining > 0;
            return (
              <Link key={inv.id} href={`/receivables/${inv.id}`}>
                <Card className={`hover:border-slate-300 transition-colors mb-2 ${isOverdue ? "border-red-200 bg-red-50/30" : ""}`}>
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0 mr-3">
                        <div className="flex items-center gap-2">
                          {isOverdue && <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                          <p className="text-sm font-medium text-slate-900">{inv.customer.name}</p>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {inv.invoiceNo} | Due: {new Date(inv.dueDate).toLocaleDateString("en-IN")}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-bold ${remaining > 0 ? "text-red-600" : "text-green-600"}`}>
                          {formatCurrency(remaining)}
                        </p>
                        <Badge variant={inv.status === "PAID" ? "success" : isOverdue ? "danger" : "warning"} className="text-[10px]">
                          {isOverdue ? "OVERDUE" : inv.status.replace(/_/g, " ")}
                        </Badge>
                      </div>
                    </div>
                    {inv.paidAmount > 0 && remaining > 0 && (
                      <div className="mt-2">
                        <div className="w-full bg-slate-200 rounded-full h-1.5">
                          <div
                            className="bg-green-500 h-1.5 rounded-full"
                            style={{ width: `${Math.min(100, (inv.paidAmount / inv.amount) * 100)}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Paid {formatCurrency(inv.paidAmount)} of {formatCurrency(inv.amount)}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}

          {invoices.length === 0 && (
            <div className="text-center py-12">
              <FileText className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No invoices found</p>
            </div>
          )}
        </div>
      )}

      {/* Floating Action Button */}
      <Link
        href="/receivables/new"
        className="fixed bottom-20 right-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-3.5 shadow-lg z-50"
      >
        <Plus className="h-5 w-5" />
      </Link>
    </div>
  );
}
