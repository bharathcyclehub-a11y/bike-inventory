"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Plus, CheckCircle2, Cloud, Loader2, Search } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ExportButtons } from "@/components/export-buttons";
import { exportToExcel, exportToPDF, type ExportColumn } from "@/lib/export";
import { fuzzySearchFields } from "@/lib/utils";

const OUTWARD_COLUMNS: ExportColumn[] = [
  { header: "Product", key: "product.name" },
  { header: "SKU", key: "product.sku" },
  { header: "Quantity", key: "quantity" },
  { header: "Reference No", key: "referenceNo" },
  { header: "Recorded By", key: "user.name" },
  { header: "Date/Time", key: "createdAt", format: (v) => new Date(String(v)).toLocaleString("en-IN") },
];

interface OutwardTransaction {
  id: string;
  quantity: number;
  referenceNo: string | null;
  notes: string | null;
  createdAt: string;
  product: { name: string; sku: string; size?: string | null; brand?: { name: string } | null };
  user: { name: string };
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

type DateFilter = "today" | "week" | "month" | "all";
type SourceFilter = "all" | "manual" | "zoho" | "unverified";

const DATE_CHIPS: { key: DateFilter; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "all", label: "All" },
];

function getDateFrom(filter: DateFilter): string | undefined {
  const now = new Date();
  if (filter === "today") return now.toISOString().split("T")[0];
  if (filter === "week") {
    const d = new Date(now);
    d.setDate(d.getDate() - d.getDay());
    return d.toISOString().split("T")[0];
  }
  if (filter === "month") return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  return undefined;
}

function isZoho(notes: string | null) { return notes?.includes("[ZOHO]") || false; }
function isVerified(notes: string | null) { return notes?.includes("[VERIFIED]") || false; }
function getCustomer(notes: string | null) {
  const match = notes?.match(/Customer:\s*([^|]+)/);
  return match?.[1]?.trim() || "";
}

export default function OutwardsPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role || "";
  const canAddOutward = ["ADMIN", "OUTWARDS_CLERK"].includes(role);
  const [outwards, setOutwards] = useState<OutwardTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [verifying, setVerifying] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "100" });
    const dateFrom = getDateFrom(dateFilter);
    if (dateFrom) params.set("dateFrom", dateFrom);

    fetch(`/api/inventory/outwards?${params}`)
      .then((r) => r.json())
      .then((res) => { if (res.success) setOutwards(res.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [dateFilter]);

  const filtered = outwards.filter((t) => {
    if (sourceFilter === "manual" && isZoho(t.notes)) return false;
    if (sourceFilter === "zoho" && !isZoho(t.notes)) return false;
    if (sourceFilter === "unverified" && !(isZoho(t.notes) && !isVerified(t.notes))) return false;
    if (search && !fuzzySearchFields(search, [t.product.name, t.product.sku, t.referenceNo, t.product.brand?.name, t.product.size])) return false;
    return true;
  });

  const totalQty = filtered.reduce((sum, t) => sum + t.quantity, 0);
  const unverifiedCount = outwards.filter((t) => isZoho(t.notes) && !isVerified(t.notes)).length;

  async function handleVerify(id: string) {
    setVerifying(id);
    try {
      const res = await fetch("/api/inventory/outwards/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId: id }),
      });
      const data = await res.json();
      if (data.success) {
        setOutwards((prev) =>
          prev.map((t) =>
            t.id === id ? { ...t, notes: t.notes?.replace("[UNVERIFIED]", "[VERIFIED]") || t.notes } : t
          )
        );
      }
    } catch { /* ignore */ }
    finally { setVerifying(null); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Outwards</h1>
          <p className="text-sm text-slate-500">{filtered.length} entries | {totalQty} units</p>
        </div>
        <ExportButtons
          onExcel={() => exportToExcel(filtered as unknown as Record<string, unknown>[], OUTWARD_COLUMNS, "outwards")}
          onPDF={() => exportToPDF("Outwards Report", filtered as unknown as Record<string, unknown>[], OUTWARD_COLUMNS, "outwards")}
        />
      </div>

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search product, SKU, or invoice no..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Date Filter */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-2 pb-1">
        {DATE_CHIPS.map((chip) => (
          <button key={chip.key} onClick={() => setDateFilter(chip.key)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              dateFilter === chip.key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}>{chip.label}</button>
        ))}
      </div>

      {/* Source Filter */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-3 pb-1">
        {([
          { key: "all", label: "All Sources" },
          { key: "manual", label: "Manual" },
          { key: "zoho", label: "Zoho POS" },
          { key: "unverified", label: `Unverified${unverifiedCount > 0 ? ` (${unverifiedCount})` : ""}` },
        ] as { key: SourceFilter; label: string }[]).map((chip) => (
          <button key={chip.key} onClick={() => setSourceFilter(chip.key)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              sourceFilter === chip.key
                ? chip.key === "unverified" ? "bg-amber-500 text-white" : "bg-purple-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}>{chip.label}</button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {dateFilter === "today" ? "Today's" : dateFilter === "week" ? "This Week's" : dateFilter === "month" ? "This Month's" : "All"} Outwards
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-3 border-b border-slate-100 animate-pulse">
                  <div className="h-9 w-9 rounded-full bg-slate-200 shrink-0" />
                  <div className="flex-1 space-y-1.5"><div className="h-4 bg-slate-200 rounded w-2/3" /><div className="h-3 bg-slate-200 rounded w-1/3" /></div>
                  <div className="text-right space-y-1.5"><div className="h-4 bg-slate-200 rounded w-10 ml-auto" /><div className="h-3 bg-slate-200 rounded w-12 ml-auto" /></div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">No outwards found</p>
          ) : (
            filtered.map((t) => {
              const zoho = isZoho(t.notes);
              const verified = isVerified(t.notes);
              const customer = getCustomer(t.notes);

              return (
                <div key={t.id} className="border-b border-slate-100 last:border-0">
                  <div className="flex items-center gap-3 py-3">
                    <div className={`rounded-full p-2 ${zoho ? "bg-purple-50" : "bg-orange-50"}`}>
                      {zoho ? (
                        <Cloud className="h-5 w-5 text-purple-500" />
                      ) : (
                        <div className="h-5 w-5 rounded-full bg-orange-500 flex items-center justify-center">
                          <span className="text-white text-[10px] font-bold">M</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900">{t.product.name}</p>
                      <p className="text-xs text-slate-500">
                        {t.product.sku} {t.referenceNo ? `| ${t.referenceNo}` : ""}
                        {customer ? ` | ${customer}` : ""}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-orange-500">-{t.quantity}</p>
                      <p className="text-xs text-slate-400">{formatTime(t.createdAt)}</p>
                    </div>
                  </div>

                  {/* Zoho verification row */}
                  {zoho && (
                    <div className="flex items-center justify-between pb-2 pl-12">
                      {verified ? (
                        <Badge variant="success" className="text-[10px]">
                          <CheckCircle2 className="h-3 w-3 mr-0.5" /> Verified
                        </Badge>
                      ) : (
                        <Badge variant="warning" className="text-[10px]">Needs Verification</Badge>
                      )}
                      {!verified && (
                        <Button size="sm" variant="outline"
                          className="h-6 text-[10px] text-green-600 border-green-200 hover:bg-green-50"
                          onClick={() => handleVerify(t.id)}
                          disabled={verifying === t.id}>
                          {verifying === t.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Verify"}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {canAddOutward && (
        <Link
          href="/outwards/new"
          className="fixed bottom-20 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-orange-500 text-white shadow-lg hover:bg-orange-600 active:scale-95 transition-transform"
        >
          <Plus className="h-6 w-6" />
        </Link>
      )}
    </div>
  );
}
