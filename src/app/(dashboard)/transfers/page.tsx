"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Plus, ArrowRightLeft, ArrowRight, CheckCircle2, XCircle, Clock, Loader2, Package } from "lucide-react";
import { DateFilter, type DateRangeKey } from "@/components/date-filter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface TransferOrderItem {
  id: string;
  quantity: number;
  product: { name: string; sku: string; currentStock: number };
  fromBin: { code: string; name: string; location: string };
  toBin: { code: string; name: string; location: string };
}

interface TransferOrder {
  id: string;
  orderNo: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  notes: string | null;
  rejectionNote: string | null;
  createdAt: string;
  createdBy: { name: string };
  reviewedBy: { name: string } | null;
  reviewedAt: string | null;
  items: TransferOrderItem[];
  _count: { items: number };
}

type StatusFilter = "all" | "PENDING" | "APPROVED" | "REJECTED";

export default function TransfersPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role || "";
  const canApprove = ["ADMIN", "SUPERVISOR", "ACCOUNTS_MANAGER"].includes(role);
  const [orders, setOrders] = useState<TransferOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [approving, setApproving] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<DateRangeKey>("all");
  const [dateFrom, setDateFrom] = useState<string | undefined>();
  const [dateTo, setDateTo] = useState<string | undefined>();

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "50" });
    if (filter !== "all") params.set("status", filter);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);

    fetch(`/api/transfer-orders?${params}`)
      .then((r) => r.json())
      .then((res) => { if (res.success) setOrders(res.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filter, dateFrom, dateTo]);

  async function handleAction(id: string, action: "approve" | "reject") {
    setApproving(id);
    try {
      const res = await fetch(`/api/transfer-orders/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.success) {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === id ? { ...o, status: action === "approve" ? "APPROVED" : "REJECTED" } : o
          )
        );
      }
    } catch { /* ignore */ }
    finally { setApproving(null); }
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case "APPROVED": return <Badge variant="success"><CheckCircle2 className="h-3 w-3 mr-0.5" />Approved</Badge>;
      case "PENDING": return <Badge variant="warning"><Clock className="h-3 w-3 mr-0.5" />Pending</Badge>;
      case "REJECTED": return <Badge variant="danger"><XCircle className="h-3 w-3 mr-0.5" />Rejected</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Transfer Orders</h1>
          <p className="text-xs text-slate-500">Multi-item bin transfers</p>
        </div>
        <Link href="/transfers/new">
          <Button size="sm" className="bg-purple-600 hover:bg-purple-700">
            <Plus className="h-4 w-4 mr-1" /> New Order
          </Button>
        </Link>
      </div>

      <DateFilter
        value={dateFilter}
        onChange={(key, from, to) => { setDateFilter(key); setDateFrom(from); setDateTo(to); }}
        className="mb-2"
      />

      <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-3 pb-1">
        {(["all", "PENDING", "APPROVED", "REJECTED"] as StatusFilter[]).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === f ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}>
            {f === "all" ? "All" : f === "PENDING" ? "Pending" : f === "APPROVED" ? "Approved" : "Rejected"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-3 border border-slate-100 rounded-lg animate-pulse">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 space-y-1.5"><div className="h-4 bg-slate-200 rounded w-3/4" /><div className="h-3 bg-slate-200 rounded w-1/2" /></div>
                <div className="h-5 w-16 bg-slate-200 rounded-full" />
              </div>
              <div className="h-10 bg-slate-100 rounded-lg" />
            </div>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12">
          <ArrowRightLeft className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400">No transfer orders found</p>
          <Link href="/transfers/new">
            <Button variant="outline" size="sm" className="mt-3">Create First Transfer</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((order) => (
            <Card key={order.id} className="overflow-hidden">
              <CardContent className="p-3">
                {/* Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0 mr-2">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">{order.orderNo}</p>
                      {statusBadge(order.status)}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {order._count.items} item{order._count.items !== 1 ? "s" : ""} | By {order.createdBy.name} | {new Date(order.createdAt).toLocaleDateString("en-IN")}
                    </p>
                  </div>
                </div>

                {/* Compact item preview (first 2 items) */}
                <div className="space-y-1 mb-2">
                  {order.items.slice(0, expandedId === order.id ? undefined : 2).map((item) => (
                    <div key={item.id} className="bg-slate-50 rounded-lg px-2.5 py-1.5 flex items-center gap-2">
                      <Package className="h-3 w-3 text-slate-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-800 truncate">{item.product.name}</p>
                        <div className="flex items-center gap-1 text-[10px] text-slate-500">
                          <span>Qty: {item.quantity}</span>
                          <span>|</span>
                          <span>{item.fromBin.code}</span>
                          <ArrowRight className="h-2.5 w-2.5 text-purple-500" />
                          <span>{item.toBin.code}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {order.items.length > 2 && (
                    <button onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}
                      className="text-[10px] text-purple-600 font-medium pl-2">
                      {expandedId === order.id ? "Show less" : `+${order.items.length - 2} more items`}
                    </button>
                  )}
                </div>

                {/* Notes */}
                {order.notes && <p className="text-[10px] text-slate-400 mb-2">{order.notes}</p>}
                {order.rejectionNote && (
                  <p className="text-[10px] text-red-500 mb-2">Rejected: {order.rejectionNote}</p>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between">
                  {order.reviewedBy && (
                    <p className="text-[10px] text-slate-400">
                      {order.status === "APPROVED" ? "Approved" : "Reviewed"} by {order.reviewedBy.name}
                    </p>
                  )}
                  {!order.reviewedBy && <div />}

                  {canApprove && order.status === "PENDING" && (
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="outline"
                        className="h-7 text-xs text-green-600 border-green-200 hover:bg-green-50"
                        onClick={() => handleAction(order.id, "approve")}
                        disabled={approving === order.id}>
                        {approving === order.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Approve"}
                      </Button>
                      <Button size="sm" variant="outline"
                        className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => handleAction(order.id, "reject")}
                        disabled={approving === order.id}>
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
