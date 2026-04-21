"use client";

import { useState, useEffect, use } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ArrowLeft, Loader2, Phone, CheckCircle2, Package, Calendar, Truck, Image as ImageIcon, FileText, RotateCcw } from "lucide-react";
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
  preBookedCustomerName: string | null;
  preBookedCustomerPhone: string | null;
  preBookedInvoiceNo: string | null;
  whatsAppSent: boolean;
  preBooking: { id: string; customerName: string; status: string } | null;
}

interface Shipment {
  id: string;
  shipmentNo: string;
  billNo: string;
  billImageUrl: string;
  billPdfUrl: string | null;
  billDate: string;
  expectedDeliveryDate: string;
  status: string;
  totalAmount: number;
  totalItems: number;
  deliveredAt: string | null;
  notes: string | null;
  brand: { name: string };
  createdBy: { name: string };
  deliveredBy: { name: string } | null;
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
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role || "";
  const isAdmin = role === "ADMIN";
  const canDeliver = ["ADMIN", "SUPERVISOR", "INWARDS_CLERK"].includes(role);

  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showImage, setShowImage] = useState(false);
  const [itemLoading, setItemLoading] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/inbound/${id}`)
      .then((r) => r.json())
      .then((res) => { if (res.success) setShipment(res.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const handleMarkDelivered = async (status: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/inbound/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }).then((r) => r.json());
      if (res.success) {
        // Refresh
        const detail = await fetch(`/api/inbound/${id}`).then((r) => r.json());
        if (detail.success) setShipment(detail.data);
      }
    } catch { /* */ }
    finally { setActionLoading(false); }
  };

  const handleWhatsApp = async (li: LineItem) => {
    if (!li.preBookedCustomerPhone) return;
    const phone = li.preBookedCustomerPhone.replace(/\D/g, "").slice(-10);
    const expectedDate = shipment ? formatDate(shipment.expectedDeliveryDate) : "soon";
    const message = `Hello ${li.preBookedCustomerName}, great news! Your ${li.productName} has been dispatched from the brand and is expected to arrive at our store by ${expectedDate}. We'll notify you once it's ready for pickup/delivery. - Bharath Cycle Hub`;
    window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(message)}`, "_blank");

    // Mark as sent
    await fetch(`/api/inbound/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lineItemId: li.id, whatsAppSent: true }),
    });
  };

  const handleMarkItemDelivered = async (li: LineItem) => {
    setItemLoading(li.id);
    try {
      const res = await fetch(`/api/inbound/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineItemId: li.id, deliveredQty: li.quantity }),
      }).then((r) => r.json());
      if (res.success) {
        const detail = await fetch(`/api/inbound/${id}`).then((r) => r.json());
        if (detail.success) setShipment(detail.data);
      }
    } catch { /* */ }
    finally { setItemLoading(null); }
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
        const detail = await fetch(`/api/inbound/${id}`).then((r) => r.json());
        if (detail.success) setShipment(detail.data);
      } else {
        alert(res.error || "Cannot revert");
      }
    } catch { /* */ }
    finally { setActionLoading(false); }
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
  const statusBadge = shipment.status === "DELIVERED"
    ? { variant: "success" as const, label: "Delivered" }
    : shipment.status === "PARTIALLY_DELIVERED"
    ? { variant: "info" as const, label: "Partial" }
    : { variant: "warning" as const, label: "In Transit" };

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

      {/* Bill Image & PDF — admin only */}
      {isAdmin && (
        <>
          <button onClick={() => setShowImage(!showImage)}
            className="flex items-center gap-2 text-xs text-indigo-600 font-medium mb-3 hover:underline">
            <ImageIcon className="h-3.5 w-3.5" /> {showImage ? "Hide" : "View"} Bill Image
          </button>
          {showImage && shipment.billImageUrl && (
            <div className="rounded-xl overflow-hidden mb-4 bg-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={shipment.billImageUrl} alt="Bill" className="w-full object-contain max-h-96" />
            </div>
          )}
          {shipment.billPdfUrl && (
            <a href={shipment.billPdfUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-indigo-600 font-medium mb-3 hover:underline">
              <FileText className="h-3.5 w-3.5" /> View Invoice PDF
            </a>
          )}
        </>
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
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500">Uploaded by</span>
            <span className="text-xs text-slate-700">{shipment.createdBy.name} on {formatDate(shipment.createdAt)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Mark Delivered */}
      {canDeliver && shipment.status === "IN_TRANSIT" && (
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
      {canDeliver && shipment.status === "PARTIALLY_DELIVERED" && (
        <div className="space-y-2 mb-3">
          <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2 text-center">
            Tap items below to mark them as delivered one by one, or mark all at once.
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
                {li.isDelivered && <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />}
              </div>

              <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                <span>Qty: {li.quantity}</span>
                {isAdmin && <span>Rate: {formatINR(li.rate)}</span>}
                {isAdmin && <span className="font-medium text-slate-700">{formatINR(li.amount)}</span>}
              </div>

              {/* Mark individual item delivered */}
              {canDeliver && shipment.status === "PARTIALLY_DELIVERED" && !li.isDelivered && (
                <button
                  onClick={() => handleMarkItemDelivered(li)}
                  disabled={itemLoading === li.id}
                  className="mt-2 w-full py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-medium border border-green-200 hover:bg-green-100 disabled:opacity-50"
                >
                  {itemLoading === li.id ? "Marking..." : `Mark Delivered (Qty: ${li.quantity})`}
                </button>
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
    </div>
  );
}
