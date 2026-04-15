"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Search, Plus, Phone, Building2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useDebounce } from "@/lib/utils";
import { ExportButtons } from "@/components/export-buttons";
import { exportToExcel, exportToPDF, type ExportColumn } from "@/lib/export";

const VENDOR_COLUMNS: ExportColumn[] = [
  { header: "Code", key: "code" },
  { header: "Name", key: "name" },
  { header: "City", key: "city" },
  { header: "Phone", key: "phone" },
  { header: "WhatsApp", key: "whatsappNumber" },
  { header: "Payment Terms (Days)", key: "paymentTermDays" },
  { header: "Status", key: "isActive", format: (v) => (v ? "Active" : "Inactive") },
  { header: "POs", key: "_count.purchaseOrders" },
  { header: "Bills", key: "_count.bills" },
];

interface VendorItem {
  id: string;
  name: string;
  code: string;
  city?: string;
  phone?: string;
  whatsappNumber?: string;
  isActive: boolean;
  paymentTermDays: number;
  _count: { purchaseOrders: number; bills: number };
}

type VendorFilter = "ALL" | "ACTIVE" | "INACTIVE";

export default function VendorsPage() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const [vendors, setVendors] = useState<VendorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [activeFilter, setActiveFilter] = useState<VendorFilter>("ACTIVE");

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "100" });
    if (debouncedSearch.length >= 2) params.set("search", debouncedSearch);

    fetch(`/api/vendors?${params}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setVendors(res.data);
          setTotal(res.pagination?.total || res.data.length);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [debouncedSearch]);

  const filtered = activeFilter === "ALL" ? vendors
    : activeFilter === "ACTIVE" ? vendors.filter((v) => v.isActive)
    : vendors.filter((v) => !v.isActive);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-bold text-slate-900">Vendors</h1>
        <div className="flex items-center gap-2">
          <ExportButtons
            onExcel={() => exportToExcel(vendors as unknown as Record<string, unknown>[], VENDOR_COLUMNS, "vendors")}
            onPDF={() => exportToPDF("Vendors List", vendors as unknown as Record<string, unknown>[], VENDOR_COLUMNS, "vendors")}
          />
          <Link href="/vendors/new">
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </Link>
        </div>
      </div>

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search vendor name, code, or city..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-3 pb-1">
        {(["ALL", "ACTIVE", "INACTIVE"] as VendorFilter[]).map((f) => (
          <button key={f} onClick={() => setActiveFilter(f)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              activeFilter === f ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}>
            {f === "ALL" ? "All" : f === "ACTIVE" ? "Active" : "Inactive"}
          </button>
        ))}
      </div>

      <p className="text-xs text-slate-500 mb-2">Showing {filtered.length} of {total} vendors</p>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-3 border border-slate-100 rounded-lg animate-pulse">
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-1.5"><div className="h-4 bg-slate-200 rounded w-3/4" /><div className="h-3 bg-slate-200 rounded w-1/2" /></div>
                <div className="h-5 w-14 bg-slate-200 rounded-full" />
              </div>
              <div className="flex gap-3 mt-2"><div className="h-3 bg-slate-200 rounded w-20" /><div className="h-3 bg-slate-200 rounded w-16" /></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((v) => (
            <Link key={v.id} href={`/vendors/${v.id}`}>
              <Card className="hover:border-slate-300 transition-colors mb-2">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0 mr-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-slate-400 shrink-0" />
                        <p className="text-sm font-medium text-slate-900">{v.name}</p>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 ml-6">
                        {v.code} {v.city ? `| ${v.city}` : ""}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5 ml-6">
                        <Badge variant={v.isActive ? "success" : "default"}>
                          {v.isActive ? "Active" : "Inactive"}
                        </Badge>
                        <span className="text-xs text-slate-400">
                          {v._count.purchaseOrders} POs | {v._count.bills} Bills
                        </span>
                      </div>
                    </div>
                    {v.phone && (
                      <a
                        href={`tel:${v.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 rounded-full hover:bg-slate-100"
                      >
                        <Phone className="h-4 w-4 text-slate-500" />
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}

          {filtered.length === 0 && (
            <div className="text-center py-12">
              <Building2 className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No vendors found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
