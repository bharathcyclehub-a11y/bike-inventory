"use client";

import { useState, useCallback } from "react";
import { Cloud, Search, Download, Loader2, Phone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { BottomSheetModal } from "./bottom-sheet-modal";
import { ZohoImportResults, type ImportableInvoice } from "./zoho-import-results";

// ─── Zoho types (from original page) ───

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
  appStatus: string | null;
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
    lineItems: Array<{
      name: string;
      sku: string;
      quantity: number;
      rate: number;
      itemTotal: number;
    }>;
  };
}

type ImportTab = "search" | "fetch";

interface ZohoImportFlowProps {
  canFetch: boolean;
  onImported: () => void;
}

export function ZohoImportFlow({ canFetch, onImported }: ZohoImportFlowProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ImportTab>("search");

  // ─── Quick Search state ───
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [searchStep, setSearchStep] = useState<"idle" | "searching" | "results" | "importing">("idle");
  const [searchResults, setSearchResults] = useState<ZohoSearchResult[]>([]);
  const [selectedResults, setSelectedResults] = useState<Set<string>>(new Set());
  const [searchError, setSearchError] = useState("");
  const [searchProgress, setSearchProgress] = useState("");

  // ─── Bulk Fetch state ───
  const [fetchStep, setFetchStep] = useState<"idle" | "fetching" | "results" | "importing">("idle");
  const [invoicePreviews, setInvoicePreviews] = useState<ZohoInvoicePreview[]>([]);
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
  const [fetchError, setFetchError] = useState("");
  const [fetchPullId, setFetchPullId] = useState("");
  const [fetchProgress, setFetchProgress] = useState("");
  const [fetchDays, setFetchDays] = useState<number>(7);
  const [fetchCustomFrom, setFetchCustomFrom] = useState("");
  const [fetchCustomTo, setFetchCustomTo] = useState("");

  const isPhone = /^\d{10,}$/.test(invoiceSearch.trim());

  // ─── Quick Search handlers ───
  const handleQuickSearch = useCallback(async () => {
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
        throw new Error(
          text.startsWith("{")
            ? JSON.parse(text).error
            : `Server error (${res.status}). Try again.`
        );
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
        setSearchError(
          `Found ${results.length} invoice(s) -- all already imported`
        );
        setSearchStep("results");
      }
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : "Search failed");
      setSearchStep("idle");
    } finally {
      setSearchProgress("");
    }
  }, [invoiceSearch]);

  const handleImportSearchResults = useCallback(async () => {
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
        throw new Error(
          text.startsWith("{")
            ? JSON.parse(text).error
            : `Server error (${res.status})`
        );
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
      setSheetOpen(false);
      onImported();
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : "Import failed");
      setSearchStep("results");
    } finally {
      setSearchProgress("");
    }
  }, [selectedResults, onImported]);

  // ─── Bulk Fetch handlers ───
  const handleFetchInvoices = useCallback(async () => {
    setFetchStep("fetching");
    setFetchError("");
    setFetchProgress("Connecting to Zoho...");
    try {
      const initRes = await fetch("/api/zoho/trigger-pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "init" }),
      });
      if (!initRes.ok) throw new Error(`Connection failed (${initRes.status})`);
      const initData = await initRes.json();
      if (!initData.success)
        throw new Error(initData.error || "Init failed");
      const pullId = initData.data.pullId;
      setFetchPullId(pullId);

      let fromDate: string;
      if (fetchDays === -1 && fetchCustomFrom) {
        fromDate = fetchCustomFrom;
      } else {
        const fromDateObj = new Date();
        fromDateObj.setDate(fromDateObj.getDate() - fetchDays);
        fromDate = fromDateObj.toISOString().slice(0, 10);
      }
      const label =
        fetchDays === -1 ? "custom range" : `last ${fetchDays} days`;
      setFetchProgress(`Pulling invoices (${label})...`);
      const invRes = await fetch("/api/zoho/trigger-pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "invoices", pullId, fromDate }),
      });
      if (!invRes.ok)
        throw new Error(`Fetch failed (${invRes.status}). Try again.`);
      const invData = await invRes.json();
      if (!invData.success)
        throw new Error(invData.error || "Invoice fetch failed");

      const invFound = invData.data.invoicesNew || 0;
      setFetchProgress(
        `Found ${invFound} invoice${invFound !== 1 ? "s" : ""}. Finalizing...`
      );
      await fetch("/api/zoho/trigger-pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: "finalize",
          pullId,
          invoicesNew: invData.data.invoicesNew,
          apiCalls: invData.data.apiCalls,
          allErrors: invData.data.errors || [],
        }),
      }).catch(() => {});

      setFetchProgress("Loading preview...");
      const previewRes = await fetch(
        `/api/zoho/pull-review?pullId=${pullId}`
      ).then((r) => r.json());
      if (previewRes.success) {
        const invoices = (previewRes.data.previews || []).filter(
          (
            p: ZohoInvoicePreview & { entityType: string; status: string }
          ) => p.entityType === "invoice" && p.status === "PENDING"
        );
        setInvoicePreviews(invoices);
        setSelectedInvoices(
          new Set(invoices.map((inv: ZohoInvoicePreview) => inv.id))
        );
        setFetchStep(invoices.length > 0 ? "results" : "idle");
        if (invoices.length === 0) {
          setFetchError(
            invFound > 0
              ? `${invFound} found but already imported`
              : "No new invoices found (last 24h)"
          );
        }
      }
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "Fetch failed");
      setFetchStep("idle");
    } finally {
      setFetchProgress("");
    }
  }, [fetchDays, fetchCustomFrom]);

  const handleImportSelected = useCallback(async () => {
    if (selectedInvoices.size === 0) return;
    setFetchStep("importing");
    try {
      const res = await fetch("/api/zoho/pull-review/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pullId: fetchPullId,
          action: "approve",
          entityType: "invoice",
          previewIds: Array.from(selectedInvoices),
        }),
      }).then((r) => r.json());
      if (!res.success) throw new Error(res.error || "Import failed");
      setFetchStep("idle");
      setInvoicePreviews([]);
      setSelectedInvoices(new Set());
      setFetchError("");
      setSheetOpen(false);
      onImported();
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "Import failed");
      setFetchStep("results");
    }
  }, [selectedInvoices, fetchPullId, onImported]);

  // Convert search results to ImportableInvoice format
  const searchImportable: ImportableInvoice[] = searchResults.map((r) => ({
    id: r.invoiceId,
    invoiceNumber: r.invoiceNumber,
    customerName: r.customerName,
    phone: r.phone,
    date: r.date,
    total: r.total,
    alreadyImported: r.alreadyImported,
    appStatus: r.appStatus,
  }));

  // Convert fetch previews to ImportableInvoice format
  const fetchImportable: ImportableInvoice[] = invoicePreviews.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.data.invoiceNumber,
    customerName: inv.data.customerName,
    phone: inv.data.phone,
    date: inv.data.date,
    total: inv.data.total,
    alreadyImported: false,
    lineItems: inv.data.lineItems.map((li) => ({
      name: li.name,
      quantity: li.quantity,
    })),
  }));

  const toggleSearchResult = (id: string) => {
    setSelectedResults((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAllSearch = () => {
    const selectable = searchResults.filter((r) => !r.alreadyImported);
    const allSelected = selectable.every((r) =>
      selectedResults.has(r.invoiceId)
    );
    if (allSelected) {
      setSelectedResults(new Set());
    } else {
      setSelectedResults(new Set(selectable.map((r) => r.invoiceId)));
    }
  };

  const toggleFetchInvoice = (id: string) => {
    setSelectedInvoices((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAllFetch = () => {
    const allSelected = invoicePreviews.every((inv) =>
      selectedInvoices.has(inv.id)
    );
    if (allSelected) {
      setSelectedInvoices(new Set());
    } else {
      setSelectedInvoices(new Set(invoicePreviews.map((inv) => inv.id)));
    }
  };

  const handleOpenSheet = () => {
    setSheetOpen(true);
    // Reset states when opening
    setSearchError("");
    setFetchError("");
  };

  const handleCloseSheet = () => {
    // Don't close if an operation is in progress
    if (
      searchStep === "searching" ||
      searchStep === "importing" ||
      fetchStep === "fetching" ||
      fetchStep === "importing"
    ) {
      return;
    }
    setSheetOpen(false);
  };

  if (!canFetch) return null;

  const isBusy =
    searchStep === "searching" ||
    searchStep === "importing" ||
    fetchStep === "fetching" ||
    fetchStep === "importing";

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={handleOpenSheet}
        disabled={isBusy}
        className="flex items-center gap-1 bg-slate-700 text-white px-3 py-2 rounded-lg text-xs font-medium disabled:opacity-50"
        title="Fetch deliveries from Zoho"
      >
        {isBusy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Cloud className="h-3.5 w-3.5" />
        )}
        Fetch
      </button>

      {/* Progress banners (shown above the list even when sheet is closed) */}
      {searchStep === "searching" && searchProgress && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg p-2.5 mb-2 mt-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600 shrink-0" />
          <span className="text-xs text-blue-700 font-medium">
            {searchProgress}
          </span>
        </div>
      )}
      {searchStep === "importing" && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg p-2.5 mb-2 mt-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600 shrink-0" />
          <span className="text-xs text-blue-700 font-medium">
            {searchProgress || "Importing..."}
          </span>
        </div>
      )}
      {fetchStep === "fetching" && fetchProgress && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg p-2.5 mb-2 mt-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600 shrink-0" />
          <span className="text-xs text-blue-700 font-medium">
            {fetchProgress}
          </span>
        </div>
      )}
      {fetchStep === "importing" && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3 mt-2">
          <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
          <span className="text-xs text-blue-700">
            Importing {selectedInvoices.size} invoices...
          </span>
        </div>
      )}

      {/* Error banners */}
      {searchError && !sheetOpen && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 mb-2 mt-2 text-xs text-amber-700">
          {searchError}
          <button
            onClick={() => setSearchError("")}
            className="ml-2 underline"
          >
            dismiss
          </button>
        </div>
      )}
      {fetchError && !sheetOpen && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 mb-2 mt-2 text-xs text-amber-700">
          {fetchError}
          <button
            onClick={() => setFetchError("")}
            className="ml-2 underline"
          >
            dismiss
          </button>
        </div>
      )}

      {/* Bottom sheet with tabs */}
      <BottomSheetModal
        open={sheetOpen}
        onClose={handleCloseSheet}
        title="Import from Zoho"
        actions={[]}
      >
        {/* Tab bar */}
        <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5 mb-3">
          <button
            onClick={() => setActiveTab("search")}
            className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === "search"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500"
            }`}
          >
            Search
          </button>
          <button
            onClick={() => setActiveTab("fetch")}
            className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === "fetch"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500"
            }`}
          >
            Bulk Fetch
          </button>
        </div>

        {/* ─── Search Tab ─── */}
        {activeTab === "search" && (
          <div>
            <div className="flex gap-1.5 mb-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Invoice / Phone..."
                  value={invoiceSearch}
                  onChange={(e) => setInvoiceSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleQuickSearch()}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400 pr-8"
                />
                {isPhone && (
                  <Phone className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-green-500" />
                )}
              </div>
              <button
                onClick={handleQuickSearch}
                disabled={
                  searchStep === "searching" || searchStep === "importing"
                }
                className="flex items-center gap-1 bg-slate-900 text-white px-3 py-2 rounded-lg text-xs font-medium disabled:opacity-50 shrink-0"
              >
                {searchStep === "searching" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Search className="h-3.5 w-3.5" />
                )}
                Search
              </button>
            </div>

            {searchError && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 mb-2 text-xs text-amber-700">
                {searchError}
                <button
                  onClick={() => setSearchError("")}
                  className="ml-2 underline"
                >
                  dismiss
                </button>
              </div>
            )}

            {searchStep === "results" && searchImportable.length > 0 && (
              <Card className="border-blue-200 bg-blue-50/50">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-blue-800">
                      {searchImportable.length} invoice
                      {searchImportable.length !== 1 ? "s" : ""} found in Zoho
                    </p>
                    {selectedResults.size > 0 && (
                      <button
                        onClick={handleImportSearchResults}
                        className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-md text-xs font-medium"
                      >
                        <Download className="h-3 w-3" /> Import{" "}
                        {selectedResults.size}
                      </button>
                    )}
                  </div>
                  <ZohoImportResults
                    results={searchImportable}
                    selected={selectedResults}
                    onToggle={toggleSearchResult}
                    onSelectAll={toggleAllSearch}
                  />
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ─── Fetch Tab ─── */}
        {activeTab === "fetch" && (
          <div>
            {fetchStep === "idle" && (
              <>
                <p className="text-xs font-medium text-slate-700 mb-2">
                  Fetch deliveries created in Zoho within:
                </p>
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
                      <label className="text-xs text-slate-500 block mb-0.5">
                        From
                      </label>
                      <input
                        type="date"
                        value={fetchCustomFrom}
                        onChange={(e) => setFetchCustomFrom(e.target.value)}
                        className="px-2 py-1.5 text-xs border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 block mb-0.5">
                        To (optional)
                      </label>
                      <input
                        type="date"
                        value={fetchCustomTo}
                        onChange={(e) => setFetchCustomTo(e.target.value)}
                        className="px-2 py-1.5 text-xs border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={handleFetchInvoices}
                    disabled={fetchDays === -1 && !fetchCustomFrom}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 text-white disabled:opacity-50"
                  >
                    <Cloud className="h-3.5 w-3.5" /> Fetch
                  </button>
                </div>
              </>
            )}

            {fetchError && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 mb-2 text-xs text-amber-700">
                {fetchError}
                <button
                  onClick={() => setFetchError("")}
                  className="ml-2 underline"
                >
                  dismiss
                </button>
              </div>
            )}

            {fetchStep === "results" && fetchImportable.length > 0 && (
              <Card className="border-blue-200 bg-blue-50/50">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-blue-800">
                      {fetchImportable.length} new invoice
                      {fetchImportable.length !== 1 ? "s" : ""} from Zoho
                    </p>
                    <button
                      onClick={handleImportSelected}
                      disabled={selectedInvoices.size === 0}
                      className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-md text-xs font-medium disabled:opacity-50"
                    >
                      <Download className="h-3 w-3" /> Import{" "}
                      {selectedInvoices.size}
                    </button>
                  </div>
                  <ZohoImportResults
                    results={fetchImportable}
                    selected={selectedInvoices}
                    onToggle={toggleFetchInvoice}
                    onSelectAll={toggleAllFetch}
                  />
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </BottomSheetModal>
    </>
  );
}
