"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { FileText, AlertTriangle, Search, Plus, IndianRupee, Cloud, Loader2, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/lib/utils";

interface InvoiceItem {
  id: string;
  invoiceNo: string;
  amount: number;
  paidAmount: number;
  status: string;
  invoiceDate: string;
  dueDate: string;
  customer: { name: string; phone?: string };
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

const STATUS_FILTERS = ["ALL", "OVERDUE", "PENDING", "PARTIALLY_PAID", "PAID"];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}

export default function ReceivablesPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role || "";
  const canFetch = ["ADMIN", "SUPERVISOR", "ACCOUNTS_MANAGER"].includes(role);

  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);

  // Fetch Invoices state
  const [fetchStep, setFetchStep] = useState<"idle" | "fetching" | "selecting" | "importing">("idle");
  const [invoicePreviews, setInvoicePreviews] = useState<ZohoInvoicePreview[]>([]);
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
  const [fetchError, setFetchError] = useState("");
  const [fetchPullId, setFetchPullId] = useState("");

  // Summary stats
  const totalOutstanding = invoices.reduce((sum, inv) => sum + Math.max(0, inv.amount - inv.paidAmount), 0);
  const overdueCount = invoices.filter(
    (inv) => new Date(inv.dueDate) < new Date() && inv.amount - inv.paidAmount > 0
  ).length;

  const fetchData = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "50" });
    if (filter === "OVERDUE") {
      params.set("overdue", "true");
    } else if (filter !== "ALL") {
      params.set("status", filter);
    }
    if (debouncedSearch.length >= 2) params.set("search", debouncedSearch);

    fetch(`/api/customer-invoices?${params}`)
      .then((r) => r.json())
      .then((res) => { if (res.success) setInvoices(res.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filter, debouncedSearch]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleFetchInvoices = async () => {
    setFetchStep("fetching");
    setFetchError("");
    try {
      // Step 1: Init
      const initRes = await fetch("/api/zoho/trigger-pull", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "init" }),
      }).then(r => r.json());
      if (!initRes.success) throw new Error(initRes.error || "Init failed");
      const pullId = initRes.data.pullId;
      setFetchPullId(pullId);

      // Step 2: Pull invoices from April 1
      const invRes = await fetch("/api/zoho/trigger-pull", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "invoices", pullId, fromDate: "2026-04-01" }),
      }).then(r => r.json());
      if (!invRes.success) throw new Error(invRes.error || "Invoice fetch failed");

      // Step 3: Finalize
      await fetch("/api/zoho/trigger-pull", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: "finalize", pullId,
          invoicesNew: invRes.data.invoicesNew, apiCalls: invRes.data.apiCalls,
          allErrors: invRes.data.errors || [],
        }),
      });

      // Step 4: Load previews — filter for unpaid invoices
      const previewRes = await fetch(`/api/zoho/pull-review?pullId=${pullId}`).then(r => r.json());
      if (previewRes.success) {
        const invPreviews = (previewRes.data.previews || []).filter(
          (p: ZohoInvoicePreview & { entityType: string; status: string }) =>
            p.entityType === "invoice" && p.status === "PENDING" && (p.data.balance > 0)
        );
        setInvoicePreviews(invPreviews);
        setSelectedInvoices(new Set(invPreviews.map((inv: ZohoInvoicePreview) => inv.id)));
        setFetchStep(invPreviews.length > 0 ? "selecting" : "idle");
        if (invPreviews.length === 0) setFetchError("No unpaid invoices found from Apr 1");
      }
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "Fetch failed");
      setFetchStep("idle");
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
      // Import as customer invoices (receivables)
      const selected = invoicePreviews.filter(p => selectedInvoices.has(p.id));
      let imported = 0;

      for (const inv of selected) {
        // Create or find customer
        const custRes = await fetch("/api/customers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: inv.data.customerName, phone: inv.data.phone }),
        }).then(r => r.json());

        const customerId = custRes.success ? custRes.data.id : null;
        if (!customerId) continue;

        // Check if invoice already exists
        const existingRes = await fetch(`/api/customer-invoices?search=${encodeURIComponent(inv.data.invoiceNumber)}&limit=1`)
          .then(r => r.json());
        if (existingRes.success && existingRes.data.length > 0) continue;

        // Create customer invoice
        const dueDate = new Date(inv.data.date);
        dueDate.setDate(dueDate.getDate() + 30); // 30 day credit

        await fetch("/api/customer-invoices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerId,
            invoiceNo: inv.data.invoiceNumber,
            invoiceDate: inv.data.date,
            dueDate: dueDate.toISOString().slice(0, 10),
            amount: inv.data.total,
            notes: `Imported from Zoho. Balance: ₹${inv.data.balance}`,
          }),
        });
        imported++;
      }

      // Mark previews as approved
      await fetch("/api/zoho/pull-review/approve", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pullId: fetchPullId, action: "approve",
          entityType: "invoice", previewIds: Array.from(selectedInvoices),
        }),
      });

      setFetchStep("idle");
      setInvoicePreviews([]);
      setSelectedInvoices(new Set());
      fetchData();
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "Import failed");
      setFetchStep("selecting");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-bold text-slate-900">Receivables</h1>
        {canFetch && (
          <button onClick={handleFetchInvoices} disabled={fetchStep === "fetching" || fetchStep === "importing"}
            className="flex items-center gap-1.5 bg-slate-900 text-white px-3 py-2 rounded-lg text-xs font-medium disabled:opacity-50">
            {fetchStep === "fetching" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Cloud className="h-3.5 w-3.5" />}
            {fetchStep === "fetching" ? "Fetching..." : "Fetch Invoices"}
          </button>
        )}
      </div>

      {/* Fetch Error */}
      {fetchError && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 mb-2 text-xs text-amber-700">
          {fetchError}
          <button onClick={() => setFetchError("")} className="ml-2 underline">dismiss</button>
        </div>
      )}

      {/* Invoice Selection Panel */}
      {fetchStep === "selecting" && invoicePreviews.length > 0 && (
        <Card className="mb-3 border-blue-200 bg-blue-50/50">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-blue-800">
                {invoicePreviews.length} unpaid invoice{invoicePreviews.length !== 1 ? "s" : ""} from Zoho
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
                      <span className="text-xs font-semibold text-red-600">Due: {formatCurrency(inv.data.balance)}</span>
                    </div>
                    <p className="text-[10px] text-slate-600">{inv.data.customerName}</p>
                    <p className="text-[10px] text-slate-400">Total: {formatCurrency(inv.data.total)} | {new Date(inv.data.date).toLocaleDateString("en-IN")}</p>
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
          <span className="text-xs text-blue-700">Importing {selectedInvoices.size} invoices as receivables...</span>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <IndianRupee className="h-4 w-4 text-red-500" />
              <span className="text-xs text-slate-500">Total Outstanding</span>
            </div>
            <p className="text-lg font-bold text-red-600">{formatCurrency(totalOutstanding)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="text-xs text-slate-500">Overdue</span>
            </div>
            <p className="text-lg font-bold text-amber-600">{overdueCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search invoice or customer..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Status Filters */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-4 pb-1">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === s ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {s === "ALL" ? "All" : s.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {/* Invoice List */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-3 border border-slate-100 rounded-lg animate-pulse">
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 bg-slate-200 rounded w-3/4" />
                  <div className="h-3 bg-slate-200 rounded w-1/2" />
                </div>
                <div className="text-right space-y-1.5">
                  <div className="h-4 bg-slate-200 rounded w-16 ml-auto" />
                  <div className="h-5 w-14 bg-slate-200 rounded-full ml-auto" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {invoices.map((inv) => {
            const remaining = inv.amount - inv.paidAmount;
            const isOverdue = new Date(inv.dueDate) < new Date() && remaining > 0;
            return (
              <Link key={inv.id} href={`/receivables/${inv.id}`}>
                <Card className={`hover:border-slate-300 transition-colors mb-2 ${isOverdue ? "border-red-200 bg-red-50/30" : ""}`}>
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0 mr-3">
                        <div className="flex items-center gap-2">
                          {isOverdue && <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                          <p className="text-sm font-medium text-slate-900">{inv.customer.name}</p>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {inv.invoiceNo} | Due: {new Date(inv.dueDate).toLocaleDateString("en-IN")}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-bold ${remaining > 0 ? "text-red-600" : "text-green-600"}`}>
                          {formatCurrency(remaining)}
                        </p>
                        <Badge variant={inv.status === "PAID" ? "success" : isOverdue ? "danger" : "warning"} className="text-[10px]">
                          {isOverdue ? "OVERDUE" : inv.status.replace(/_/g, " ")}
                        </Badge>
                      </div>
                    </div>
                    {inv.paidAmount > 0 && remaining > 0 && (
                      <div className="mt-2">
                        <div className="w-full bg-slate-200 rounded-full h-1.5">
                          <div
                            className="bg-green-500 h-1.5 rounded-full"
                            style={{ width: `${Math.min(100, (inv.paidAmount / inv.amount) * 100)}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Paid {formatCurrency(inv.paidAmount)} of {formatCurrency(inv.amount)}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}

          {invoices.length === 0 && (
            <div className="text-center py-12">
              <FileText className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No invoices found</p>
            </div>
          )}
        </div>
      )}

      {/* Floating Action Button */}
      <Link
        href="/receivables/new"
        className="fixed bottom-20 right-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-3.5 shadow-lg z-50"
      >
        <Plus className="h-5 w-5" />
      </Link>
    </div>
  );
}
