"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Search, Loader2, Cloud, Download, Truck, AlertTriangle, CheckCircle2,
  Clock, Package, Flag, Trash2, Phone,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useDebounce, getAging, AGING_COLORS, AGING_BADGE } from "@/lib/utils";

interface DeliveryItem {
  id: string;
  invoiceNo: string;
  invoiceDate: string;
  invoiceAmount: number;
  customerName: string;
  customerPhone: string | null;
  customerArea: string | null;
  status: string;
  scheduledDate: string | null;
  lineItems: Array<{ name: string; quantity: number; rate?: number }> | null;
  flagReason: string | null;
  prebookNotes: string | null;
  verifiedBy: { name: string } | null;
  salesPerson: string | null;
  isOutstation: boolean;
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

interface ZohoSearchResult {
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  phone: string;
  date: string;
  total: number;
  balance: number;
  status: string;
  alreadyImported: boolean;
}

const STATUS_CONFIG: Record<string, { label: string; variant: string; icon: typeof Truck }> = {
  PENDING: { label: "Pending", variant: "warning", icon: Clock },
  VERIFIED: { label: "Verified", variant: "info", icon: CheckCircle2 },
  WALK_OUT: { label: "Walk-out", variant: "success", icon: CheckCircle2 },
  SCHEDULED: { label: "Scheduled", variant: "info", icon: Clock },
  OUT_FOR_DELIVERY: { label: "Out", variant: "info", icon: Truck },
  DELIVERED: { label: "Delivered", variant: "success", icon: CheckCircle2 },
  FLAGGED: { label: "Flagged", variant: "danger", icon: Flag },
  PREBOOKED: { label: "Prebooked", variant: "default", icon: Package },
};

function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

interface ZohoInvoicePreview {
  id: string;
  zohoId: string;
  data: {
    invoiceNumber: string;
    customerName: string;
    phone: string;
    date: string;
    total: number;
    balance: number;
    status: string;
    salesPerson: string;
    lineItems: Array<{ name: string; sku: string; quantity: number; rate: number; itemTotal: number }>;
  };
}

export default function DeliveriesPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role || "";
  const canFetchInvoices = ["ADMIN", "SUPERVISOR", "ACCOUNTS_MANAGER", "OUTWARDS_CLERK"].includes(role);
  const isAdmin = role === "ADMIN";

  const [deliveries, setDeliveries] = useState<DeliveryItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("PENDING");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);

  // Quick Search (invoice number / phone)
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [searchStep, setSearchStep] = useState<"idle" | "searching" | "results" | "importing">("idle");
  const [searchResults, setSearchResults] = useState<ZohoSearchResult[]>([]);
  const [selectedResults, setSelectedResults] = useState<Set<string>>(new Set());
  const [searchError, setSearchError] = useState("");
  const [searchProgress, setSearchProgress] = useState("");

  // Bulk Fetch (last 24h — existing flow)
  const [fetchStep, setFetchStep] = useState<"idle" | "fetching" | "selecting" | "importing">("idle");
  const [invoicePreviews, setInvoicePreviews] = useState<ZohoInvoicePreview[]>([]);
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
  const [fetchError, setFetchError] = useState("");
  const [fetchPullId, setFetchPullId] = useState("");
  const [fetchProgress, setFetchProgress] = useState("");

  const [deleting, setDeleting] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showOutstation, setShowOutstation] = useState(false);
  const [dateRange, setDateRange] = useState<string>("all");
  const [editingDateId, setEditingDateId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");

  const fetchData = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter !== "ALL") params.set("status", filter);
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (showOutstation) params.set("outstation", "true");
    if (dateRange !== "all") params.set("dateRange", dateRange);
    params.set("limit", "100");

    Promise.all([
      fetch(`/api/deliveries?${params}`).then((r) => r.json()),
      fetch("/api/deliveries/stats").then((r) => r.json()),
    ])
      .then(([listRes, statsRes]) => {
        if (listRes.success) setDeliveries(listRes.data);
        if (statsRes.success) setStats(statsRes.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filter, debouncedSearch, showOutstation, dateRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleVerify = async (id: string) => {
    await fetch(`/api/deliveries/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "VERIFIED" }),
    });
    fetchData();
  };

  const handleFlag = async (id: string) => {
    const reason = prompt("Flag reason:");
    if (!reason) return;
    const res = await fetch(`/api/deliveries/${id}/flag`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const data = await res.json();
    if (data.success && data.data.alertPhones?.length > 0) {
      const msg = data.data.whatsappMessage;
      const phone = data.data.alertPhones[0].replace(/\D/g, "");
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
    }
    fetchData();
  };

  const handleWalkOut = async (id: string) => {
    if (!confirm("Mark as walk-out? Stock will be deducted.")) return;
    await fetch(`/api/deliveries/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "WALK_OUT" }),
    });
    fetchData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this delivery entry?")) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/deliveries/${id}`, { method: "DELETE" }).then(r => r.json());
      if (!res.success) throw new Error(res.error || "Delete failed");
      fetchData();
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "Delete failed");
    } finally { setDeleting(null); }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ALL ${deliveries.length} deliveries in current view? This cannot be undone.`)) return;
    setBulkDeleting(true);
    setFetchError("");
    try {
      let deleted = 0;
      for (const d of deliveries) {
        const res = await fetch(`/api/deliveries/${d.id}`, { method: "DELETE" }).then(r => r.json());
        if (res.success) deleted++;
      }
      setFetchError(`Deleted ${deleted} of ${deliveries.length} deliveries`);
      fetchData();
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "Bulk delete failed");
    } finally { setBulkDeleting(false); }
  };

  const handleSaveDate = async (deliveryId: string) => {
    if (!editDate) return;
    try {
      await fetch(`/api/deliveries/${deliveryId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledDate: editDate }),
      });
      setEditingDateId(null);
      setEditDate("");
      fetchData();
    } catch { /* */ }
  };

  // ─── QUICK SEARCH (invoice no / phone → direct Zoho search, no pipeline) ───
  const handleQuickSearch = async () => {
    const q = invoiceSearch.trim();
    if (!q || q.length < 3) {
      setSearchError("Enter at least 3 characters");
      return;
    }

    setSearchStep("searching");
    setSearchError("");
    setSearchProgress(`Searching Zoho for "${q}"...`);
    try {
      const res = await fetch("/api/deliveries/search-zoho", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text.startsWith("{") ? JSON.parse(text).error : `Server error (${res.status}). Try again.`);
      }

      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Search failed");

      const results: ZohoSearchResult[] = data.data.results || [];
      setSearchResults(results);

      const newOnes = results.filter((r) => !r.alreadyImported);
      setSelectedResults(new Set(newOnes.map((r) => r.invoiceId)));
      setSearchStep(results.length > 0 ? "results" : "idle");

      if (results.length === 0) {
        setSearchError(`No invoices found for "${q}"`);
      } else if (newOnes.length === 0) {
        setSearchError(`Found ${results.length} invoice(s) — all already imported`);
        setSearchStep("results"); // Still show results
      }
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : "Search failed");
      setSearchStep("idle");
    } finally {
      setSearchProgress("");
    }
  };

  const handleImportSearchResults = async () => {
    if (selectedResults.size === 0) return;
    setSearchStep("importing");
    setSearchError("");
    setSearchProgress(`Importing ${selectedResults.size} invoice(s)...`);
    try {
      const res = await fetch("/api/deliveries/import-zoho", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceIds: Array.from(selectedResults) }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text.startsWith("{") ? JSON.parse(text).error : `Server error (${res.status})`);
      }

      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Import failed");

      const { imported, errors } = data.data;
      setSearchStep("idle");
      setSearchResults([]);
      setSelectedResults(new Set());
      setInvoiceSearch("");

      if (errors && errors.length > 0) {
        setSearchError(`Imported ${imported}. Issues: ${errors.join(", ")}`);
      }
      fetchData();
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : "Import failed");
      setSearchStep("results");
    } finally {
      setSearchProgress("");
    }
  };

  // ─── BULK FETCH (last 24h, existing pipeline) ───
  const handleFetchInvoices = async () => {
    setFetchStep("fetching");
    setFetchError("");
    setFetchProgress("Connecting to Zoho...");
    try {
      const initRes = await fetch("/api/zoho/trigger-pull", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "init" }),
      });
      if (!initRes.ok) throw new Error(`Connection failed (${initRes.status})`);
      const initData = await initRes.json();
      if (!initData.success) throw new Error(initData.error || "Init failed");
      const pullId = initData.data.pullId;
      setFetchPullId(pullId);

      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      setFetchProgress("Pulling invoices (last 24h)...");
      const invRes = await fetch("/api/zoho/trigger-pull", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "invoices", pullId, fromDate: yesterday }),
      });
      if (!invRes.ok) throw new Error(`Fetch failed (${invRes.status}). Try again.`);
      const invData = await invRes.json();
      if (!invData.success) throw new Error(invData.error || "Invoice fetch failed");

      const invFound = invData.data.invoicesNew || 0;
      setFetchProgress(`Found ${invFound} invoice${invFound !== 1 ? "s" : ""}. Finalizing...`);
      await fetch("/api/zoho/trigger-pull", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: "finalize", pullId,
          invoicesNew: invData.data.invoicesNew, apiCalls: invData.data.apiCalls,
          allErrors: invData.data.errors || [],
        }),
      }).catch(() => {});

      setFetchProgress("Loading preview...");
      const previewRes = await fetch(`/api/zoho/pull-review?pullId=${pullId}`).then(r => r.json());
      if (previewRes.success) {
        const invoices = (previewRes.data.previews || []).filter(
          (p: ZohoInvoicePreview & { entityType: string; status: string }) => p.entityType === "invoice" && p.status === "PENDING"
        );
        setInvoicePreviews(invoices);
        setSelectedInvoices(new Set(invoices.map((inv: ZohoInvoicePreview) => inv.id)));
        setFetchStep(invoices.length > 0 ? "selecting" : "idle");
        if (invoices.length === 0) {
          setFetchError(invFound > 0 ? `${invFound} found but already imported` : "No new invoices found (last 24h)");
        }
      }
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "Fetch failed");
      setFetchStep("idle");
    } finally {
      setFetchProgress("");
    }
  };

  const toggleInvoice = (id: string) => {
    setSelectedInvoices(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleImportSelected = async () => {
    if (selectedInvoices.size === 0) return;
    setFetchStep("importing");
    try {
      const res = await fetch("/api/zoho/pull-review/approve", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pullId: fetchPullId, action: "approve",
          entityType: "invoice", previewIds: Array.from(selectedInvoices),
        }),
      }).then(r => r.json());
      if (!res.success) throw new Error(res.error || "Import failed");
      setFetchStep("idle");
      setInvoicePreviews([]);
      setSelectedInvoices(new Set());
      fetchData();
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "Import failed");
      setFetchStep("selecting");
    }
  };

  const FILTERS = [
    { key: "PENDING", label: "Pending", count: stats?.pending },
    { key: "VERIFIED", label: "Verified", count: stats?.verified },
    { key: "SCHEDULED", label: "Scheduled", count: stats?.scheduled },
    { key: "OUT_FOR_DELIVERY", label: "Out", count: stats?.outForDelivery },
    { key: "DELIVERED", label: "Delivered", count: stats?.deliveredToday },
    { key: "FLAGGED", label: "Flagged", count: stats?.flagged },
    { key: "PREBOOKED", label: "Prebooked", count: stats?.prebooked },
  ];

  const isPhone = /^\d{10,}$/.test(invoiceSearch.trim());

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-bold text-slate-900">Deliveries</h1>
        <div className="flex items-center gap-1">
          {isAdmin && deliveries.length > 0 && (
            <button onClick={handleBulkDelete} disabled={bulkDeleting}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium bg-red-100 text-red-600 hover:bg-red-200 disabled:opacity-50">
              {bulkDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              {bulkDeleting ? "..." : `Del (${deliveries.length})`}
            </button>
          )}
          {canFetchInvoices && (
            <>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Invoice / Phone..."
                  value={invoiceSearch}
                  onChange={(e) => setInvoiceSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleQuickSearch()}
                  className="w-28 px-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400 pr-6"
                />
                {isPhone && (
                  <Phone className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-green-500" />
                )}
              </div>
              <button onClick={handleQuickSearch}
                disabled={searchStep === "searching" || searchStep === "importing"}
                className="flex items-center gap-1 bg-slate-900 text-white px-2.5 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50">
                {searchStep === "searching" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                Search
              </button>
              <button onClick={handleFetchInvoices}
                disabled={fetchStep === "fetching" || fetchStep === "importing"}
                className="flex items-center gap-1 bg-slate-700 text-white px-2.5 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
                title="Fetch all invoices from last 24 hours">
                {fetchStep === "fetching" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Cloud className="h-3.5 w-3.5" />}
                Fetch
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stats Row */}
      {stats && (
        <div className="grid grid-cols-4 gap-1.5 mb-3">
          <Card className="bg-amber-50 border-amber-200"><CardContent className="p-2 text-center">
            <p className="text-lg font-bold text-amber-700">{stats.pending}</p>
            <p className="text-[9px] text-amber-600">Pending</p>
          </CardContent></Card>
          <Card className="bg-blue-50 border-blue-200"><CardContent className="p-2 text-center">
            <p className="text-lg font-bold text-blue-700">{stats.scheduled}</p>
            <p className="text-[9px] text-blue-600">Scheduled</p>
          </CardContent></Card>
          <Card className="bg-orange-50 border-orange-200"><CardContent className="p-2 text-center">
            <p className="text-lg font-bold text-orange-700">{stats.outForDelivery}</p>
            <p className="text-[9px] text-orange-600">Out</p>
          </CardContent></Card>
          <Card className="bg-green-50 border-green-200"><CardContent className="p-2 text-center">
            <p className="text-lg font-bold text-green-700">{stats.deliveredToday}</p>
            <p className="text-[9px] text-green-600">Delivered</p>
          </CardContent></Card>
        </div>
      )}

      {/* Filter Chips */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide mb-2 pb-1">
        {FILTERS.map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`shrink-0 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === f.key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
            }`}>
            {f.label}{f.count !== undefined && f.count > 0 ? ` (${f.count})` : ""}
          </button>
        ))}
      </div>

      {/* Outstation Filter */}
      <div className="flex gap-1.5 mb-2">
        <button onClick={() => setShowOutstation(!showOutstation)}
          className={`shrink-0 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
            showOutstation ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-600"
          }`}>
          Outstation
        </button>
      </div>

      {/* Date Range Filter */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide mb-2 pb-1">
        {[
          { key: "all", label: "All Dates" },
          { key: "today", label: "Today" },
          { key: "tomorrow", label: "Tomorrow" },
          { key: "3days", label: "3 Days" },
          { key: "week", label: "This Week" },
          { key: "month", label: "This Month" },
        ].map((chip) => (
          <button key={chip.key} onClick={() => setDateRange(chip.key)}
            className={`shrink-0 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
              dateRange === chip.key ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"
            }`}>
            {chip.label}
          </button>
        ))}
      </div>

      {/* Local search */}
      <div className="relative mb-2">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input placeholder="Search invoice, customer..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* ─── Quick Search Progress ─── */}
      {searchStep === "searching" && searchProgress && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg p-2.5 mb-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600 shrink-0" />
          <span className="text-xs text-blue-700 font-medium">{searchProgress}</span>
        </div>
      )}

      {/* ─── Quick Search Results ─── */}
      {searchStep === "results" && searchResults.length > 0 && (
        <Card className="mb-3 border-blue-200 bg-blue-50/50">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-blue-800">
                {searchResults.length} invoice{searchResults.length !== 1 ? "s" : ""} found in Zoho
              </p>
              <div className="flex gap-2">
                <button onClick={() => { setSearchStep("idle"); setSearchResults([]); }}
                  className="text-xs text-slate-500 underline">Close</button>
                {selectedResults.size > 0 && (
                  <button onClick={handleImportSearchResults}
                    className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-md text-xs font-medium">
                    <Download className="h-3 w-3" /> Import {selectedResults.size}
                  </button>
                )}
              </div>
            </div>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {searchResults.map((r) => (
                <label key={r.invoiceId}
                  className={`flex items-start gap-2 p-2 rounded-lg transition-colors ${
                    r.alreadyImported
                      ? "bg-slate-100 border border-slate-200 opacity-60"
                      : selectedResults.has(r.invoiceId)
                        ? "bg-blue-100 border border-blue-300 cursor-pointer"
                        : "bg-white border border-slate-200 cursor-pointer"
                  }`}>
                  {!r.alreadyImported && (
                    <input type="checkbox" checked={selectedResults.has(r.invoiceId)}
                      onChange={() => setSelectedResults(prev => {
                        const next = new Set(prev);
                        next.has(r.invoiceId) ? next.delete(r.invoiceId) : next.add(r.invoiceId);
                        return next;
                      })} className="mt-0.5 rounded" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-900">{r.invoiceNumber}</span>
                      <span className="text-xs font-semibold text-slate-700">{formatINR(r.total)}</span>
                    </div>
                    <p className="text-[10px] text-slate-600">
                      {r.customerName}
                      {r.phone ? ` | ${r.phone}` : ""}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {r.date} | {r.status}
                      {r.alreadyImported && <span className="text-green-600 font-medium ml-1">Already imported</span>}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Quick Search Importing ─── */}
      {searchStep === "importing" && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg p-2.5 mb-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600 shrink-0" />
          <span className="text-xs text-blue-700 font-medium">{searchProgress || "Importing..."}</span>
        </div>
      )}

      {/* Search Error */}
      {searchError && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 mb-2 text-xs text-amber-700">
          {searchError}
          <button onClick={() => setSearchError("")} className="ml-2 underline">dismiss</button>
        </div>
      )}

      {/* ─── Bulk Fetch Progress ─── */}
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

      {/* Invoice Selection Panel (bulk fetch) */}
      {fetchStep === "selecting" && invoicePreviews.length > 0 && (
        <Card className="mb-3 border-blue-200 bg-blue-50/50">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-blue-800">
                {invoicePreviews.length} new invoice{invoicePreviews.length !== 1 ? "s" : ""} from Zoho
              </p>
              <div className="flex gap-2">
                <button onClick={() => { setFetchStep("idle"); setInvoicePreviews([]); }}
                  className="text-xs text-slate-500 underline">Cancel</button>
                <button onClick={handleImportSelected} disabled={selectedInvoices.size === 0}
                  className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-md text-xs font-medium disabled:opacity-50">
                  <Download className="h-3 w-3" /> Import {selectedInvoices.size}
                </button>
              </div>
            </div>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {invoicePreviews.map((inv) => (
                <label key={inv.id}
                  className={`flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                    selectedInvoices.has(inv.id) ? "bg-blue-100 border border-blue-300" : "bg-white border border-slate-200"
                  }`}>
                  <input type="checkbox" checked={selectedInvoices.has(inv.id)}
                    onChange={() => toggleInvoice(inv.id)} className="mt-0.5 rounded" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-900">{inv.data.invoiceNumber}</span>
                      <span className="text-xs font-semibold text-slate-700">{formatINR(inv.data.total)}</span>
                    </div>
                    <p className="text-[10px] text-slate-600">{inv.data.customerName}</p>
                    {inv.data.lineItems.length > 0 && (
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {inv.data.lineItems.slice(0, 2).map(li => `${li.name} x${li.quantity}`).join(" | ")}
                        {inv.data.lineItems.length > 2 && ` +${inv.data.lineItems.length - 2}`}
                      </p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Importing indicator (bulk fetch) */}
      {fetchStep === "importing" && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
          <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
          <span className="text-xs text-blue-700">Importing {selectedInvoices.size} invoices...</span>
        </div>
      )}

      {/* Delivery Cards */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      ) : deliveries.length === 0 ? (
        <div className="text-center py-12">
          <Truck className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-400">No deliveries found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {deliveries.map((d) => {
            const cfg = STATUS_CONFIG[d.status] || STATUS_CONFIG.PENDING;
            const items = d.lineItems || [];
            const isPending = ["PENDING", "VERIFIED", "SCHEDULED"].includes(d.status);
            const aging = isPending ? getAging(d.invoiceDate) : null;
            return (
              <Card key={d.id} className={aging ? AGING_COLORS[aging.level] : ""}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between mb-1.5">
                    <div className="flex-1 min-w-0 mr-2">
                      <Link href={`/deliveries/${d.id}`}>
                        <p className="text-sm font-semibold text-slate-900">{d.invoiceNo}</p>
                      </Link>
                      <p className="text-xs text-slate-600">{d.customerName}</p>
                      {d.salesPerson && (
                        <p className="text-[10px] text-purple-600">Sales: {d.salesPerson}</p>
                      )}
                      <p className="text-[10px] text-slate-400">
                        {formatINR(d.invoiceAmount)} | {new Date(d.invoiceDate).toLocaleDateString("en-IN")}
                      </p>
                    </div>
                    <div className="text-right space-y-1">
                      <Badge variant={cfg.variant as "warning" | "info" | "success" | "danger" | "default"}>
                        {cfg.label}
                      </Badge>
                      {d.isOutstation && (
                        <Badge variant={"warning"} className="text-[9px]">Outstation</Badge>
                      )}
                      {aging && aging.level !== "ok" && (
                        <span className={`block text-[9px] font-medium px-1.5 py-0.5 rounded-full ${AGING_BADGE[aging.level]}`}>
                          {aging.text}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Line items preview */}
                  {items.length > 0 && (
                    <div className="text-[10px] text-slate-500 mb-1.5">
                      {items.slice(0, 2).map((item, i) => (
                        <span key={i}>{item.name} x{item.quantity}{i < Math.min(items.length, 2) - 1 ? " | " : ""}</span>
                      ))}
                      {items.length > 2 && <span className="text-slate-400"> +{items.length - 2} more</span>}
                    </div>
                  )}

                  {/* Scheduled info / inline date editor */}
                  {d.scheduledDate && editingDateId !== d.id && (
                    <p className="text-[10px] text-blue-600 mb-1.5 cursor-pointer" onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setEditDate(d.scheduledDate!.slice(0, 10));
                      setEditingDateId(d.id);
                    }}>
                      Delivery: {new Date(d.scheduledDate).toLocaleDateString("en-IN")}
                      {d.customerArea && ` | ${d.customerArea}`}
                      <span className="text-blue-400 ml-1">tap to change</span>
                    </p>
                  )}
                  {editingDateId === d.id && (
                    <div className="space-y-1.5 mb-1.5" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-wrap gap-1">
                        {[
                          { label: "Today", days: 0 },
                          { label: "Tomorrow", days: 1 },
                          { label: "3 days", days: 3 },
                          { label: "1 week", days: 7 },
                          { label: "1 month", days: 30 },
                        ].map((opt) => {
                          const d2 = new Date();
                          d2.setDate(d2.getDate() + opt.days);
                          const val = d2.toISOString().slice(0, 10);
                          return (
                            <button key={opt.label} onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditDate(val); }}
                              className={`px-2 py-1 rounded-full text-[10px] font-medium transition-colors ${
                                editDate === val ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"
                              }`}>
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                      {editDate && (
                        <p className="text-[10px] text-blue-600">
                          {new Date(editDate).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                        </p>
                      )}
                      <div className="flex gap-1.5">
                        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSaveDate(d.id); }}
                          disabled={!editDate}
                          className="bg-blue-600 text-white px-2.5 py-1 rounded-md text-[10px] font-medium disabled:opacity-50">Save</button>
                        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditingDateId(null); }}
                          className="text-slate-400 text-[10px]">Cancel</button>
                      </div>
                    </div>
                  )}

                  {/* Set date for cards without one */}
                  {!d.scheduledDate && ["VERIFIED", "SCHEDULED"].includes(d.status) && editingDateId !== d.id && (
                    <button onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const tomorrow = new Date();
                      tomorrow.setDate(tomorrow.getDate() + 1);
                      setEditDate(tomorrow.toISOString().slice(0, 10));
                      setEditingDateId(d.id);
                    }} className="text-[10px] text-blue-500 mb-1.5">
                      + Set delivery date
                    </button>
                  )}

                  {/* Flag reason */}
                  {d.status === "FLAGGED" && d.flagReason && (
                    <div className="bg-red-50 rounded p-1.5 mb-1.5">
                      <p className="text-[10px] text-red-600"><AlertTriangle className="h-3 w-3 inline mr-1" />{d.flagReason}</p>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-2 mt-1">
                    {d.status === "PENDING" && (
                      <>
                        <button onClick={() => handleVerify(d.id)}
                          className="flex-1 bg-blue-600 text-white py-1.5 rounded-md text-xs font-medium">Verify</button>
                        <button onClick={() => handleFlag(d.id)}
                          className="bg-red-100 text-red-700 px-3 py-1.5 rounded-md text-xs font-medium">Flag</button>
                      </>
                    )}
                    {d.status === "VERIFIED" && (
                      <>
                        <button onClick={() => handleWalkOut(d.id)}
                          className="flex-1 bg-green-600 text-white py-1.5 rounded-md text-xs font-medium">Walk-out</button>
                        <Link href={`/deliveries/${d.id}`} className="flex-1">
                          <button className="w-full bg-blue-600 text-white py-1.5 rounded-md text-xs font-medium">Schedule</button>
                        </Link>
                      </>
                    )}
                    {d.status === "SCHEDULED" && (
                      <Link href="/deliveries/dispatch" className="flex-1">
                        <button className="w-full bg-orange-600 text-white py-1.5 rounded-md text-xs font-medium">Go to Dispatch</button>
                      </Link>
                    )}
                    {d.status === "PREBOOKED" && (
                      <button onClick={() => handleVerify(d.id)}
                        className="flex-1 bg-blue-600 text-white py-1.5 rounded-md text-xs font-medium">Mark Ready</button>
                    )}
                    {role === "ADMIN" && (
                      <button onClick={() => handleDelete(d.id)} disabled={deleting === d.id}
                        className="bg-slate-100 text-slate-500 px-2 py-1.5 rounded-md text-xs hover:bg-red-50 hover:text-red-600 disabled:opacity-50">
                        {deleting === d.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                      </button>
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
