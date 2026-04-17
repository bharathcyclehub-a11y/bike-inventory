"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Search, Plus, Truck, Loader2, Package, Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useDebounce } from "@/lib/utils";

interface InboundShipment {
  id: string;
  shipmentNo: string;
  billNo: string;
  billDate: string;
  expectedDeliveryDate: string;
  status: string;
  totalAmount: number;
  totalItems: number;
  deliveredAt: string | null;
  createdAt: string;
  brand: { name: string };
  createdBy: { name: string };
  _count: { lineItems: number; preBookings: number };
}

interface Stats {
  inTransit: { shipments: number; items: number };
  arrivingThisWeek: { shipments: number; items: number };
  preBookingsWaiting: number;
  deliveredThisMonth: number;
}

type StatusFilter = "ALL" | "IN_TRANSIT" | "arriving_this_week" | "DELIVERED";

function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function daysUntil(d: string) {
  const diff = Math.ceil((new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return `${diff} days`;
}

const STATUS_BADGE: Record<string, { variant: "success" | "warning" | "info" | "default"; label: string }> = {
  IN_TRANSIT: { variant: "warning", label: "In Transit" },
  DELIVERED: { variant: "success", label: "Delivered" },
  PARTIALLY_DELIVERED: { variant: "info", label: "Partial" },
};

export default function InboundPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role || "";
  const canCreate = ["ADMIN", "PURCHASE_MANAGER"].includes(role);

  const [shipments, setShipments] = useState<InboundShipment[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("IN_TRANSIT");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const [showSearch, setShowSearch] = useState(false);

  const fetchData = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "50" });
    if (filter !== "ALL") params.set("status", filter);
    if (debouncedSearch.length >= 2) params.set("search", debouncedSearch);

    Promise.all([
      fetch(`/api/inbound?${params}`).then((r) => r.json()),
      fetch("/api/inbound/stats").then((r) => r.json()),
    ])
      .then(([listRes, statsRes]) => {
        if (listRes.success) setShipments(listRes.data.shipments || []);
        if (statsRes.success) setStats(statsRes.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filter, debouncedSearch]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Inbound Tracking</h1>
          <p className="text-xs text-slate-500">Brand deliveries & pre-bookings</p>
        </div>
        <div className="flex items-center gap-2">
          {!showSearch && (
            <button onClick={() => setShowSearch(true)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
              <Search className="h-4 w-4" />
            </button>
          )}
          {canCreate && (
            <Link href="/inbound/new">
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700">
                <Plus className="h-4 w-4 mr-1" /> Upload Bill
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-1.5 mb-3">
          <Card className="bg-amber-50 border-amber-200"><CardContent className="p-2 text-center">
            <p className="text-lg font-bold text-amber-700">{stats.inTransit.items}</p>
            <p className="text-[9px] text-amber-600">In Transit</p>
            <p className="text-[9px] text-amber-500">{stats.inTransit.shipments} bills</p>
          </CardContent></Card>
          <Card className="bg-blue-50 border-blue-200"><CardContent className="p-2 text-center">
            <p className="text-lg font-bold text-blue-700">{stats.arrivingThisWeek.items}</p>
            <p className="text-[9px] text-blue-600">This Week</p>
            <p className="text-[9px] text-blue-500">{stats.arrivingThisWeek.shipments} bills</p>
          </CardContent></Card>
          <Card className="bg-purple-50 border-purple-200"><CardContent className="p-2 text-center">
            <p className="text-lg font-bold text-purple-700">{stats.preBookingsWaiting}</p>
            <p className="text-[9px] text-purple-600">Pre-booked</p>
            <p className="text-[9px] text-purple-500">Waiting</p>
          </CardContent></Card>
          <Card className="bg-green-50 border-green-200"><CardContent className="p-2 text-center">
            <p className="text-lg font-bold text-green-700">{stats.deliveredThisMonth}</p>
            <p className="text-[9px] text-green-600">Delivered</p>
            <p className="text-[9px] text-green-500">This Month</p>
          </CardContent></Card>
        </div>
      )}

      {/* Search */}
      {showSearch && (
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Search bill no, brand..." value={search}
            onChange={(e) => setSearch(e.target.value)} className="pl-9 pr-9" autoFocus />
          <button onClick={() => { setShowSearch(false); setSearch(""); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-3 pb-1">
        {([
          { key: "ALL", label: "All" },
          { key: "IN_TRANSIT", label: "In Transit" },
          { key: "arriving_this_week", label: "This Week" },
          { key: "DELIVERED", label: "Delivered" },
        ] as { key: StatusFilter; label: string }[]).map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === f.key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      ) : shipments.length === 0 ? (
        <div className="text-center py-12">
          <Truck className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400">No shipments found</p>
          {canCreate && (
            <Link href="/inbound/new">
              <Button variant="outline" size="sm" className="mt-3">Upload First Bill</Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {shipments.map((s) => {
            const badge = STATUS_BADGE[s.status] || { variant: "default" as const, label: s.status };
            return (
              <Link key={s.id} href={`/inbound/${s.id}`}>
                <Card className="hover:border-slate-300 transition-colors mb-2">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex-1 min-w-0 mr-2">
                        <p className="text-sm font-semibold text-slate-900">{s.brand.name}</p>
                        <p className="text-xs text-slate-500">Bill: {s.billNo} | {s.shipmentNo}</p>
                      </div>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </div>

                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex items-center gap-1 text-xs text-slate-500">
                        <Package className="h-3 w-3" />
                        <span>{s.totalItems} items</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-slate-500">
                        <span>{formatINR(s.totalAmount)}</span>
                      </div>
                      {s.status === "IN_TRANSIT" && (
                        <div className="flex items-center gap-1 text-xs ml-auto">
                          <Calendar className="h-3 w-3 text-amber-500" />
                          <span className={`font-medium ${
                            daysUntil(s.expectedDeliveryDate).includes("overdue") ? "text-red-600" : "text-amber-600"
                          }`}>
                            {daysUntil(s.expectedDeliveryDate)}
                          </span>
                        </div>
                      )}
                      {s.status === "DELIVERED" && s.deliveredAt && (
                        <span className="text-xs text-green-600 ml-auto">
                          {formatDate(s.deliveredAt)}
                        </span>
                      )}
                    </div>

                    {s._count.preBookings > 0 && (
                      <div className="mt-1.5">
                        <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded-full font-medium">
                          {s._count.preBookings} pre-booked
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
