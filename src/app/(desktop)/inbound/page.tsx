"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowDownCircle } from "lucide-react";
import { DataTable, type Column } from "@/components/desktop/data-table";
import { Badge } from "@/components/ui/badge";

interface Shipment {
  id: string;
  shipmentNo: string;
  billNo: string;
  billDate: string;
  status: string;
  totalAmount: number;
  totalItems: number;
  expectedDeliveryDate: string | null;
  deliveredAt: string | null;
  brand: { name: string };
  lineItems: Array<{ id: string; productName: string; quantity: number; isDelivered: boolean }>;
}

function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

const STATUS_MAP: Record<string, { label: string; variant: string }> = {
  IN_TRANSIT: { label: "In Transit", variant: "warning" },
  PARTIALLY_DELIVERED: { label: "Partial", variant: "info" },
  DELIVERED: { label: "Delivered", variant: "success" },
};

export default function DesktopInboundPage() {
  const router = useRouter();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");

  const fetchData = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "200" });
    if (filter !== "ALL") params.set("status", filter);
    fetch(`/api/inbound?${params}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setShipments(res.data);
      })
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns: Column<Shipment>[] = [
    {
      key: "shipmentNo",
      label: "Shipment",
      sortable: true,
      sortValue: (r) => r.shipmentNo,
      render: (r) => <span className="font-medium text-slate-900 font-mono text-xs">{r.shipmentNo}</span>,
    },
    {
      key: "brand",
      label: "Brand",
      sortable: true,
      sortValue: (r) => r.brand.name,
      render: (r) => <span className="text-slate-700 font-medium">{r.brand.name}</span>,
    },
    {
      key: "billNo",
      label: "Bill No",
      sortable: true,
      sortValue: (r) => r.billNo,
      render: (r) => <span className="text-slate-600 text-xs">{r.billNo}</span>,
    },
    {
      key: "items",
      label: "Items",
      sortable: true,
      className: "text-center",
      sortValue: (r) => r.totalItems,
      render: (r) => {
        const delivered = r.lineItems.filter((li) => li.isDelivered).length;
        return (
          <span className="text-slate-700">
            {delivered}/{r.totalItems}
          </span>
        );
      },
    },
    {
      key: "amount",
      label: "Amount",
      sortable: true,
      className: "text-right",
      sortValue: (r) => r.totalAmount,
      render: (r) => <span className="font-medium">{formatINR(r.totalAmount)}</span>,
    },
    {
      key: "billDate",
      label: "Bill Date",
      sortable: true,
      sortValue: (r) => r.billDate,
      render: (r) => <span className="text-slate-500 text-xs">{new Date(r.billDate).toLocaleDateString("en-IN")}</span>,
    },
    {
      key: "eta",
      label: "ETA",
      sortable: true,
      sortValue: (r) => r.expectedDeliveryDate || "",
      render: (r) => r.expectedDeliveryDate
        ? <span className="text-slate-500 text-xs">{new Date(r.expectedDeliveryDate).toLocaleDateString("en-IN")}</span>
        : <span className="text-slate-300">—</span>,
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      sortValue: (r) => r.status,
      render: (r) => {
        const cfg = STATUS_MAP[r.status] || { label: r.status, variant: "default" };
        return <Badge variant={cfg.variant as "warning" | "info" | "success" | "default"}>{cfg.label}</Badge>;
      },
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ArrowDownCircle className="h-5 w-5 text-slate-700" />
          <h1 className="text-xl font-bold text-slate-900">Inbound Shipments</h1>
        </div>
      </div>

      <div className="flex gap-2">
        {[
          { key: "ALL", label: "All" },
          { key: "IN_TRANSIT", label: "In Transit" },
          { key: "PARTIALLY_DELIVERED", label: "Partial" },
          { key: "DELIVERED", label: "Delivered" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === f.key ? "bg-slate-900 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      ) : (
        <DataTable
          data={shipments}
          columns={columns}
          keyExtractor={(r) => r.id}
          onRowClick={(r) => router.push(`/desktop/inbound/${r.id}`)}
          emptyMessage="No shipments found"
        />
      )}
    </div>
  );
}
