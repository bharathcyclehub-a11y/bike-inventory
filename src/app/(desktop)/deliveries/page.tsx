"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Truck } from "lucide-react";
import { DataTable, type Column } from "@/components/desktop/data-table";
import { Badge } from "@/components/ui/badge";

interface Delivery {
  id: string;
  invoiceNo: string;
  invoiceDate: string;
  invoiceAmount: number;
  customerName: string;
  customerPhone: string | null;
  customerArea: string | null;
  status: string;
  scheduledDate: string | null;
  salesPerson: string | null;
  isOutstation: boolean;
  invoiceType: string | null;
  lineItems: Array<{ name: string; quantity: number }> | null;
}

interface Stats {
  pending: number;
  verified: number;
  scheduled: number;
  outForDelivery: number;
  deliveredToday: number;
  flagged: number;
  prebooked: number;
}

const STATUS_VARIANT: Record<string, string> = {
  PENDING: "warning",
  VERIFIED: "info",
  SCHEDULED: "info",
  OUT_FOR_DELIVERY: "info",
  DELIVERED: "success",
  FLAGGED: "danger",
  PREBOOKED: "default",
  WALK_OUT: "success",
  PACKED: "info",
  SHIPPED: "info",
  IN_TRANSIT: "info",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  VERIFIED: "Verified",
  SCHEDULED: "Scheduled",
  OUT_FOR_DELIVERY: "Out",
  DELIVERED: "Delivered",
  FLAGGED: "Flagged",
  PREBOOKED: "Prebooked",
  WALK_OUT: "Walk-out",
  PACKED: "Packed",
  SHIPPED: "Shipped",
  IN_TRANSIT: "In Transit",
};

function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

export default function DesktopDeliveriesPage() {
  const router = useRouter();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("PENDING");
  const [search, setSearch] = useState("");

  const fetchData = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter !== "ALL") params.set("status", filter);
    if (search) params.set("search", search);
    params.set("limit", "200");

    Promise.all([
      fetch(`/api/deliveries?${params}`).then((r) => r.json()),
      fetch("/api/deliveries/stats").then((r) => r.json()),
    ])
      .then(([listRes, statsRes]) => {
        if (listRes.success) setDeliveries(listRes.data);
        if (statsRes.success) setStats(statsRes.data);
      })
      .finally(() => setLoading(false));
  }, [filter, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const FILTERS = [
    { key: "PENDING", label: "Pending", count: stats?.pending },
    { key: "VERIFIED", label: "Verified", count: stats?.verified },
    { key: "SCHEDULED", label: "Scheduled", count: stats?.scheduled },
    { key: "OUT_FOR_DELIVERY", label: "Out", count: stats?.outForDelivery },
    { key: "DELIVERED", label: "Delivered", count: stats?.deliveredToday },
    { key: "FLAGGED", label: "Flagged", count: stats?.flagged },
    { key: "PREBOOKED", label: "Prebooked", count: stats?.prebooked },
    { key: "ALL", label: "All" },
  ];

  const columns: Column<Delivery>[] = [
    {
      key: "invoiceNo",
      label: "Invoice",
      sortable: true,
      sortValue: (r) => r.invoiceNo,
      render: (r) => (
        <div>
          <p className="font-medium text-slate-900">{r.invoiceNo}</p>
          {r.invoiceType && <span className="text-[10px] text-blue-600">{r.invoiceType}</span>}
        </div>
      ),
    },
    {
      key: "customer",
      label: "Customer",
      sortable: true,
      sortValue: (r) => r.customerName,
      render: (r) => (
        <div>
          <p className="text-slate-900">{r.customerName}</p>
          {r.customerArea && <p className="text-xs text-slate-400">{r.customerArea}</p>}
        </div>
      ),
    },
    {
      key: "items",
      label: "Items",
      render: (r) => {
        const items = r.lineItems || [];
        if (items.length === 0) return <span className="text-slate-400">—</span>;
        return (
          <p className="text-xs text-slate-600 max-w-[200px] truncate">
            {items.map((i) => `${i.name}${i.quantity > 1 ? ` x${i.quantity}` : ""}`).join(", ")}
          </p>
        );
      },
    },
    {
      key: "amount",
      label: "Amount",
      sortable: true,
      className: "text-right",
      sortValue: (r) => r.invoiceAmount,
      render: (r) => <span className="font-medium">{formatINR(r.invoiceAmount)}</span>,
    },
    {
      key: "date",
      label: "Date",
      sortable: true,
      sortValue: (r) => r.invoiceDate,
      render: (r) => <span className="text-slate-500">{new Date(r.invoiceDate).toLocaleDateString("en-IN")}</span>,
    },
    {
      key: "salesPerson",
      label: "Sales",
      render: (r) => r.salesPerson ? <span className="text-purple-600 text-xs">{r.salesPerson}</span> : <span className="text-slate-300">—</span>,
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      sortValue: (r) => r.status,
      render: (r) => (
        <div className="flex items-center gap-1.5">
          <Badge variant={(STATUS_VARIANT[r.status] || "default") as "warning" | "info" | "success" | "danger" | "default"}>
            {STATUS_LABEL[r.status] || r.status}
          </Badge>
          {r.isOutstation && <Badge variant="warning" className="text-[9px]">OS</Badge>}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Truck className="h-5 w-5 text-slate-700" />
          <h1 className="text-xl font-bold text-slate-900">Deliveries</h1>
        </div>
        <input
          type="text"
          placeholder="Search invoice, customer..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-slate-300"
        />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === f.key ? "bg-slate-900 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            {f.label}{f.count !== undefined && f.count > 0 ? ` (${f.count})` : ""}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      ) : (
        <DataTable
          data={deliveries}
          columns={columns}
          keyExtractor={(r) => r.id}
          onRowClick={(r) => router.push(`/desktop/deliveries/${r.id}`)}
          emptyMessage="No deliveries found"
        />
      )}
    </div>
  );
}
