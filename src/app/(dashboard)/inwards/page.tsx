"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Plus, CheckCircle2, Cloud, Loader2, ArrowDownCircle, Search, Download, ChevronRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ExportButtons } from "@/components/export-buttons";
import { exportToExcel, exportToPDF, type ExportColumn } from "@/lib/export";
import { getAging, AGING_COLORS, AGING_BADGE, fuzzySearchFields } from "@/lib/utils";

const INWARD_COLUMNS: ExportColumn[] = [
  { header: "Product", key: "product.name" },
  { header: "SKU", key: "product.sku" },
  { header: "Quantity", key: "quantity" },
  { header: "Reference No", key: "referenceNo" },
  { header: "Recorded By", key: "user.name" },
  { header: "Date/Time", key: "createdAt", format: (v) => new Date(String(v)).toLocaleString("en-IN") },
];

interface InwardTransaction {
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
function getVendor(notes: string | null) {
  const match = notes?.match(/Vendor:\s*([^|]+)/);
  return match?.[1]?.trim() || "";
}

interface ZohoBillPreview {
  id: string;
  zohoId: string;
  data: {
    billNumber: string;
    vendorName: string;
    date: string;
    dueDate: string;
    total: number;
    balance: number;
    status: string;
    lineItems: Array<{ name: string; sku: string; quantity: number; rate: number; itemTotal: number }>;
  };
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}

export default function InwardsPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role || "";
  const canAddInward = role === "ADMIN";
  const canFetchBills = ["ADMIN", "SUPERVISOR", "INWARDS_CLERK", "ACCOUNTS_MANAGER"].includes(role);
  const [inwards, setInwards] = useState<InwardTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [verifying, setVerifying] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Fetch Bills from Zoho
  const [fetchStep, setFetchStep] = useState<"idle" | "fetching" | "selecting" | "importing">("idle");
  const [fetchProgress, setFetchProgress] = useState("");
  const [billPreviews, setBillPreviews] = useState<ZohoBillPreview[]>([]);
  const [selectedBills, setSelectedBills] = useState<Set<string>>(new Set());
  const [fetchError, setFetchError] = useState("");
  const [fetchPullId, setFetchPullId] = useState("");
  const [billSearch, setBillSearch] = useState("");

  const fetchData = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "100" });
    const dateFrom = getDateFrom(dateFilter);
    if (dateFrom) params.set("dateFrom", dateFrom);

    fetch(`/api/inventory/inwards?${params}`)
      .then((r) => r.json())
      .then((res) => { if (res.success) setInwards(res.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [dateFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fetchWithTimeout = async (url: string, options?: RequestInit, timeoutMs = 20000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      return res;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") throw new Error("Request timed out — Zoho may be slow, try again");
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

      const searchTerm = billSearch.trim();
      setFetchProgress(searchTerm ? `Searching "${searchTerm}" in Zoho...` : "Pulling bills from Zoho (last 24h)...");
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const billRes = await fetchWithTimeout("/api/zoho/trigger-pull", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: "bills", pullId,
          ...(searchTerm ? { searchText: searchTerm } : { fromDate: yesterday }),
        }),
      }, 30000).then(r => r.json());
      if (!billRes.success) throw new Error(billRes.error || "Bills fetch failed");

      const src = billRes.data.source === "inventory" ? "Zoho Inventory" : billRes.data.source === "pos" ? "Zakya" : "Zoho Books";
      const billsFound = billRes.data.billsNew || 0;
      setFetchProgress(`Found ${billsFound} new bills from ${src}, saving...`);

      // Finalize — create pull log (check response!)
      const finalizeRes = await fetchWithTimeout("/api/zoho/trigger-pull", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: "finalize", pullId,
          billsNew: billRes.data.billsNew, apiCalls: billRes.data.apiCalls,
          allErrors: billRes.data.errors || [],
        }),
      }).then(r => r.json());
      if (!finalizeRes.success) {
        console.warn("Finalize failed:", finalizeRes.error);
        // Continue anyway — pull-review can find previews without pullLog
      }

      setFetchProgress("Loading preview...");
      const previewRes = await fetchWithTimeout(`/api/zoho/pull-review?pullId=${pullId}`).then(r => r.json());
      if (!previewRes.success) throw new Error(previewRes.error || "Failed to load preview");
      const billItems = (previewRes.data.previews || []).filter(
        (p: ZohoBillPreview & { entityType: string; status: string }) => p.entityType === "bill" && p.status === "PENDING"
      );
      setBillPreviews(billItems);
      setSelectedBills(new Set(billItems.map((b: ZohoBillPreview) => b.id)));
      setFetchStep(billItems.length > 0 ? "selecting" : "idle");
      const billErrors = billRes.data.errors || [];
      if (billItems.length === 0) {
        const errDetail = billErrors.length > 0 ? `: ${billErrors.join("; ")}` : "";
        const debugInfo = billsFound > 0 ? ` (${billsFound} found from API but 0 in preview — check finalize)` : "";
        setFetchError(`No new bills found (${src})${errDetail}${debugInfo}`);
      } else if (billErrors.length > 0) {
        setFetchError(`Warnings: ${billErrors.join("; ")}`);
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
        }),
      }).then(r => r.json());
      if (!res.success) throw new Error(res.error || "Import failed");
      const imported = res.data?.bills || 0;
      const errors = res.data?.errors || [];
      setFetchStep("idle");
      setBillPreviews([]);
      setSelectedBills(new Set());
      fetchData();
      if (errors.length > 0) {
        setFetchError(`Imported ${imported} bill(s). Warnings: ${errors.join("; ")}`);
      }
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "Import failed");
      setFetchStep("selecting");
    }
  };

  const filtered = inwards.filter((t) => {
    if (sourceFilter === "manual" && isZoho(t.notes)) return false;
    if (sourceFilter === "zoho" && !isZoho(t.notes)) return false;
    if (sourceFilter === "unverified" && !(isZoho(t.notes) && !isVerified(t.notes))) return false;
    if (search && !fuzzySearchFields(search, [t.product.name, t.product.sku, t.referenceNo, t.product.brand?.name, t.product.size])) return false;
    return true;
  });

  const totalQty = filtered.reduce((sum, t) => sum + t.quantity, 0);
  const unverifiedCount = inwards.filter((t) => isZoho(t.notes) && !isVerified(t.notes)).length;

  // Group by invoice (referenceNo) then by brand
  type GroupedInwards = { ref: string; vendor: string; date: string; brands: { brand: string; items: InwardTransaction[] }[] };
  const grouped: GroupedInwards[] = [];
  const refMap = new Map<string, { vendor: string; date: string; brandMap: Map<string, InwardTransaction[]> }>();

  for (const t of filtered) {
    const ref = t.referenceNo || "No Reference";
    const brand = t.product.brand?.name || "Unbranded";
    if (!refMap.has(ref)) {
      refMap.set(ref, { vendor: getVendor(t.notes), date: new Date(t.createdAt).toLocaleDateString("en-IN"), brandMap: new Map() });
    }
    const entry = refMap.get(ref)!;
    if (!entry.brandMap.has(brand)) entry.brandMap.set(brand, []);
    entry.brandMap.get(brand)!.push(t);
  }

  for (const [ref, { vendor, date, brandMap }] of refMap) {
    const brands = Array.from(brandMap.entries()).map(([brand, items]) => ({ brand, items }));
    grouped.push({ ref, vendor, date, brands });
  }

  async function handleVerify(id: string) {
    setVerifying(id);
    try {
      const res = await fetch("/api/inventory/inwards/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId: id }),
      });
      const data = await res.json();
      if (data.success) {
        setInwards((prev) =>
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
          <h1 className="text-lg font-bold text-slate-900">Inwards</h1>
          <p className="text-sm text-slate-500">{filtered.length} entries | {totalQty} units</p>
        </div>
        <div className="flex items-center gap-2">
          {canFetchBills && (
            <div className="flex items-center gap-1">
              <input
                type="text" placeholder="Bill no..." value={billSearch}
                onChange={(e) => setBillSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleFetchBills()}
                className="w-20 px-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400"
              />
              <button onClick={handleFetchBills} disabled={fetchStep === "fetching" || fetchStep === "importing"}
                className="flex items-center gap-1.5 bg-slate-900 text-white px-3 py-2 rounded-lg text-xs font-medium disabled:opacity-50">
                {fetchStep === "fetching" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Cloud className="h-3.5 w-3.5" />}
                {fetchStep === "fetching" ? "Fetching..." : billSearch.trim() ? "Search" : "Fetch Bills"}
              </button>
            </div>
          )}
          <ExportButtons
            onExcel={() => exportToExcel(filtered as unknown as Record<string, unknown>[], INWARD_COLUMNS, "inwards")}
            onPDF={() => exportToPDF("Inwards Report", filtered as unknown as Record<string, unknown>[], INWARD_COLUMNS, "inwards")}
          />
        </div>
      </div>

      {/* Progress Banner */}
      {fetchStep === "fetching" && fetchProgress && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg p-2.5 mb-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600 shrink-0" />
          <span className="text-xs text-blue-700 font-medium">{fetchProgress}</span>
        </div>
      )}

      {/* Fetch Error */}
      {fetchError && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 mb-2 text-xs text-amber-700">
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
                {billPreviews.length} new bill{billPreviews.length !== 1 ? "s" : ""} from Zoho (this month)
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
                      <span className="text-xs font-semibold text-slate-700">{formatCurrency(bill.data.total)}</span>
                    </div>
                    <p className="text-[10px] text-slate-600">{bill.data.vendorName}</p>
                    {bill.data.lineItems.length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        {bill.data.lineItems.map((li, idx) => (
                          <p key={idx} className="text-[10px] text-slate-500">
                            {li.name} — {li.sku || "no SKU"} × {li.quantity} @ ₹{li.rate.toLocaleString("en-IN")}
                          </p>
                        ))}
                      </div>
                    )}
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
          <span className="text-xs text-blue-700 font-medium">Importing bills & creating inward entries...</span>
        </div>
      )}

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search product, SKU, or bill no..."
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
          { key: "zoho", label: "Zoho Bills" },
          { key: "unverified", label: `Unverified${unverifiedCount > 0 ? ` (${unverifiedCount})` : ""}` },
        ] as { key: SourceFilter; label: string }[]).map((chip) => (
          <button key={chip.key} onClick={() => setSourceFilter(chip.key)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              sourceFilter === chip.key
                ? chip.key === "unverified" ? "bg-amber-500 text-white" : "bg-blue-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}>{chip.label}</button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {dateFilter === "today" ? "Today's" : dateFilter === "week" ? "This Week's" : dateFilter === "month" ? "This Month's" : "All"} Inwards
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
            <p className="text-sm text-slate-400 text-center py-6">No inwards found</p>
          ) : (
            grouped.map((group) => {
              const isExpanded = expandedGroups.has(group.ref);
              const totalItems = group.brands.reduce((sum, bg) => sum + bg.items.length, 0);
              const totalQtyGroup = group.brands.reduce((sum, bg) => sum + bg.items.reduce((s, t) => s + t.quantity, 0), 0);
              const hasUnverified = group.brands.some(bg => bg.items.some(t => isZoho(t.notes) && !isVerified(t.notes)));

              return (
                <div key={group.ref} className="mb-1 last:mb-0">
                  {/* Collapsible Invoice Header */}
                  <button
                    onClick={() => setExpandedGroups(prev => {
                      const next = new Set(prev);
                      next.has(group.ref) ? next.delete(group.ref) : next.add(group.ref);
                      return next;
                    })}
                    className="w-full flex items-center gap-2 px-2 py-2.5 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <ChevronRight className={`h-4 w-4 text-slate-400 shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {group.ref === "No Reference" ? "Manual Entry" : `Bill: ${group.ref}`}
                      </p>
                      <p className="text-[10px] text-slate-500 truncate">
                        {group.vendor || "—"} · {group.date}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {hasUnverified && <Badge variant="warning" className="text-[9px] px-1.5 py-0">Pending</Badge>}
                      <span className="text-xs font-semibold text-blue-600">+{totalQtyGroup}</span>
                      <span className="text-[10px] text-slate-400">{totalItems} items</span>
                    </div>
                  </button>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="ml-2 border-l-2 border-slate-200 pl-2 mt-1">
                      {group.brands.map((bg) => (
                        <div key={bg.brand}>
                          {group.brands.length > 1 && (
                            <div className="px-1 py-1 bg-slate-50 rounded">
                              <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">{bg.brand}</span>
                            </div>
                          )}
                          {bg.items.map((t) => {
                            const zoho = isZoho(t.notes);
                            const verified = isVerified(t.notes);

                            const unverified = zoho && !verified;
                            const aging = unverified ? getAging(t.createdAt) : null;

                            return (
                              <div key={t.id} className={`border-b border-slate-100 last:border-0 ${aging ? AGING_COLORS[aging.level] : ""}`}>
                                <div className="flex items-center gap-3 py-2">
                                  <div className={`rounded-full p-1.5 ${zoho ? "bg-blue-50" : "bg-blue-50"}`}>
                                    {zoho ? (
                                      <Cloud className="h-3.5 w-3.5 text-blue-500" />
                                    ) : (
                                      <ArrowDownCircle className="h-3.5 w-3.5 text-blue-600" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-slate-900">{t.product.name}</p>
                                    <p className="text-xs text-slate-500">
                                      {t.product.sku}
                                      {t.product.brand?.name ? ` | ${t.product.brand.name}` : ""}
                                    </p>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <p className="text-sm font-semibold text-blue-600">+{t.quantity}</p>
                                    <p className="text-xs text-slate-400">{formatTime(t.createdAt)}</p>
                                    {aging && aging.level !== "ok" && (
                                      <span className={`inline-block mt-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded-full ${AGING_BADGE[aging.level]}`}>
                                        {aging.text}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {zoho && (
                                  <div className="flex items-center justify-between pb-2 pl-10">
                                    {verified ? (
                                      <Badge variant="success" className="text-[10px]">
                                        <CheckCircle2 className="h-3 w-3 mr-0.5" /> Verified & Stocked
                                      </Badge>
                                    ) : (
                                      <Badge variant="warning" className="text-[10px]">Pending Receipt</Badge>
                                    )}
                                    {!verified && (
                                      <Button size="sm" variant="outline"
                                        className="h-6 text-[10px] text-green-600 border-green-200 hover:bg-green-50"
                                        onClick={(e) => { e.stopPropagation(); handleVerify(t.id); }}
                                        disabled={verifying === t.id}>
                                        {verifying === t.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Confirm Receipt"}
                                      </Button>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Admin, Supervisor, and Inwards Clerk can manually add inward */}
      {canAddInward && (
        <Link
          href="/inwards/new"
          className="fixed bottom-20 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 active:scale-95 transition-transform"
        >
          <Plus className="h-6 w-6" />
        </Link>
      )}
    </div>
  );
}
