"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExportButtons } from "@/components/export-buttons";
import { exportToExcel, exportToPDF, type ExportColumn } from "@/lib/export";

const PO_COLUMNS: ExportColumn[] = [
  { header: "PO Number", key: "poNumber" },
  { header: "Vendor", key: "vendor.name" },
  { header: "Status", key: "status", format: (v) => String(v).replace(/_/g, " ") },
  { header: "Order Date", key: "orderDate", format: (v) => new Date(String(v)).toLocaleDateString("en-IN") },
  { header: "Expected Date", key: "expectedDate", format: (v) => v ? new Date(String(v)).toLocaleDateString("en-IN") : "" },
  { header: "Items", key: "items", format: (v) => String((v as Array<{ quantity: number }>)?.reduce((s: number, i) => s + i.quantity, 0) || 0) },
  { header: "Grand Total", key: "grandTotal", format: (v) => `₹${Number(v || 0).toLocaleString("en-IN")}` },
  { header: "Created By", key: "createdBy.name" },
];

interface POItem {
  id: string;
  poNumber: string;
  status: string;
  grandTotal: number;
  orderDate: string;
  expectedDate?: string;
  vendor: { name: string; code: string };
  items: Array<{ quantity: number }>;
  createdBy: { name: string };
}

const STATUS_FILTERS = ["ALL", "DRAFT", "PENDING_APPROVAL", "APPROVED", "SENT_TO_VENDOR", "PARTIALLY_RECEIVED", "RECEIVED"];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}

function statusVariant(status: string) {
  switch (status) {
    case "DRAFT": return "default";
    case "APPROVED": case "RECEIVED": return "success";
    case "CANCELLED": return "danger";
    default: return "warning";
  }
}

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<POItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");

  useEffect(() => {
    const params = new URLSearchParams({ limit: "50" });
    if (statusFilter !== "ALL") params.set("status", statusFilter);

    fetch(`/api/purchase-orders?${params}`)
      .then((r) => r.json())
      .then((res) => { if (res.success) setOrders(res.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [statusFilter]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-bold text-slate-900">Purchase Orders</h1>
        <div className="flex items-center gap-2">
          <ExportButtons
            onExcel={() => exportToExcel(orders as unknown as Record<string, unknown>[], PO_COLUMNS, "purchase-orders")}
            onPDF={() => exportToPDF("Purchase Orders", orders as unknown as Record<string, unknown>[], PO_COLUMNS, "purchase-orders")}
          />
          <Link href="/purchase-orders/new">
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-1" /> New PO
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-4 pb-1">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              statusFilter === s ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
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
          {orders.map((po) => (
            <Link key={po.id} href={`/purchase-orders/${po.id}`}>
              <Card className="hover:border-slate-300 transition-colors mb-2">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0 mr-3">
                      <p className="text-sm font-medium text-slate-900">{po.poNumber}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {po.vendor.name} | {new Date(po.orderDate).toLocaleDateString("en-IN")}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {po.items.reduce((s, i) => s + i.quantity, 0)} items | By: {po.createdBy.name}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-slate-900">{formatCurrency(po.grandTotal)}</p>
                      <Badge variant={statusVariant(po.status)} className="text-[10px] mt-1">
                        {po.status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}

          {orders.length === 0 && (
            <div className="text-center py-12">
              <ShoppingCart className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No purchase orders found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
