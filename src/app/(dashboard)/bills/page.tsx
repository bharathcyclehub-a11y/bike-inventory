"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { FileText, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExportButtons } from "@/components/export-buttons";
import { exportToExcel, exportToPDF, type ExportColumn } from "@/lib/export";

const BILL_COLUMNS: ExportColumn[] = [
  { header: "Bill No", key: "billNo" },
  { header: "Vendor", key: "vendor.name" },
  { header: "Bill Date", key: "billDate", format: (v) => new Date(String(v)).toLocaleDateString("en-IN") },
  { header: "Due Date", key: "dueDate", format: (v) => new Date(String(v)).toLocaleDateString("en-IN") },
  { header: "Amount", key: "amount", format: (v) => `₹${Number(v || 0).toLocaleString("en-IN")}` },
  { header: "Paid", key: "paidAmount", format: (v) => `₹${Number(v || 0).toLocaleString("en-IN")}` },
  { header: "Balance", key: "amount", format: (_v, row) => `₹${(Number(row.amount || 0) - Number(row.paidAmount || 0)).toLocaleString("en-IN")}` },
  { header: "Status", key: "status", format: (v) => String(v).replace(/_/g, " ") },
];

interface BillItem {
  id: string;
  billNo: string;
  amount: number;
  paidAmount: number;
  status: string;
  dueDate: string;
  billDate: string;
  vendor: { name: string; code: string };
}

const STATUS_FILTERS = ["ALL", "OVERDUE", "PENDING", "PARTIALLY_PAID", "PAID"];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}

export default function BillsPage() {
  const [bills, setBills] = useState<BillItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");

  useEffect(() => {
    const params = new URLSearchParams({ limit: "50" });
    if (filter === "OVERDUE") {
      params.set("overdue", "true");
    } else if (filter !== "ALL") {
      params.set("status", filter);
    }

    fetch(`/api/bills?${params}`)
      .then((r) => r.json())
      .then((res) => { if (res.success) setBills(res.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filter]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-bold text-slate-900">Vendor Bills</h1>
        <ExportButtons
          onExcel={() => exportToExcel(bills as unknown as Record<string, unknown>[], BILL_COLUMNS, "vendor-bills")}
          onPDF={() => exportToPDF("Vendor Bills", bills as unknown as Record<string, unknown>[], BILL_COLUMNS, "vendor-bills")}
        />
      </div>

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

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {bills.map((bill) => {
            const remaining = bill.amount - bill.paidAmount;
            const isOverdue = new Date(bill.dueDate) < new Date() && remaining > 0;
            return (
              <Link key={bill.id} href={`/bills/${bill.id}`}>
                <Card className={`hover:border-slate-300 transition-colors mb-2 ${isOverdue ? "border-red-200 bg-red-50/30" : ""}`}>
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0 mr-3">
                        <div className="flex items-center gap-2">
                          {isOverdue && <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                          <p className="text-sm font-medium text-slate-900">{bill.vendor.name}</p>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {bill.billNo} | Due: {new Date(bill.dueDate).toLocaleDateString("en-IN")}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-bold ${remaining > 0 ? "text-red-600" : "text-green-600"}`}>
                          {formatCurrency(remaining)}
                        </p>
                        <Badge variant={bill.status === "PAID" ? "success" : isOverdue ? "danger" : "warning"} className="text-[10px]">
                          {isOverdue ? "OVERDUE" : bill.status.replace(/_/g, " ")}
                        </Badge>
                      </div>
                    </div>
                    {bill.paidAmount > 0 && remaining > 0 && (
                      <div className="mt-2">
                        <div className="w-full bg-slate-200 rounded-full h-1.5">
                          <div
                            className="bg-green-500 h-1.5 rounded-full"
                            style={{ width: `${Math.min(100, (bill.paidAmount / bill.amount) * 100)}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Paid {formatCurrency(bill.paidAmount)} of {formatCurrency(bill.amount)}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}

          {bills.length === 0 && (
            <div className="text-center py-12">
              <FileText className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No bills found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
