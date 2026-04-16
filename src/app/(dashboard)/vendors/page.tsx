"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Search, Plus, Phone, Building2, Cloud, Loader2, Download } from "lucide-react";
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

interface ZohoVendorPreview {
  id: string;
  zohoId: string;
  data: { name: string; gstin: string; email: string; phone: string; city: string; state: string };
}

export default function VendorsPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role || "";
  const canFetch = ["ADMIN", "SUPERVISOR", "ACCOUNTS_MANAGER"].includes(role);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const [vendors, setVendors] = useState<VendorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [activeFilter, setActiveFilter] = useState<VendorFilter>("ACTIVE");

  // Fetch Vendors from Zoho
  const [fetchStep, setFetchStep] = useState<"idle" | "fetching" | "selecting" | "importing">("idle");
  const [vendorPreviews, setVendorPreviews] = useState<ZohoVendorPreview[]>([]);
  const [selectedVendors, setSelectedVendors] = useState<Set<string>>(new Set());
  const [fetchError, setFetchError] = useState("");
  const [fetchPullId, setFetchPullId] = useState("");

  const fetchData = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "100", includeInactive: "true" });
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

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleFetchVendors = async () => {
    setFetchStep("fetching");
    setFetchError("");
    try {
      const initRes = await fetch("/api/zoho/trigger-pull", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "init" }),
      }).then(r => r.json());
      if (!initRes.success) throw new Error(initRes.error || "Init failed");
      const pullId = initRes.data.pullId;
      setFetchPullId(pullId);

      const contactRes = await fetch("/api/zoho/trigger-pull", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "contacts", pullId }),
      }).then(r => r.json());
      if (!contactRes.success) throw new Error(contactRes.error || "Contacts fetch failed");

      await fetch("/api/zoho/trigger-pull", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: "finalize", pullId,
          contactsNew: contactRes.data.contactsNew, apiCalls: contactRes.data.apiCalls,
          allErrors: contactRes.data.errors || [],
        }),
      });

      const previewRes = await fetch(`/api/zoho/pull-review?pullId=${pullId}`).then(r => r.json());
      if (previewRes.success) {
        const contactItems = (previewRes.data.previews || []).filter(
          (p: ZohoVendorPreview & { entityType: string; status: string }) => p.entityType === "contact" && p.status === "PENDING"
        );
        setVendorPreviews(contactItems);
        setSelectedVendors(new Set(contactItems.map((v: ZohoVendorPreview) => v.id)));
        setFetchStep(contactItems.length > 0 ? "selecting" : "idle");
        if (contactItems.length === 0) setFetchError("No new vendors found in Zoho");
      }
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "Fetch failed");
      setFetchStep("idle");
    }
  };

  const toggleVendor = (id: string) => {
    setSelectedVendors(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleImportSelected = async () => {
    if (selectedVendors.size === 0) return;
    setFetchStep("importing");
    try {
      const res = await fetch("/api/zoho/pull-review/approve", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pullId: fetchPullId, action: "approve",
          entityType: "contact", previewIds: Array.from(selectedVendors),
        }),
      }).then(r => r.json());
      if (!res.success) throw new Error(res.error || "Import failed");
      setFetchStep("idle");
      setVendorPreviews([]);
      setSelectedVendors(new Set());
      fetchData();
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "Import failed");
      setFetchStep("selecting");
    }
  };

  const filtered = activeFilter === "ALL" ? vendors
    : activeFilter === "ACTIVE" ? vendors.filter((v) => v.isActive)
    : vendors.filter((v) => !v.isActive);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-bold text-slate-900">Vendors</h1>
        <div className="flex items-center gap-2">
          {canFetch && (
            <button onClick={handleFetchVendors} disabled={fetchStep === "fetching" || fetchStep === "importing"}
              className="flex items-center gap-1.5 bg-slate-900 text-white px-3 py-2 rounded-lg text-xs font-medium disabled:opacity-50">
              {fetchStep === "fetching" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Cloud className="h-3.5 w-3.5" />}
              {fetchStep === "fetching" ? "Fetching..." : "Fetch Vendors"}
            </button>
          )}
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

      {/* Fetch Error */}
      {fetchError && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 mb-2 text-xs text-amber-700">
          {fetchError}
          <button onClick={() => setFetchError("")} className="ml-2 underline">dismiss</button>
        </div>
      )}

      {/* Vendor Selection Panel */}
      {fetchStep === "selecting" && vendorPreviews.length > 0 && (
        <Card className="mb-3 border-blue-200 bg-blue-50/50">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-blue-800">
                {vendorPreviews.length} new vendor{vendorPreviews.length !== 1 ? "s" : ""} from Zoho
              </p>
              <div className="flex gap-2">
                <button onClick={() => { setFetchStep("idle"); setVendorPreviews([]); }}
                  className="text-xs text-slate-500 underline">Cancel</button>
                <button onClick={handleImportSelected} disabled={selectedVendors.size === 0}
                  className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-md text-xs font-medium disabled:opacity-50">
                  <Download className="h-3 w-3" /> Import {selectedVendors.size}
                </button>
              </div>
            </div>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {vendorPreviews.map((v) => (
                <label key={v.id}
                  className={`flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                    selectedVendors.has(v.id) ? "bg-blue-100 border border-blue-300" : "bg-white border border-slate-200"
                  }`}>
                  <input type="checkbox" checked={selectedVendors.has(v.id)}
                    onChange={() => toggleVendor(v.id)} className="mt-0.5 rounded" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-900">{v.data.name}</p>
                    <p className="text-[10px] text-slate-500">
                      {v.data.city ? `${v.data.city}` : ""}{v.data.gstin ? ` | GSTIN: ${v.data.gstin}` : ""}{v.data.phone ? ` | ${v.data.phone}` : ""}
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
          <span className="text-xs text-blue-700 font-medium">Importing vendors...</span>
        </div>
      )}

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
