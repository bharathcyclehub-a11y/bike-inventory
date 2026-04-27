"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Building2, Star } from "lucide-react";
import { DataTable, type Column } from "@/components/desktop/data-table";

interface Vendor {
  id: string;
  name: string;
  gstin: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  isStarred: boolean;
  balance: number;
  _count: { bills: number };
}

function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

export default function DesktopVendorsPage() {
  const router = useRouter();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/vendors?limit=500")
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setVendors(res.data);
      })
      .finally(() => setLoading(false));
  }, []);

  const columns: Column<Vendor>[] = [
    {
      key: "name",
      label: "Vendor",
      sortable: true,
      sortValue: (r) => r.name,
      render: (r) => (
        <div className="flex items-center gap-2">
          {r.isStarred && <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400 shrink-0" />}
          <span className="font-medium text-slate-900">{r.name}</span>
        </div>
      ),
    },
    {
      key: "gstin",
      label: "GSTIN",
      render: (r) => r.gstin ? <span className="text-xs font-mono text-slate-600">{r.gstin}</span> : <span className="text-slate-300">—</span>,
    },
    {
      key: "phone",
      label: "Phone",
      render: (r) => r.phone ? <span className="text-slate-600">{r.phone}</span> : <span className="text-slate-300">—</span>,
    },
    {
      key: "city",
      label: "Location",
      sortable: true,
      sortValue: (r) => r.city || "",
      render: (r) => r.city ? <span className="text-slate-600">{r.city}{r.state ? `, ${r.state}` : ""}</span> : <span className="text-slate-300">—</span>,
    },
    {
      key: "bills",
      label: "Bills",
      sortable: true,
      className: "text-center",
      sortValue: (r) => r._count.bills,
      render: (r) => <span className="text-slate-700">{r._count.bills}</span>,
    },
    {
      key: "balance",
      label: "Outstanding",
      sortable: true,
      className: "text-right",
      sortValue: (r) => r.balance,
      render: (r) => (
        <span className={`font-semibold ${r.balance > 0 ? "text-red-600" : "text-green-600"}`}>
          {r.balance > 0 ? formatINR(r.balance) : "Paid"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Building2 className="h-5 w-5 text-slate-700" />
        <h1 className="text-xl font-bold text-slate-900">Vendors</h1>
        <span className="text-sm text-slate-400">{vendors.length} vendors</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      ) : (
        <DataTable
          data={vendors}
          columns={columns}
          keyExtractor={(r) => r.id}
          onRowClick={(r) => router.push(`/desktop/vendors/${r.id}`)}
          emptyMessage="No vendors found"
          pageSize={50}
        />
      )}
    </div>
  );
}
