"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Search, Truck, Loader2, Calendar, Cloud, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useDebounce } from "@/lib/utils";
import { DateFilter, type DateRangeKey } from "@/components/date-filter";
import { usePermissions } from "@/lib/use-permissions";

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
  lineItems: { productName: string; quantity: number; isDelivered: boolean }[];
  _count: { lineItems: number; preBookings: number };
}

interface Stats {
  inTransit: { shipments: number; items: number };
  arrivingThisWeek: { shipments: number; items: number };
  preBookingsWaiting: number;
  deliveredThisMonth: number;
}

interface ZohoBillPreview {
  id: string;
  zohoId: string;
  data: {
    billNumber: string;
    vendorName: string;
    date: string;
    total: number;
    balance: number;
    lineItems: Array<{ name: string; sku: string; quantity: number; rate: number; itemTotal: number }>;
  };
}

type StatusFilter = "ALL" | "IN_TRANSIT" | "PARTIALLY_DELIVERED" | "arriving_this_week" | "DELIVERED" | "LEGACY";

interface LegacyInward {
  id: string;
  referenceNo: string;
  brandName: string;
  createdAt: string;
  createdBy: string;
  items: { productName: string; sku: string; quantity: number }[];
  totalQuantity: number;
}

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
  const { canFetch } = usePermissions(role);
  const canFetchBills = canFetch("inbound");

  const [shipments, setShipments] = useState<InboundShipment[]>([]);
  const [legacyInwards, setLegacyInwards] = useState<LegacyInward[]>([]);
  const [isLegacy, setIsLegacy] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const [showSearch, setShowSearch] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateRangeKey>("all");
  const [dateFrom, setDateFrom] = useState<string | undefined>();
  const [dateTo, setDateTo] = useState<string | undefined>();

  // Zoho fetch flow
  const [fetchStep, setFetchStep] = useState<"idle" | "pickDate" | "fetching" | "selecting" | "importing">("idle");
  const [fetchProgress, setFetchProgress] = useState("");
  const [fetchError, setFetchError] = useState("");
  const [fetchPullId, setFetchPullId] = useState("");
  const [fetchDays, setFetchDays] = useState<number>(7);
  const [fetchCustomFrom, setFetchCustomFrom] = useState("");
  const [billSearchNo, setBillSearchNo] = useState("");
  const [billPreviews, setBillPreviews] = useState<ZohoBillPreview[]>([]);
  const [selectedBills, setSelectedBills] = useState<Set<string>>(new Set());

  const fetchData = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "50" });
    if (filter !== "ALL") params.set("status", filter);
    if (debouncedSearch.length >= 2) params.set("search", debouncedSearch);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);

    Promise.all([
      fetch(`/api/inbound?${params}`).then((r) => r.json()),
      fetch("/api/inbound/stats").then((r) => r.json()),
    ])
      .then(([listRes, statsRes]) => {
        if (listRes.success) {
          if (listRes.data.isLegacy) {
            setLegacyInwards(listRes.data.shipments || []);
            setShipments([]);
            setIsLegacy(true);
          } else {
            setShipments(listRes.data.shipments || []);
            setLegacyInwards([]);
            setIsLegacy(false);
          }
        }
        if (statsRes.success) setStats(statsRes.data);
      })
      .catch((e) => { setFetchError(e instanceof Error ? e.message : "Failed to load shipments"); })
      .finally(() => setLoading(false));
  }, [filter, debouncedSearch, dateFrom, dateTo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ─── Zoho Bill Fetch ───
  const fetchWithTimeout = async (url: string, options?: RequestInit, timeoutMs = 20000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") throw new Error("Request timed out — try again");
      throw e;
    } finally { clearTimeout(timer); }
  };

  const handleFetchBills = async () => {
    setFetchStep("fetching");
    setFetchError("");
    setFetchProgress("Connecting to Zoho...");
    try {
      const initRes = await fetchWithTimeout("/api/zoho/trigger-pull", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "init" }),
      }).then(r => r.json());
      if (!initRes.success) throw new Error(initRes.error || "Init failed");
      const pullId = initRes.data.pullId;
      setFetchPullId(pullId);

      const isBillSearch = billSearchNo.trim().length > 0;
      let fromDate: string | undefined;
      let searchText: string | undefined;
      let label: string;

      if (isBillSearch) {
        searchText = billSearchNo.trim();
        label = `"${searchText}"`;
        setFetchProgress(`Searching for bill ${label}...`);
      } else if (fetchDays === -1 && fetchCustomFrom) {
        fromDate = fetchCustomFrom;
        label = "custom range";
        setFetchProgress(`Pulling bills (${label})...`);
      } else {
        const fromDateObj = new Date();
        fromDateObj.setDate(fromDateObj.getDate() - fetchDays);
        fromDate = fromDateObj.toISOString().slice(0, 10);
        label = `last ${fetchDays} days`;
        setFetchProgress(`Pulling bills (${label})...`);
      }

      const billRes = await fetchWithTimeout("/api/zoho/trigger-pull", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "bills", pullId, fromDate, searchText }),
      }, 60000).then(r => r.json());
      if (!billRes.success) throw new Error(billRes.error || "Bills fetch failed");

      const billsFound = billRes.data.billsNew || 0;
      setFetchProgress(`Found ${billsFound} new bill${billsFound !== 1 ? "s" : ""}. Finalizing...`);

      await fetchWithTimeout("/api/zoho/trigger-pull", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: "finalize", pullId,
          billsNew: billRes.data.billsNew, apiCalls: billRes.data.apiCalls,
          allErrors: billRes.data.errors || [],
        }),
      }).then(r => r.json()).catch(() => {});

      setFetchProgress("Loading preview...");
      const previewRes = await fetchWithTimeout(`/api/zoho/pull-review?pullId=${pullId}`).then(r => r.json());
      if (!previewRes.success) throw new Error(previewRes.error || "Failed to load preview");
      const billItems = (previewRes.data.previews || []).filter(
        (p: ZohoBillPreview & { entityType: string; status: string }) => p.entityType === "bill" && p.status === "PENDING"
      );
      setBillPreviews(billItems);
      setSelectedBills(new Set(billItems.map((b: ZohoBillPreview) => b.id)));
      setFetchStep(billItems.length > 0 ? "selecting" : "idle");
      if (billItems.length === 0) {
        setFetchError(billsFound > 0 ? `${billsFound} found but all already imported` : `No new bills found (${label})`);
        if (isBillSearch) setBillSearchNo("");
      }
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "Fetch failed");
      setFetchStep("idle");
    } finally {
      setFetchProgress("");
    }
  };

  const toggleBill = (id: string) => {
    setSelectedBills(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleImportSelected = async () => {
    if (selectedBills.size === 0) return;
    setFetchStep("importing");
    try {
      const res = await fetch("/api/zoho/pull-review/approve", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pullId: fetchPullId, action: "approve",
          entityType: "bill", previewIds: Array.from(selectedBills),
          source: "inventory",
        }),
      }).then(r => r.json());
      if (!res.success) throw new Error(res.error || "Import failed");
      const imported = res.data?.bills || 0;
      const errors = res.data?.errors || [];
      setFetchStep("idle");
      setBillPreviews([]);
      setSelectedBills(new Set());
      setBillSearchNo("");
      fetchData();
      if (errors.length > 0) {
        setFetchError(`Imported ${imported} bill(s). Warnings: ${errors.join("; ")}`);
      }
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "Import failed");
      setFetchStep("selecting");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Inwards</h1>
          <p className="text-xs text-slate-500">Zoho bills & shipment tracking</p>
        </div>
        <div className="flex items-center gap-2">
          {!showSearch && (
            <button onClick={() => setShowSearch(true)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
              <Search className="h-4 w-4" />
            </button>
          )}
          {canFetchBills && fetchStep !== "pickDate" && (
            <button
              onClick={() => setFetchStep("pickDate")}
              disabled={fetchStep === "fetching" || fetchStep === "importing"}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-900 text-white disabled:opacity-50"
            >
              {fetchStep === "fetching" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Cloud className="h-3.5 w-3.5" />}
              {fetchStep === "fetching" ? "Fetching..." : "Fetch Inbound"}
            </button>
          )}
        </div>
      </div>

      {/* Fetch Date Picker */}
      {fetchStep === "pickDate" && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-2">
          {/* Bill Number Search */}
          <div className="mb-3">
            <p className="text-xs font-medium text-slate-700 mb-1.5">Search specific bill:</p>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. EB/10311/FY27"
                value={billSearchNo}
                onChange={(e) => setBillSearchNo(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && billSearchNo.trim()) handleFetchBills(); }}
                className="flex-1 text-xs h-8"
              />
              <button
                onClick={handleFetchBills}
                disabled={!billSearchNo.trim()}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white disabled:opacity-50 shrink-0"
              >
                <Search className="h-3.5 w-3.5" /> Find
              </button>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-3">
            <p className="text-xs font-medium text-slate-700 mb-2">Or fetch by date range:</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {[
                { label: "3 days", value: 3 },
                { label: "7 days", value: 7 },
                { label: "14 days", value: 14 },
                { label: "30 days", value: 30 },
                { label: "Custom", value: -1 },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setFetchDays(opt.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    fetchDays === opt.value
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-600 border-slate-300 hover:border-slate-400"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {fetchDays === -1 && (
              <div className="flex gap-2 mb-3">
                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">From</label>
                  <input type="date" value={fetchCustomFrom} onChange={(e) => setFetchCustomFrom(e.target.value)}
                    className="px-2 py-1.5 text-xs border border-slate-300 rounded-lg" />
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setBillSearchNo(""); handleFetchBills(); }}
              disabled={fetchDays === -1 && !fetchCustomFrom}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 text-white disabled:opacity-50"
            >
              <Cloud className="h-3.5 w-3.5" /> Fetch
            </button>
            <button
              onClick={() => { setFetchStep("idle"); setBillSearchNo(""); }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white text-slate-500 border border-slate-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Fetch Progress */}
      {fetchStep === "fetching" && fetchProgress && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg p-2.5 mb-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600 shrink-0" />
          <span className="text-xs text-blue-700 font-medium">{fetchProgress}</span>
        </div>
      )}

      {/* Fetch Error */}
      {fetchError && (
        <div className={`rounded-lg p-2.5 mb-2 text-xs ${
          fetchError.toLowerCase().includes("fail") || fetchError.toLowerCase().includes("error") || fetchError.toLowerCase().includes("timed out")
            ? "bg-red-50 border border-red-200 text-red-700"
            : "bg-amber-50 border border-amber-200 text-amber-700"
        }`}>
          {fetchError}
          <button onClick={() => setFetchError("")} className="ml-2 underline">dismiss</button>
        </div>
      )}

      {/* Bill Selection Panel */}
      {fetchStep === "selecting" && billPreviews.length > 0 && (
        <Card className="mb-3 border-blue-200 bg-blue-50/50">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-blue-800">
                {billPreviews.length} new bill{billPreviews.length !== 1 ? "s" : ""} from Zoho
              </p>
              <div className="flex gap-2">
                <button onClick={() => { setFetchStep("idle"); setBillPreviews([]); }}
                  className="text-xs text-slate-500 underline">Cancel</button>
                <button onClick={handleImportSelected} disabled={selectedBills.size === 0}
                  className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-md text-xs font-medium disabled:opacity-50">
                  <Download className="h-3 w-3" /> Import {selectedBills.size}
                </button>
              </div>
            </div>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {billPreviews.map((bill) => (
                <label key={bill.id}
                  className={`flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                    selectedBills.has(bill.id) ? "bg-blue-100 border border-blue-300" : "bg-white border border-slate-200"
                  }`}>
                  <input type="checkbox" checked={selectedBills.has(bill.id)}
                    onChange={() => toggleBill(bill.id)} className="mt-0.5 rounded" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-900">{bill.data.billNumber}</span>
                      <span className="text-xs font-semibold text-slate-700">{formatINR(bill.data.total)}</span>
                    </div>
                    <p className="text-[10px] text-slate-600 truncate">{bill.data.vendorName}</p>
                    <p className="text-[10px] text-slate-400">
                      {bill.data.date && new Date(bill.data.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      {bill.data.lineItems.length > 0 && (
                        <span className="ml-1.5">{bill.data.lineItems.reduce((s, li) => s + li.quantity, 0)} items ({bill.data.lineItems.length} lines)</span>
                      )}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Importing indicator */}
      {fetchStep === "importing" && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
          <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
          <span className="text-xs text-blue-700 font-medium">Importing bills & creating shipments...</span>
        </div>
      )}

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

      {/* Date Filter */}
      <DateFilter
        value={dateFilter}
        onChange={(key, from, to) => { setDateFilter(key); setDateFrom(from); setDateTo(to); }}
        className="mb-2"
      />

      {/* Status Filter */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-3 pb-1">
        {([
          { key: "ALL", label: "All" },
          { key: "IN_TRANSIT", label: "In Transit" },
          { key: "PARTIALLY_DELIVERED", label: "Partial" },
          { key: "arriving_this_week", label: "This Week" },
          { key: "DELIVERED", label: "Delivered" },
          { key: "LEGACY", label: "Pre-Merge" },
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
      ) : isLegacy ? (
        legacyInwards.length === 0 ? (
          <div className="text-center py-12">
            <Truck className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-400">No pre-merge inward records found</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-slate-500 mb-1">Showing {legacyInwards.length} inward records from before the merge</p>
            {legacyInwards.map((g) => (
              <Card key={g.id} className="border-slate-200 mb-2">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex-1 min-w-0 mr-2">
                      <p className="text-sm font-semibold text-slate-900">{g.brandName}</p>
                      <p className="text-xs text-slate-500">Ref: {g.referenceNo}</p>
                    </div>
                    <Badge variant="success">Received</Badge>
                  </div>
                  <div className="mt-1.5 space-y-0.5">
                    {g.items.map((item, idx) => (
                      <p key={idx} className="text-xs text-slate-600">
                        {item.productName} {item.sku ? `(${item.sku})` : ""} <span className="text-slate-400">x {item.quantity}</span>
                      </p>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                    <span>{formatDate(g.createdAt)}</span>
                    <span className="ml-auto">By: {g.createdBy}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      ) : shipments.length === 0 ? (
        <div className="text-center py-12">
          <Truck className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400">No shipments found</p>
          {canFetchBills && (
            <button onClick={() => setFetchStep("pickDate")}
              className="mt-3 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium">
              Fetch Inbound from Zoho
            </button>
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

                    <div className="mt-1.5 space-y-0.5">
                      {s.lineItems.map((li, idx) => (
                        <p key={idx} className="text-xs text-slate-600">
                          {li.productName} <span className="text-slate-400">x {li.quantity}</span>
                          {li.isDelivered && <span className="text-green-500 ml-1">✓</span>}
                        </p>
                      ))}
                    </div>

                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex items-center gap-1 text-xs text-slate-500">
                        <span>Billed: {formatDate(s.billDate)}</span>
                      </div>
                      {s.status === "IN_TRANSIT" && (
                        <div className="flex items-center gap-1 text-xs ml-auto">
                          <Calendar className="h-3 w-3 text-amber-500" />
                          <span className={`font-medium ${
                            daysUntil(s.expectedDeliveryDate).includes("overdue") ? "text-red-600" : "text-amber-600"
                          }`}>
                            ETA: {formatDate(s.expectedDeliveryDate)} ({daysUntil(s.expectedDeliveryDate)})
                          </span>
                        </div>
                      )}
                      {s.status === "DELIVERED" && s.deliveredAt && (
                        <span className="text-xs text-green-600 ml-auto">
                          Delivered: {formatDate(s.deliveredAt)}
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
