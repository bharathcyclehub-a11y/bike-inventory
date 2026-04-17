"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Loader2, UserCheck, Phone, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface PreBooking {
  id: string;
  customerName: string;
  customerPhone: string | null;
  zohoInvoiceNo: string;
  productName: string;
  salesPerson: string | null;
  status: string;
  expectedDate: string | null;
  fulfilledAt: string | null;
  createdAt: string;
  brand: { name: string } | null;
  createdBy: { name: string };
  matchedShipment: { shipmentNo: string; expectedDeliveryDate: string; status: string } | null;
}

type StatusFilter = "ALL" | "WAITING" | "MATCHED" | "FULFILLED" | "CANCELLED";

const STATUS_BADGE: Record<string, { variant: "warning" | "info" | "success" | "default"; label: string }> = {
  WAITING: { variant: "warning", label: "Waiting" },
  MATCHED: { variant: "info", label: "Matched" },
  FULFILLED: { variant: "success", label: "Fulfilled" },
  CANCELLED: { variant: "default", label: "Cancelled" },
};

export default function PreBookingsPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role || "";
  const canCreate = ["ADMIN", "SUPERVISOR", "OUTWARDS_CLERK"].includes(role);

  const [preBookings, setPreBookings] = useState<PreBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("WAITING");

  // Create form
  const [showForm, setShowForm] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [zohoInvoiceNo, setZohoInvoiceNo] = useState("");
  const [productName, setProductName] = useState("");
  const [salesPerson, setSalesPerson] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Zoho search
  const [searching, setSearching] = useState(false);

  const fetchData = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "100" });
    if (filter !== "ALL") params.set("status", filter);

    fetch(`/api/prebookings?${params}`)
      .then((r) => r.json())
      .then((res) => { if (res.success) setPreBookings(res.data.preBookings || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSearchZoho = async () => {
    if (!zohoInvoiceNo.trim()) return;
    setSearching(true);
    setError("");
    try {
      const res = await fetch("/api/deliveries/search-zoho", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: zohoInvoiceNo.trim() }),
      }).then((r) => r.json());

      if (res.success && res.data.results?.length > 0) {
        const inv = res.data.results[0];
        setCustomerName(inv.customerName || "");
        setCustomerPhone(inv.phone || "");
        if (inv.salesPerson || inv.salesperson_name) setSalesPerson(inv.salesPerson || inv.salesperson_name || "");
        // Try to get product name from line items
        if (inv.lineItems?.length > 0) {
          setProductName(inv.lineItems[0].name || "");
        }
      } else {
        setError("Invoice not found. Enter details manually.");
      }
    } catch {
      setError("Search failed. Enter details manually.");
    } finally {
      setSearching(false);
    }
  };

  const handleCreate = async () => {
    if (!customerName || !zohoInvoiceNo || !productName) {
      setError("Customer name, invoice no, and product name are required");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/prebookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          customerPhone: customerPhone || undefined,
          zohoInvoiceNo,
          productName,
          salesPerson: salesPerson || undefined,
        }),
      }).then((r) => r.json());

      if (res.success) {
        setShowForm(false);
        setCustomerName("");
        setCustomerPhone("");
        setZohoInvoiceNo("");
        setProductName("");
        setSalesPerson("");
        fetchData();
      } else {
        setError(res.error || "Failed");
      }
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Pre-Bookings</h1>
          <p className="text-xs text-slate-500">Customer cycle reservations</p>
        </div>
        {canCreate && !showForm && (
          <Button size="sm" onClick={() => setShowForm(true)} className="bg-purple-600 hover:bg-purple-700">
            <Plus className="h-4 w-4 mr-1" /> New
          </Button>
        )}
      </div>

      {/* Create Form */}
      {showForm && (
        <Card className="mb-3 border-purple-200 bg-purple-50/50">
          <CardContent className="p-3 space-y-3">
            <p className="text-xs font-semibold text-purple-800">New Pre-Booking</p>

            <div>
              <label className="block text-xs text-slate-600 mb-0.5">Zoho Invoice No *</label>
              <div className="flex gap-2">
                <Input value={zohoInvoiceNo} onChange={(e) => setZohoInvoiceNo(e.target.value)}
                  placeholder="e.g. 017616" onKeyDown={(e) => e.key === "Enter" && handleSearchZoho()} />
                <Button variant="outline" onClick={handleSearchZoho} disabled={searching} className="shrink-0">
                  {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Search to auto-fill from Zoho</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-600 mb-0.5">Customer *</label>
                <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Name" />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-0.5">Phone</label>
                <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Phone" />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-600 mb-0.5">Sales Person</label>
              <Input value={salesPerson} onChange={(e) => setSalesPerson(e.target.value)} placeholder="Auto-filled from Zoho" />
            </div>

            <div>
              <label className="block text-xs text-slate-600 mb-0.5">Product Name *</label>
              <Input value={productName} onChange={(e) => setProductName(e.target.value)}
                placeholder='e.g. "Hero Sprint 26" or "Firefox Road 700c"' />
            </div>

            {error && <p className="text-xs text-red-600">{error}</p>}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowForm(false)} className="flex-1">Cancel</Button>
              <Button onClick={handleCreate} disabled={submitting || !customerName || !zohoInvoiceNo || !productName}
                className="flex-1 bg-purple-600 hover:bg-purple-700">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-3 pb-1">
        {(["WAITING", "MATCHED", "FULFILLED", "ALL"] as StatusFilter[]).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === f ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}>
            {f === "ALL" ? "All" : STATUS_BADGE[f]?.label || f}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      ) : preBookings.length === 0 ? (
        <div className="text-center py-12">
          <UserCheck className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400">No pre-bookings found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {preBookings.map((pb) => {
            const badge = STATUS_BADGE[pb.status] || { variant: "default" as const, label: pb.status };
            return (
              <Card key={pb.id} className="hover:border-slate-300 transition-colors">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex-1 min-w-0 mr-2">
                      <p className="text-sm font-medium text-slate-900">{pb.customerName}</p>
                      <p className="text-xs text-slate-500">{pb.productName}</p>
                    </div>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </div>

                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-[10px] text-slate-400">Invoice: {pb.zohoInvoiceNo}</span>
                    {pb.brand && <span className="text-[10px] text-slate-400">| {pb.brand.name}</span>}
                    {pb.salesPerson && <span className="text-[10px] text-slate-400">| Sales: {pb.salesPerson}</span>}
                  </div>

                  {pb.matchedShipment && (
                    <div className="mt-2 bg-blue-50 rounded-lg p-2">
                      <p className="text-xs text-blue-700">
                        Matched: {pb.matchedShipment.shipmentNo} |{" "}
                        Expected: {new Date(pb.matchedShipment.expectedDeliveryDate).toLocaleDateString("en-IN")}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] text-slate-400">
                      {new Date(pb.createdAt).toLocaleDateString("en-IN")} by {pb.createdBy.name}
                    </span>
                    {pb.customerPhone && (
                      <a href={`https://wa.me/91${pb.customerPhone.replace(/\D/g, "").slice(-10)}`}
                        target="_blank" rel="noopener noreferrer"
                        className="p-1.5 rounded-full hover:bg-green-50">
                        <Phone className="h-3.5 w-3.5 text-green-600" />
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
