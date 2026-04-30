"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Truck, Phone, MapPin, Package, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useDebounce, getAging, AGING_COLORS } from "@/lib/utils";

interface OutstationDelivery {
  id: string;
  invoiceNo: string;
  invoiceDate: string;
  invoiceAmount: number;
  customerName: string;
  customerPhone: string | null;
  customerArea: string | null;
  status: string;
  scheduledDate: string | null;
  lineItems: Array<{ name: string; quantity: number }> | null;
  salesPerson: string | null;
  courierName: string | null;
  trackingNo: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  VERIFIED: "bg-blue-100 text-blue-700",
  SCHEDULED: "bg-blue-100 text-blue-700",
  PACKED: "bg-purple-100 text-purple-700",
  OUT_FOR_DELIVERY: "bg-orange-100 text-orange-700",
  SHIPPED: "bg-indigo-100 text-indigo-700",
  IN_TRANSIT: "bg-orange-100 text-orange-700",
  DELIVERED: "bg-green-100 text-green-700",
  FLAGGED: "bg-red-100 text-red-700",
};

export default function OutstationDeliveriesPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [deliveries, setDeliveries] = useState<OutstationDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState("ALL");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ outstation: "true", limit: "100" });
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await fetch(`/api/deliveries?${params}`).then(r => r.json());
      if (res.success) setDeliveries(res.data);
    } catch { /* ignore */ }
    setLoading(false);
  }, [statusFilter, debouncedSearch]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const FILTERS = ["ALL", "PENDING", "SCHEDULED", "PACKED", "OUT_FOR_DELIVERY", "SHIPPED", "IN_TRANSIT", "DELIVERED"];

  return (
    <div className="pb-20">
      <div className="flex items-center gap-2 mb-3">
        <Link href="/deliveries">
          <ArrowLeft className="h-5 w-5 text-slate-600" />
        </Link>
        <h1 className="text-lg font-bold text-slate-900">Outstation Deliveries</h1>
        <Badge variant="default" className="ml-auto text-xs">{deliveries.length}</Badge>
      </div>

      {/* Search */}
      <div className="relative mb-2">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
        <input
          type="text"
          placeholder="Search customer, invoice..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400"
        />
      </div>

      {/* Status Filter Chips */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide mb-3 pb-1">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setStatusFilter(f)}
            className={`shrink-0 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
              statusFilter === f ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
            }`}>
            {f === "ALL" ? "All" : f === "IN_TRANSIT" ? "In Transit" : f === "OUT_FOR_DELIVERY" ? "Out for Delivery" : f.charAt(0) + f.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
      ) : deliveries.length === 0 ? (
        <div className="text-center py-12">
          <Truck className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No outstation deliveries</p>
        </div>
      ) : (
        <div className="space-y-2">
          {deliveries.map((d) => {
            const aging = getAging(d.invoiceDate);
            return (
              <Card key={d.id} className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => router.push(`/deliveries/${d.id}`)}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between mb-1.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{d.customerName}</p>
                      <p className="text-[10px] text-slate-500">{d.invoiceNo}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge className={`text-[9px] ${AGING_COLORS[aging.level] || ""}`}>{aging.text}</Badge>
                      <Badge className={`text-[9px] ${STATUS_COLORS[d.status] || "bg-slate-100 text-slate-600"}`}>
                        {d.status === "IN_TRANSIT" ? "In Transit" : d.status === "OUT_FOR_DELIVERY" ? "Out for Delivery" : d.status.charAt(0) + d.status.slice(1).toLowerCase()}
                      </Badge>
                    </div>
                  </div>

                  {d.customerArea && (
                    <div className="flex items-center gap-1 text-[10px] text-slate-500 mb-1">
                      <MapPin className="h-3 w-3" /> {d.customerArea}
                    </div>
                  )}

                  {d.lineItems && d.lineItems.length > 0 && (
                    <p className="text-[10px] text-slate-500 truncate mb-1">
                      <Package className="h-3 w-3 inline mr-0.5" />
                      {d.lineItems.map(li => li.name).join(", ")}
                    </p>
                  )}

                  <div className="flex items-center justify-between mt-1.5">
                    <div className="flex items-center gap-2 text-[10px] text-slate-500">
                      {d.courierName && <span>🚚 {d.courierName}</span>}
                      {d.trackingNo && <span>📦 {d.trackingNo}</span>}
                      {d.salesPerson && <span>👤 {d.salesPerson}</span>}
                    </div>
                    {d.customerPhone && (
                      <a href={`tel:${d.customerPhone}`} onClick={(e) => e.stopPropagation()}
                        className="p-1 rounded-full bg-green-100 text-green-700">
                        <Phone className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
