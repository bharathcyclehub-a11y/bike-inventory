"use client";

import { useState, useEffect, use } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Phone, CheckCircle2, Calendar, Truck, MapPin, RotateCcw, Save, Trash2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface LineItem {
  id: string;
  productName: string;
  product: { name: string; sku: string } | null;
  sku: string | null;
  quantity: number;
  rate: number;
  amount: number;
  hsn: string | null;
  isDelivered: boolean;
  deliveredQty: number | null;
  binId: string | null;
  bin: { id: string; code: string; name: string; location: string } | null;
  preBookedCustomerName: string | null;
  preBookedCustomerPhone: string | null;
  preBookedInvoiceNo: string | null;
  whatsAppSent: boolean;
  preBooking: { id: string; customerName: string; status: string } | null;
}

interface Bin {
  id: string;
  code: string;
  name: string;
  location: string;
}

interface Shipment {
  id: string;
  shipmentNo: string;
  billNo: string;
  billImageUrl: string | null;
  billPdfUrl: string | null;
  billDate: string;
  expectedDeliveryDate: string;
  status: string;
  totalAmount: number;
  totalItems: number;
  approvedAt: string | null;
  approvedBy: { name: string } | null;
  deliveredAt: string | null;
  notes: string | null;
  brand: { name: string };
  createdBy: { name: string };
  deliveredBy: { name: string } | null;
  putawayBy: { name: string } | null;
  createdAt: string;
  lineItems: LineItem[];
  preBookings: { id: string; customerName: string; customerPhone: string | null; status: string; productName: string }[];
}

function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function InboundDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role || "";
  const isAdmin = role === "ADMIN";
  const canDeliver = ["ADMIN", "SUPERVISOR", "INWARDS_CLERK"].includes(role);
  const canApprove = ["ADMIN", "SUPERVISOR", "ACCOUNTS_MANAGER"].includes(role);

  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [bins, setBins] = useState<Bin[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [itemLoading, setItemLoading] = useState<string | null>(null);
  const [putawayLoading, setPutawayLoading] = useState(false);
  const [approveLoading, setApproveLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<{ shipmentNo: string; deliveredCount: number } | null>(null);
  const [actionError, setActionError] = useState("");

  // Per-item bin selections: lineItemId → array of binIds (one per unit)
  const [binSelections, setBinSelections] = useState<Record<string, string[]>>({});

  useEffect(() => {
    Promise.all([
      fetch(`/api/inbound/${id}`).then((r) => r.json()),
      fetch("/api/bins").then((r) => r.json()),
    ])
      .then(([shipRes, binRes]) => {
        if (shipRes.success) setShipment(shipRes.data);
        if (binRes.success) setBins(binRes.data || []);
      })
      .catch((e) => { setActionError(e instanceof Error ? e.message : "Failed to load shipment"); })
      .finally(() => setLoading(false));
  }, [id]);

  const refreshShipment = async () => {
    const detail = await fetch(`/api/inbound/${id}`).then((r) => r.json());
    if (detail.success) setShipment(detail.data);
  };

  // Set bin for a specific unit of a line item
  const setBinForUnit = (lineItemId: string, unitIndex: number, binId: string, totalQty: number) => {
    setBinSelections((prev) => {
      const current = prev[lineItemId] || new Array(totalQty).fill("");
      const updated = [...current];
      // Ensure array is the right length
      while (updated.length < totalQty) updated.push("");
      updated[unitIndex] = binId;
      return { ...prev, [lineItemId]: updated };
    });
  };

  // Set all units of a line item to the same bin
  const setBinForAll = (lineItemId: string, binId: string, totalQty: number) => {
    setBinSelections((prev) => ({
      ...prev,
      [lineItemId]: new Array(totalQty).fill(binId),
    }));
  };

  // Get bin selections as grouped allocations [{binId, qty}]
  const getBinAllocations = (lineItemId: string): Array<{ binId: string; qty: number }> => {
    const selections = binSelections[lineItemId] || [];
    const groups: Record<string, number> = {};
    for (const binId of selections) {
      if (binId) groups[binId] = (groups[binId] || 0) + 1;
    }
    return Object.entries(groups).map(([binId, qty]) => ({ binId, qty }));
  };

  const isApproved = !!shipment?.approvedAt || isAdmin;

  const handleApprove = async () => {
    setApproveLoading(true);
    try {
      const res = await fetch(`/api/inbound/${id}/approve`, { method: "POST" }).then((r) => r.json());
      if (res.success) { setActionError(""); await refreshShipment(); }
      else setActionError(res.error || "Approval failed");
    } catch (e) { setActionError(e instanceof Error ? e.message : "Approval failed"); }
    finally { setApproveLoading(false); }
  };

  const handleMarkDelivered = async (status: string) => {
    const undeliveredItems = shipment?.lineItems.filter((li) => !li.isDelivered) || [];
    if (status === "DELIVERED") {
      for (const li of undeliveredItems) {
        const selections = binSelections[li.id] || [];
        const allFilled = selections.length === li.quantity && selections.every((b) => b);
        if (!allFilled) {
          alert(`Please assign a bin to all units of "${li.productName}" (${li.quantity} units) before marking delivered.`);
          return;
        }
      }
    }

    setActionLoading(true);
    try {
      const binAssignments = undeliveredItems
        .filter((li) => binSelections[li.id]?.some((b) => b))
        .map((li) => ({
          lineItemId: li.id,
          binAllocations: getBinAllocations(li.id),
        }));

      const res = await fetch(`/api/inbound/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, binAssignments }),
      }).then((r) => r.json());
      if (res.success) {
        setActionError("");
        setBinSelections({});
        await refreshShipment();
        if (status === "DELIVERED") {
          const totalDelivered = shipment?.lineItems.length || 0;
          setSuccessMsg({ shipmentNo: shipment?.shipmentNo || "", deliveredCount: totalDelivered });
        }
      } else {
        setActionError(res.error || "Delivery failed");
      }
    } catch (e) { setActionError(e instanceof Error ? e.message : "Delivery failed"); }
    finally { setActionLoading(false); }
  };

  const handleWhatsApp = async (li: LineItem) => {
    if (!li.preBookedCustomerPhone) return;
    const phone = li.preBookedCustomerPhone.replace(/\D/g, "").slice(-10);
    const expectedDate = shipment ? formatDate(shipment.expectedDeliveryDate) : "soon";
    const message = `Hello ${li.preBookedCustomerName}, great news! Your ${li.productName} has been dispatched from the brand and is expected to arrive at our store by ${expectedDate}. We'll notify you once it's ready for pickup/delivery. - Bharath Cycle Hub`;
    window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(message)}`, "_blank");

    await fetch(`/api/inbound/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lineItemId: li.id, whatsAppSent: true }),
    });
  };

  const handleMarkItemDelivered = async (li: LineItem) => {
    const selections = binSelections[li.id] || [];
    const allFilled = selections.length === li.quantity && selections.every((b) => b);
    if (!allFilled) {
      alert(`Please select a bin for all ${li.quantity} unit(s) before marking delivered.`);
      return;
    }
    setItemLoading(li.id);
    try {
      const binAllocations = getBinAllocations(li.id);
      const res = await fetch(`/api/inbound/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineItemId: li.id, deliveredQty: li.quantity, binAllocations }),
      }).then((r) => r.json());
      if (res.success) {
        setActionError("");
        setBinSelections((prev) => { const n = { ...prev }; delete n[li.id]; return n; });
        await refreshShipment();
      } else {
        setActionError(res.error || `Failed to mark "${li.productName}" as delivered`);
      }
    } catch (e) { setActionError(e instanceof Error ? e.message : "Mark delivered failed"); }
    finally { setItemLoading(null); }
  };

  const handlePutaway = async () => {
    const items = Object.entries(binSelections)
      .filter(([lineItemId]) => {
        const li = shipment?.lineItems.find((l) => l.id === lineItemId);
        return li?.isDelivered && !li.binId;
      })
      .map(([lineItemId]) => ({
        lineItemId,
        binId: (binSelections[lineItemId] || [])[0] || "",
      }))
      .filter((i) => i.binId);

    if (items.length === 0) return;
    setPutawayLoading(true);
    try {
      const res = await fetch(`/api/inbound/${id}/putaway`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      }).then((r) => r.json());
      if (res.success) {
        setActionError("");
        setBinSelections({});
        await refreshShipment();
      } else {
        setActionError(res.error || "Putaway failed");
      }
    } catch (e) { setActionError(e instanceof Error ? e.message : "Putaway failed"); }
    finally { setPutawayLoading(false); }
  };

  const handleRevert = async () => {
    if (!confirm("Revert this shipment back to In Transit?")) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/inbound/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "IN_TRANSIT" }),
      }).then((r) => r.json());
      if (res.success) {
        await refreshShipment();
      } else {
        alert(res.error || "Cannot revert");
      }
    } catch (e) { setActionError(e instanceof Error ? e.message : "Revert failed"); }
    finally { setActionLoading(false); }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this shipment? This cannot be undone.")) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/inbound/${id}`, { method: "DELETE" }).then((r) => r.json());
      if (res.success) {
        router.push("/inbound");
      } else {
        alert(res.error || "Cannot delete");
      }
    } catch (e) { setActionError(e instanceof Error ? e.message : "Delete failed"); }
    finally { setActionLoading(false); }
  };

  // Render bin selectors for a line item (one per unit)
  const renderBinSelectors = (li: LineItem, variant: "default" | "amber" = "default") => {
    const qty = li.quantity;
    const selections = binSelections[li.id] || [];
    const borderClass = variant === "amber" ? "border-amber-200" : "border-slate-200";
    const bgClass = variant === "amber" ? "bg-amber-50" : "bg-white";

    if (qty === 1) {
      return (
        <select
          value={selections[0] || ""}
          onChange={(e) => setBinForUnit(li.id, 0, e.target.value, qty)}
          className={`mt-2 w-full text-xs border ${borderClass} rounded-lg px-2 py-1.5 ${bgClass} text-slate-700`}
        >
          <option value="">Select bin *</option>
          {bins.map((b) => (
            <option key={b.id} value={b.id}>{b.code} — {b.name} ({b.location})</option>
          ))}
        </select>
      );
    }

    // Multiple units — show "Apply to all" + per-unit selectors
    const allSame = selections.length > 0 && selections.every((b) => b && b === selections[0]);
    return (
      <div className="mt-2 space-y-1.5">
        {/* Apply to all shortcut */}
        <div className="flex items-center gap-2">
          <select
            value={allSame ? selections[0] : ""}
            onChange={(e) => { if (e.target.value) setBinForAll(li.id, e.target.value, qty); }}
            className={`flex-1 text-xs border ${borderClass} rounded-lg px-2 py-1.5 ${bgClass} text-slate-700`}
          >
            <option value="">Apply same bin to all {qty} units</option>
            {bins.map((b) => (
              <option key={b.id} value={b.id}>{b.code} — {b.name} ({b.location})</option>
            ))}
          </select>
        </div>
        {/* Per-unit selectors */}
        {Array.from({ length: qty }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 w-10 shrink-0">#{i + 1}</span>
            <select
              value={selections[i] || ""}
              onChange={(e) => setBinForUnit(li.id, i, e.target.value, qty)}
              className={`flex-1 text-xs border ${borderClass} rounded-lg px-2 py-1.5 ${bgClass} text-slate-700`}
            >
              <option value="">Select bin *</option>
              {bins.map((b) => (
                <option key={b.id} value={b.id}>{b.code} — {b.name} ({b.location})</option>
              ))}
            </select>
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
  }

  if (!shipment) {
    return (
      <div className="text-center py-20">
        <p className="text-sm text-slate-400">Shipment not found</p>
        <Link href="/inbound"><Button variant="outline" size="sm" className="mt-3">Back</Button></Link>
      </div>
    );
  }

  const deliveredCount = shipment.lineItems.filter((li) => li.isDelivered).length;
  const needsBinCount = shipment.lineItems.filter((li) => li.isDelivered && !li.binId).length;
  const statusBadge = shipment.status === "DELIVERED"
    ? { variant: "success" as const, label: "Delivered" }
    : shipment.status === "PARTIALLY_DELIVERED"
    ? { variant: "info" as const, label: "Partial" }
    : { variant: "warning" as const, label: "In Transit" };

  const putawayReady = Object.entries(binSelections).filter(([liId]) => {
    const li = shipment.lineItems.find((l) => l.id === liId);
    return li?.isDelivered && !li.binId;
  }).length;

  return (
    <div className="pb-4">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/inbound" className="p-1"><ArrowLeft className="h-5 w-5 text-slate-600" /></Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-slate-900">{shipment.shipmentNo}</h1>
            <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
          </div>
          <p className="text-xs text-slate-500">{shipment.brand.name} | Bill: {shipment.billNo}</p>
        </div>
      </div>

      {/* Action Error */}
      {actionError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 mb-3 text-xs text-red-700">
          {actionError}
          <button onClick={() => setActionError("")} className="ml-2 underline">dismiss</button>
        </div>
      )}

      {/* Summary */}
      <Card className="mb-3">
        <CardContent className="p-3 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500">Bill Date</span>
            <span className="text-sm font-medium text-slate-900">{formatDate(shipment.billDate)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500">Expected Delivery</span>
            <span className="text-sm font-medium text-amber-600 flex items-center gap-1">
              <Calendar className="h-3 w-3" /> {formatDate(shipment.expectedDeliveryDate)}
            </span>
          </div>
          {shipment.deliveredAt && (
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500">Delivered</span>
              <span className="text-sm font-medium text-green-600">{formatDate(shipment.deliveredAt)}</span>
            </div>
          )}
          {isAdmin && (
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500">Total</span>
              <span className="text-sm font-semibold text-slate-900">{formatINR(shipment.totalAmount)}</span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500">Items</span>
            <span className="text-sm text-slate-700">{deliveredCount}/{shipment.totalItems} delivered</span>
          </div>
          {needsBinCount > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500">Needs Bin</span>
              <Badge variant="warning" className="text-[10px]">{needsBinCount} item{needsBinCount > 1 ? "s" : ""}</Badge>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500">Created by</span>
            <span className="text-xs text-slate-700">{shipment.createdBy.name} on {formatDate(shipment.createdAt)}</span>
          </div>
          {shipment.approvedBy && (
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500">Approved by</span>
              <span className="text-xs text-green-700 font-medium">{shipment.approvedBy.name} on {formatDate(shipment.approvedAt!)}</span>
            </div>
          )}
          {shipment.deliveredBy && (
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500">Delivered by</span>
              <span className="text-xs text-slate-700">{shipment.deliveredBy.name}</span>
            </div>
          )}
          {shipment.putawayBy && (
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500">Putaway by</span>
              <span className="text-xs text-slate-700">{shipment.putawayBy.name}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approval Gate */}
      {!isApproved && shipment.status !== "DELIVERED" && (
        <div className="mb-3">
          {canApprove ? (
            <Button onClick={handleApprove} disabled={approveLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-700" size="lg">
              <ShieldCheck className="h-4 w-4 mr-2" /> {approveLoading ? "Approving..." : "Approve Inward"}
            </Button>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
              <ShieldCheck className="h-5 w-5 text-amber-500 mx-auto mb-1" />
              <p className="text-xs font-medium text-amber-800">Awaiting Approval</p>
              <p className="text-[10px] text-amber-600 mt-0.5">Supervisor or Accounts Manager must approve before delivery</p>
            </div>
          )}
        </div>
      )}

      {/* Mark Delivered */}
      {canDeliver && isApproved && shipment.status === "IN_TRANSIT" && (
        <div className="flex gap-2 mb-3">
          <Button onClick={() => handleMarkDelivered("DELIVERED")} disabled={actionLoading}
            className="flex-1 bg-green-600 hover:bg-green-700" size="lg">
            <Truck className="h-4 w-4 mr-2" /> {actionLoading ? "..." : "Mark All Delivered"}
          </Button>
          <Button onClick={() => handleMarkDelivered("PARTIALLY_DELIVERED")} disabled={actionLoading}
            variant="outline" className="flex-1" size="lg">
            Partial
          </Button>
        </div>
      )}

      {/* Partial delivery actions */}
      {canDeliver && isApproved && shipment.status === "PARTIALLY_DELIVERED" && (
        <div className="space-y-2 mb-3">
          <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2 text-center">
            Select bin for each unit, then mark as delivered. Or mark all at once.
          </p>
          <div className="flex gap-2">
            <Button onClick={() => handleMarkDelivered("DELIVERED")} disabled={actionLoading}
              className="flex-1 bg-green-600 hover:bg-green-700" size="lg">
              <Truck className="h-4 w-4 mr-2" /> {actionLoading ? "..." : "Mark All Delivered"}
            </Button>
            {deliveredCount === 0 && (
              <Button onClick={handleRevert} disabled={actionLoading}
                variant="outline" className="gap-1.5" size="lg">
                <RotateCcw className="h-4 w-4" /> Undo
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Post-delivery Putaway */}
      {canDeliver && isApproved && needsBinCount > 0 && shipment.status === "DELIVERED" && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3">
          <p className="text-xs text-amber-800 font-medium mb-1 flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" /> {needsBinCount} item{needsBinCount > 1 ? "s" : ""} need bin assignment
          </p>
          <p className="text-[10px] text-amber-600 mb-2">Select bins below, then save.</p>
          {putawayReady > 0 && (
            <Button onClick={handlePutaway} disabled={putawayLoading} size="sm"
              className="w-full bg-amber-600 hover:bg-amber-700">
              <Save className="h-3.5 w-3.5 mr-1.5" />
              {putawayLoading ? "Saving..." : `Save Bin Assignment (${putawayReady})`}
            </Button>
          )}
        </div>
      )}

      {/* Success message after delivery */}
      {successMsg && (
        <div className="bg-green-50 border border-green-300 rounded-xl p-4 mb-3 text-center">
          <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
          <p className="text-sm font-bold text-green-800">Inward Completed Successfully!</p>
          <p className="text-lg font-bold text-green-900 mt-1">{successMsg.shipmentNo}</p>
          <p className="text-xs text-green-600 mt-1">{successMsg.deliveredCount} items received &amp; stock updated</p>
          <p className="text-[10px] text-slate-400 mt-2">Take a screenshot of this for your records</p>
          <button onClick={() => setSuccessMsg(null)}
            className="mt-3 px-4 py-1.5 rounded-lg text-xs font-medium bg-green-600 text-white hover:bg-green-700">
            OK
          </button>
        </div>
      )}

      {/* Select All — apply one bin to ALL undelivered items */}
      {canDeliver && isApproved && (shipment.status === "IN_TRANSIT" || shipment.status === "PARTIALLY_DELIVERED") && bins.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-3">
          <p className="text-xs font-medium text-blue-800 mb-1.5">Apply same bin to all items</p>
          <select
            onChange={(e) => {
              if (!e.target.value) return;
              const binId = e.target.value;
              const undelivered = shipment.lineItems.filter((li) => !li.isDelivered);
              const newSelections = { ...binSelections };
              for (const li of undelivered) {
                newSelections[li.id] = new Array(li.quantity).fill(binId);
              }
              setBinSelections(newSelections);
              e.target.value = "";
            }}
            className="w-full text-xs border border-blue-200 rounded-lg px-2 py-1.5 bg-white text-slate-700"
          >
            <option value="">Select bin for all items...</option>
            {bins.map((b) => (
              <option key={b.id} value={b.id}>{b.code} — {b.name} ({b.location})</option>
            ))}
          </select>
        </div>
      )}

      {/* Line Items */}
      <p className="text-sm font-semibold text-slate-700 mb-2">Line Items</p>
      <div className="space-y-2 mb-4">
        {shipment.lineItems.map((li) => (
          <Card key={li.id} className={li.isDelivered ? "border-green-200 bg-green-50/30" : ""}>
            <CardContent className="p-3">
              <div className="flex items-start justify-between mb-1">
                <div className="flex-1 min-w-0 mr-2">
                  <p className="text-sm font-medium text-slate-900">{li.productName}</p>
                  {li.product && <p className="text-[10px] text-slate-500">{li.product.sku} | {li.product.name}</p>}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {li.isDelivered && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                  {li.isDelivered && !li.binId && <Badge variant="warning" className="text-[9px] px-1.5">No Bin</Badge>}
                </div>
              </div>

              <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                <span>Qty: {li.quantity}</span>
                {isAdmin && <span>Rate: {formatINR(li.rate)}</span>}
                {isAdmin && <span className="font-medium text-slate-700">{formatINR(li.amount)}</span>}
              </div>

              {/* Current bin assignment */}
              {li.bin && (
                <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-indigo-600">
                  <MapPin className="h-3 w-3" /> {li.bin.code} — {li.bin.name} ({li.bin.location})
                </div>
              )}

              {/* Bin selectors for undelivered items (during partial delivery) */}
              {canDeliver && shipment.status === "PARTIALLY_DELIVERED" && !li.isDelivered && bins.length > 0 && (
                <div>
                  {renderBinSelectors(li)}
                  <button
                    onClick={() => handleMarkItemDelivered(li)}
                    disabled={itemLoading === li.id}
                    className="mt-2 w-full py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-medium border border-green-200 hover:bg-green-100 disabled:opacity-50"
                  >
                    {itemLoading === li.id ? "Marking..." : `Mark Delivered (Qty: ${li.quantity})`}
                  </button>
                </div>
              )}

              {/* Bin selectors for IN_TRANSIT items (pre-select before Mark All Delivered) */}
              {canDeliver && shipment.status === "IN_TRANSIT" && bins.length > 0 && (
                renderBinSelectors(li)
              )}

              {/* Post-delivery bin assignment (delivered but no bin) */}
              {canDeliver && li.isDelivered && !li.binId && bins.length > 0 && (
                renderBinSelectors(li, "amber")
              )}

              {/* Pre-booked customer */}
              {li.preBookedCustomerName && (
                <div className="mt-2 bg-purple-50 rounded-lg p-2 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-purple-700 font-medium">Pre-booked: {li.preBookedCustomerName}</p>
                    {li.preBookedInvoiceNo && <p className="text-[10px] text-purple-500">Invoice: {li.preBookedInvoiceNo}</p>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {li.whatsAppSent && <span className="text-[9px] text-green-600 font-medium">Sent</span>}
                    {li.preBookedCustomerPhone && (
                      <button onClick={() => handleWhatsApp(li)}
                        className="p-1.5 rounded-full hover:bg-green-100">
                        <Phone className="h-4 w-4 text-green-600" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Notes */}
      {shipment.notes && (
        <p className="text-[10px] text-slate-400 text-center mt-4">Notes: {shipment.notes}</p>
      )}

      {/* Delete — admin only */}
      {isAdmin && (
        <button
          onClick={handleDelete}
          disabled={actionLoading}
          className="mt-6 w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-red-600 text-xs font-medium border border-red-200 hover:bg-red-50 disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {deliveredCount > 0 ? "Delete & Reverse Stock" : "Delete Shipment"}
        </button>
      )}
    </div>
  );
}
