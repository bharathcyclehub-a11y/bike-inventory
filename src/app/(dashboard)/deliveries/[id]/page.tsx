"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Phone, MapPin, Clock, CheckCircle2, Truck,
  Flag, AlertTriangle, Loader2, Package, Download,
  MessageCircle, Check, Globe, IndianRupee,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { getAreaFromPincode, isBangalorePincode } from "@/lib/pincode-lookup";

interface DeliveryData {
  id: string;
  invoiceNo: string;
  zohoInvoiceId: string | null;
  invoiceDate: string;
  invoiceAmount: number;
  customerName: string;
  customerPhone: string | null;
  customerAddress: string | null;
  customerArea: string | null;
  customerPincode: string | null;
  status: string;
  verifiedAt: string | null;
  verifiedBy: { name: string } | null;
  scheduledDate: string | null;
  dispatchedAt: string | null;
  deliveredAt: string | null;
  expectedReadyDate: string | null;
  prebookNotes: string | null;
  flagReason: string | null;
  flaggedAt: string | null;
  lineItems: Array<{ name: string; sku: string; quantity: number; rate: number; itemTotal?: number }> | null;
  notes: string | null;
  deliveryNotes: string | null;
  whatsAppScheduledSent: boolean;
  whatsAppDispatchedSent: boolean;
  whatsAppDeliveredSent: boolean;
  freeAccessories: string | null;
  googleReviewLink: string | null;
  isOutstation: boolean;
  courierName: string | null;
  courierTrackingNo: string | null;
  courierCost: number | null;
  paymentStatus: {
    hasPending: boolean;
    balance: number;
    paidAmount: number;
    totalAmount: number;
  } | null;
}

const STATUS_STEPS = ["PENDING", "VERIFIED", "SCHEDULED", "OUT_FOR_DELIVERY", "DELIVERED"];
const OUTSTATION_STEPS = ["VERIFIED", "PACKED", "SHIPPED", "IN_TRANSIT", "DELIVERED"];

function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

export default function DeliveryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<DeliveryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Schedule form
  const [showSchedule, setShowSchedule] = useState(false);
  const [address, setAddress] = useState("");
  const [area, setArea] = useState("");
  const [pincode, setPincode] = useState("");
  const [schedDate, setSchedDate] = useState("");
  const [delNotes, setDelNotes] = useState("");
  const [isOutstation, setIsOutstation] = useState(false);

  // Dispatch form
  const [showDispatch, setShowDispatch] = useState(false);

  // Courier fields (outstation)
  const [courierName, setCourierName] = useState("");
  const [courierTrackingNo, setCourierTrackingNo] = useState("");
  const [courierCost, setCourierCost] = useState("");

  // Inline date editing
  const [editingDate, setEditingDate] = useState(false);
  const [newDate, setNewDate] = useState("");

  // Free accessories
  const [freeAccessories, setFreeAccessories] = useState("");
  const [editingAccessories, setEditingAccessories] = useState(false);

  const fetchData = () => {
    fetch(`/api/deliveries/${id}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setData(res.data);
          setAddress(res.data.customerAddress || "");
          setArea(res.data.customerArea || "");
          setPincode(res.data.customerPincode || "");
          setDelNotes(res.data.deliveryNotes || "");
          setFreeAccessories(res.data.freeAccessories || "");
          setIsOutstation(res.data.isOutstation || false);
          setCourierName(res.data.courierName || "");
          setCourierTrackingNo(res.data.courierTrackingNo || "");
          setCourierCost(res.data.courierCost ? String(res.data.courierCost) : "");
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [id]); // eslint-disable-line

  /** When pincode changes in the form, auto-fill area and detect outstation */
  const handlePincodeBlur = () => {
    if (pincode.length !== 6) return;
    const detectedArea = getAreaFromPincode(pincode);
    if (detectedArea) {
      setArea(detectedArea);
    }
    const outstation = !isBangalorePincode(pincode);
    setIsOutstation(outstation);
  };

  const updateStatus = async (status: string, extra?: Record<string, unknown>) => {
    setActionLoading(true);
    try {
      await fetch(`/api/deliveries/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, ...extra }),
      });
      fetchData();
    } catch { /* */ }
    finally { setActionLoading(false); }
  };

  const handleSchedule = async () => {
    if (!schedDate || !address) return;
    setActionLoading(true);
    try {
      const payload: Record<string, unknown> = {
        status: "SCHEDULED",
        customerAddress: address,
        customerArea: area,
        customerPincode: pincode,
        scheduledDate: schedDate,
        deliveryNotes: delNotes,
        isOutstation,
      };
      await fetch(`/api/deliveries/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setShowSchedule(false);
      fetchData();
    } catch { /* */ }
    finally { setActionLoading(false); }
  };

  const handleSaveCourier = async () => {
    setActionLoading(true);
    try {
      await fetch(`/api/deliveries/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courierName,
          courierTrackingNo,
          courierCost: courierCost ? parseFloat(courierCost) : undefined,
        }),
      });
      fetchData();
    } catch { /* */ }
    finally { setActionLoading(false); }
  };

  const handleDateChange = async () => {
    if (!newDate) return;
    setActionLoading(true);
    try {
      await fetch(`/api/deliveries/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledDate: newDate }),
      });
      setEditingDate(false);
      fetchData();
    } catch { /* */ }
    finally { setActionLoading(false); }
  };

  const handleFlag = async () => {
    const reason = prompt("Flag reason:");
    if (!reason) return;
    const res = await fetch(`/api/deliveries/${id}/flag`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const result = await res.json();
    if (result.success && result.data.alertPhones?.length > 0) {
      const phone = result.data.alertPhones[0].replace(/\D/g, "");
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(result.data.whatsappMessage)}`, "_blank");
    }
    fetchData();
  };

  const getLineItemsText = () => {
    if (!data?.lineItems || data.lineItems.length === 0) return "";
    return data.lineItems.map((item) => `- ${item.name} (Qty: ${item.quantity})`).join("\n");
  };

  const getProductName = () => {
    if (!data?.lineItems || data.lineItems.length === 0) return "your order";
    return data.lineItems.map((item) => item.name).join(", ");
  };

  const openWhatsApp = (phone: string, message: string) => {
    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    window.open(`https://wa.me/91${cleanPhone}?text=${encodeURIComponent(message)}`, "_blank");
  };

  const markWhatsAppSent = async (field: "whatsAppScheduledSent" | "whatsAppDispatchedSent" | "whatsAppDeliveredSent") => {
    try {
      await fetch(`/api/deliveries/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: true }),
      });
      fetchData();
    } catch { /* */ }
  };

  const sendScheduledWhatsApp = () => {
    if (!data?.customerPhone) return;
    const msg = `Hello ${data.customerName},

Your order from Bharath Cycle Hub has been scheduled for delivery.

Product: ${getProductName()}
Delivery Date: ${data.scheduledDate ? new Date(data.scheduledDate).toLocaleDateString("en-IN") : "TBD"}
Address: ${data.customerAddress || "N/A"}

We'll notify you when it's dispatched. Thank you!

- Bharath Cycle Hub`;
    openWhatsApp(data.customerPhone, msg);
    markWhatsAppSent("whatsAppScheduledSent");
  };

  const saveFreeAccessories = async () => {
    try {
      await fetch(`/api/deliveries/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ freeAccessories }),
      });
      fetchData();
    } catch { /* */ }
  };

  const sendDispatchedWhatsApp = () => {
    if (!data?.customerPhone) return;
    const msg = `Hello ${data.customerName},

Congratulations! Your ${getProductName()} has been dispatched and is on its way!

Items:
${getLineItemsText()}

Free Accessories:
${data.freeAccessories || freeAccessories || "None"}

Thank you for choosing Bharath Cycle Hub!`;
    openWhatsApp(data.customerPhone, msg);
    markWhatsAppSent("whatsAppDispatchedSent");
  };

  const sendDeliveredWhatsApp = () => {
    if (!data?.customerPhone) return;
    const reviewLink = data.googleReviewLink || "https://g.page/r/bharathcyclehub/review";
    const msg = `Hello ${data.customerName},

Thank you for your purchase from Bharath Cycle Hub!

We'd love to hear about your experience. Please leave us a review:
${reviewLink}

Thank you!
- Bharath Cycle Hub`;
    openWhatsApp(data.customerPhone, msg);
    markWhatsAppSent("whatsAppDeliveredSent");
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
  }
  if (!data) {
    return <div className="text-center py-12"><p className="text-slate-400">Not found</p><Link href="/deliveries" className="text-blue-600 text-sm">Back</Link></div>;
  }

  const isOuts = data.isOutstation;
  const activeSteps = isOuts ? OUTSTATION_STEPS : STATUS_STEPS;
  const stepIdx = activeSteps.indexOf(data.status);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <Link href="/deliveries" className="p-1"><ArrowLeft className="h-5 w-5 text-slate-600" /></Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-slate-900">{data.invoiceNo}</h1>
          <p className="text-xs text-slate-500">{data.customerName} | {formatINR(data.invoiceAmount)}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {isOuts && (
            <Badge variant="warning">
              <Globe className="h-3 w-3 mr-1" />Outstation
            </Badge>
          )}
          <Badge variant={data.status === "FLAGGED" ? "danger" : data.status === "DELIVERED" || data.status === "WALK_OUT" ? "success" : "info"}>
            {data.status === "OUT_FOR_DELIVERY" ? "Out" : data.status === "WALK_OUT" ? "Walk-out" : data.status === "IN_TRANSIT" ? "In Transit" : data.status.charAt(0) + data.status.slice(1).toLowerCase().replace(/_/g, " ")}
          </Badge>
        </div>
      </div>

      {/* Progress Steps */}
      {!["FLAGGED", "WALK_OUT", "PREBOOKED", "PENDING"].includes(data.status) && (
        <div className="flex items-center gap-1 mb-3">
          {activeSteps.map((step, i) => (
            <div key={step} className="flex-1">
              <div className={`h-1.5 rounded-full ${i <= stepIdx ? (isOuts ? "bg-amber-500" : "bg-blue-500") : "bg-slate-200"}`} />
              <p className={`text-[8px] mt-0.5 text-center ${i <= stepIdx ? (isOuts ? "text-amber-600 font-medium" : "text-blue-600 font-medium") : "text-slate-400"}`}>
                {step === "OUT_FOR_DELIVERY" ? "Out" : step === "IN_TRANSIT" ? "Transit" : step.charAt(0) + step.slice(1).toLowerCase().replace(/_/g, " ")}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* PENDING progress (no outstation yet) */}
      {data.status === "PENDING" && (
        <div className="flex items-center gap-1 mb-3">
          {STATUS_STEPS.map((step, i) => (
            <div key={step} className="flex-1">
              <div className={`h-1.5 rounded-full ${i === 0 ? "bg-blue-500" : "bg-slate-200"}`} />
              <p className={`text-[8px] mt-0.5 text-center ${i === 0 ? "text-blue-600 font-medium" : "text-slate-400"}`}>
                {step === "OUT_FOR_DELIVERY" ? "Out" : step.charAt(0) + step.slice(1).toLowerCase()}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Customer Info */}
      <Card className="mb-3">
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900">{data.customerName}</p>
            {data.customerPhone && (
              <a href={`tel:${data.customerPhone}`} className="flex items-center gap-1 text-xs text-blue-600">
                <Phone className="h-3.5 w-3.5" /> {data.customerPhone}
              </a>
            )}
          </div>
          {data.customerAddress && (
            <div className="flex items-start gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
              <p className="text-xs text-slate-600">{data.customerAddress}</p>
            </div>
          )}
          {data.customerArea && <p className="text-[10px] text-slate-500">Area: {data.customerArea} {data.customerPincode ? `| ${data.customerPincode}` : ""}</p>}
        </CardContent>
      </Card>

      {/* Save Contact Card (only at VERIFIED step) */}
      {data.status === "VERIFIED" && data.customerPhone && (
        <Card className="mb-3 border-blue-200 bg-blue-50">
          <CardContent className="p-3">
            <button
              onClick={() => {
                const phone = data.customerPhone!.replace(/\D/g, "").slice(-10);
                const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${data.customerName} - ${data.invoiceNo}\nTEL:+91${phone}\nEND:VCARD`;
                const blob = new Blob([vcard], { type: "text/vcard" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${data.customerName}.vcf`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium"
            >
              <Download className="h-4 w-4" /> Save Customer Contact
            </button>
          </CardContent>
        </Card>
      )}

      {/* Payment Pending Warning */}
      {data.paymentStatus?.hasPending && (
        <Card className="mb-3 border-red-200 bg-red-50">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <IndianRupee className="h-4 w-4 text-red-600 shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-red-900">Payment Pending</p>
                <p className="text-[10px] text-red-700">
                  Balance: {formatINR(data.paymentStatus.balance)} of {formatINR(data.paymentStatus.totalAmount)}
                  {data.paymentStatus.paidAmount > 0 && ` (Paid: ${formatINR(data.paymentStatus.paidAmount)})`}
                </p>
              </div>
              <Link href="/receivables" className="text-[10px] text-red-600 underline shrink-0">View</Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Courier / Delivery Info */}
      {data.courierName && (
        <Card className="mb-3 border-blue-200 bg-blue-50">
          <CardContent className="p-3 space-y-1">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-blue-600 shrink-0" />
              <p className="text-xs font-semibold text-blue-900">Courier Details</p>
            </div>
            <p className="text-xs text-blue-800">Courier: {data.courierName}</p>
            {data.courierTrackingNo && <p className="text-xs text-blue-800">Tracking: {data.courierTrackingNo}</p>}
            {data.courierCost != null && <p className="text-xs text-blue-800">Cost: {formatINR(data.courierCost)}</p>}
          </CardContent>
        </Card>
      )}

      {/* Editable courier section for dispatched deliveries */}
      {["OUT_FOR_DELIVERY", "PACKED", "SHIPPED", "IN_TRANSIT"].includes(data.status) && (
        <Card className="mb-3 border-amber-200">
          <CardContent className="p-3 space-y-2">
            <p className="text-xs font-semibold text-slate-700">Update Courier Info</p>
            <div>
              <label className="text-[10px] text-slate-500">Courier Name</label>
              <Input value={courierName} onChange={(e) => setCourierName(e.target.value)} placeholder="e.g. DTDC, BlueDart" className="text-xs" />
            </div>
            <div>
              <label className="text-[10px] text-slate-500">Tracking Number</label>
              <Input value={courierTrackingNo} onChange={(e) => setCourierTrackingNo(e.target.value)} placeholder="Tracking ID" className="text-xs" />
            </div>
            <div>
              <label className="text-[10px] text-slate-500">Courier Cost</label>
              <Input type="number" value={courierCost} onChange={(e) => setCourierCost(e.target.value)} placeholder="0" className="text-xs" />
            </div>
            <button onClick={handleSaveCourier} disabled={actionLoading}
              className="w-full bg-amber-600 text-white py-2 rounded-lg text-xs font-medium disabled:opacity-50">
              {actionLoading ? "Saving..." : "Save Courier Info"}
            </button>
          </CardContent>
        </Card>
      )}

      {/* Line Items */}
      {data.lineItems && data.lineItems.length > 0 && (
        <Card className="mb-3">
          <CardContent className="p-3">
            <p className="text-xs font-semibold text-slate-700 mb-2">Items</p>
            <div className="space-y-1.5">
              {data.lineItems.map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-900">{item.name}</p>
                    <p className="text-[10px] text-slate-400">{item.sku} | Qty: {item.quantity}</p>
                  </div>
                  {item.rate > 0 && <p className="text-xs font-medium text-slate-700">{formatINR(item.rate * item.quantity)}</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Free Accessories */}
      {["SCHEDULED", "OUT_FOR_DELIVERY", "PACKED", "SHIPPED", "IN_TRANSIT"].includes(data.status) && (
        <Card className="mb-3">
          <CardContent className="p-3">
            <p className="text-xs font-semibold text-slate-700 mb-2">Free Accessories (included with delivery)</p>
            {data.freeAccessories && !editingAccessories ? (
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-700">{data.freeAccessories}</p>
                <button
                  onClick={() => setEditingAccessories(true)}
                  className="text-[10px] text-blue-600 font-medium"
                >
                  Edit
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  value={freeAccessories}
                  onChange={(e) => setFreeAccessories(e.target.value)}
                  placeholder="e.g. Lock, Bell, Pump, Toolkit"
                  className="text-xs flex-1"
                />
                <button
                  onClick={async () => {
                    await saveFreeAccessories();
                    setEditingAccessories(false);
                  }}
                  disabled={actionLoading}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium disabled:opacity-50 shrink-0"
                >
                  Save
                </button>
                {editingAccessories && (
                  <button
                    onClick={() => {
                      setFreeAccessories(data.freeAccessories || "");
                      setEditingAccessories(false);
                    }}
                    className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium shrink-0"
                  >
                    Cancel
                  </button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Flag Banner */}
      {data.status === "FLAGGED" && (
        <Card className="mb-3 border-red-200 bg-red-50">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-900">Flagged</p>
                <p className="text-xs text-red-700">{data.flagReason}</p>
                {data.flaggedAt && <p className="text-[10px] text-red-500 mt-0.5">{new Date(data.flaggedAt).toLocaleString("en-IN")}</p>}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Prebook Info */}
      {data.status === "PREBOOKED" && (
        <Card className="mb-3 border-purple-200 bg-purple-50">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-purple-600 shrink-0" />
              <div>
                <p className="text-sm font-medium text-purple-900">Prebooked</p>
                {data.expectedReadyDate && <p className="text-xs text-purple-700">Expected ready: {new Date(data.expectedReadyDate).toLocaleDateString("en-IN")}</p>}
                {data.prebookNotes && <p className="text-[10px] text-purple-600 mt-0.5">{data.prebookNotes}</p>}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Schedule Form */}
      {showSchedule && (
        <Card className="mb-3 border-blue-200">
          <CardContent className="p-3 space-y-2">
            <p className="text-xs font-semibold text-slate-700">Schedule Delivery</p>
            <div>
              <label className="text-[10px] text-slate-500">Address *</label>
              <textarea value={address} onChange={(e) => setAddress(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs min-h-[60px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Full delivery address..." />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-500">Area</label>
                <Input value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. Koramangala" className="text-xs" />
              </div>
              <div>
                <label className="text-[10px] text-slate-500">Pincode (6 digits)</label>
                <Input
                  value={pincode}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                    setPincode(val);
                  }}
                  onBlur={handlePincodeBlur}
                  placeholder="560034"
                  className="text-xs"
                  maxLength={6}
                  inputMode="numeric"
                />
              </div>
            </div>

            {/* Outstation auto-detect banner */}
            {pincode.length === 6 && !isBangalorePincode(pincode) && (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <Globe className="h-4 w-4 text-amber-600 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-amber-900">Outstation Delivery</p>
                  <p className="text-[10px] text-amber-700">Pincode {pincode} is outside Bangalore. Courier details will be required.</p>
                </div>
              </div>
            )}

            {/* Bangalore area auto-detected */}
            {pincode.length === 6 && isBangalorePincode(pincode) && getAreaFromPincode(pincode) && (
              <p className="text-[10px] text-green-600">Auto-detected: {getAreaFromPincode(pincode)}</p>
            )}

            <div>
              <label className="text-[10px] text-slate-500">Delivery Date *</label>
              <Input type="date" value={schedDate} onChange={(e) => setSchedDate(e.target.value)} className="text-xs" />
            </div>
            <div>
              <label className="text-[10px] text-slate-500">Delivery Notes</label>
              <Input value={delNotes} onChange={(e) => setDelNotes(e.target.value)} placeholder="Landmark, instructions..." className="text-xs" />
            </div>
            <div className="flex gap-2">
              <button onClick={handleSchedule} disabled={!schedDate || !address || actionLoading}
                className={`flex-1 text-white py-2 rounded-lg text-xs font-medium disabled:opacity-50 ${isOutstation ? "bg-amber-600" : "bg-blue-600"}`}>
                {actionLoading ? "Scheduling..." : isOutstation ? "Schedule (Outstation)" : "Schedule"}
              </button>
              <button onClick={() => setShowSchedule(false)} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium">Cancel</button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delivery Info */}
      {data.scheduledDate && (() => {
        const canEditDate = ["SCHEDULED", "OUT_FOR_DELIVERY", "PACKED", "SHIPPED", "IN_TRANSIT"].includes(data.status);
        return (
          <Card className="mb-3">
            <CardContent className="p-3">
              {editingDate ? (
                <div className="flex items-center gap-2">
                  <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="text-xs flex-1" />
                  <button onClick={handleDateChange} disabled={actionLoading} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50">Save</button>
                  <button onClick={() => setEditingDate(false)} className="text-slate-500 text-xs">Cancel</button>
                </div>
              ) : (
                <div
                  className={`flex items-center gap-2 ${canEditDate ? "cursor-pointer" : ""}`}
                  onClick={() => {
                    if (canEditDate) {
                      setNewDate(data.scheduledDate ? data.scheduledDate.slice(0, 10) : "");
                      setEditingDate(true);
                    }
                  }}
                >
                  <Clock className="h-4 w-4 text-blue-600" />
                  <p className="text-xs text-slate-700">
                    Delivery: <span className="font-medium">{new Date(data.scheduledDate).toLocaleDateString("en-IN")}</span>
                    {data.deliveryNotes && ` — ${data.deliveryNotes}`}
                  </p>
                  {canEditDate && <span className="text-[10px] text-blue-500 ml-auto">tap to change</span>}
                </div>
              )}
              {data.dispatchedAt && <p className="text-[10px] text-slate-500 ml-6 mt-0.5">Dispatched: {new Date(data.dispatchedAt).toLocaleString("en-IN")}</p>}
              {data.deliveredAt && <p className="text-[10px] text-green-600 ml-6 mt-0.5">Delivered: {new Date(data.deliveredAt).toLocaleString("en-IN")}</p>}
            </CardContent>
          </Card>
        );
      })()}

      {/* WhatsApp Action Buttons */}
      {data.customerPhone && (
        <Card className="mb-3 border-green-200 bg-green-50">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-green-600" />
              <p className="text-xs font-semibold text-green-900">WhatsApp Messages</p>
            </div>

            {/* Scheduled message */}
            {data.status === "SCHEDULED" && (
              data.whatsAppScheduledSent ? (
                <div className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-green-600" />
                  <p className="text-xs text-green-600">Scheduled msg sent</p>
                </div>
              ) : (
                <button
                  onClick={sendScheduledWhatsApp}
                  className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-2 rounded-lg text-xs font-medium"
                >
                  <MessageCircle className="h-3.5 w-3.5" /> Send Scheduled
                </button>
              )
            )}

            {/* Dispatched message */}
            {["OUT_FOR_DELIVERY", "SHIPPED", "IN_TRANSIT"].includes(data.status) && (
              data.whatsAppDispatchedSent ? (
                <div className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-green-600" />
                  <p className="text-xs text-green-600">Dispatched msg sent</p>
                </div>
              ) : (
                <button
                  onClick={sendDispatchedWhatsApp}
                  className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-2 rounded-lg text-xs font-medium"
                >
                  <MessageCircle className="h-3.5 w-3.5" /> Send Dispatched
                </button>
              )
            )}

            {/* Delivered message */}
            {data.status === "DELIVERED" && (
              data.whatsAppDeliveredSent ? (
                <div className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-green-600" />
                  <p className="text-xs text-green-600">Delivered msg sent</p>
                </div>
              ) : (
                <button
                  onClick={sendDeliveredWhatsApp}
                  className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-2 rounded-lg text-xs font-medium"
                >
                  <MessageCircle className="h-3.5 w-3.5" /> Send Delivered
                </button>
              )
            )}
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="space-y-2">
        {data.status === "PENDING" && (
          <div className="flex gap-2">
            <button onClick={() => updateStatus("VERIFIED")} disabled={actionLoading}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
              <CheckCircle2 className="h-4 w-4" /> Verify
            </button>
            <button onClick={handleFlag}
              className="flex items-center justify-center gap-2 bg-red-100 text-red-700 px-4 py-2.5 rounded-lg text-sm font-medium">
              <Flag className="h-4 w-4" /> Flag
            </button>
          </div>
        )}

        {data.status === "VERIFIED" && (
          <div className="flex gap-2">
            <button onClick={() => {
              const woWarning = data.paymentStatus?.hasPending
                ? `⚠️ Payment pending: ${formatINR(data.paymentStatus.balance)} balance.\n\n`
                : "";
              if (!confirm(`${woWarning}Mark as walk-out? Stock will be deducted.`)) return;
              updateStatus("WALK_OUT");
            }} disabled={actionLoading}
              className="flex-1 bg-green-600 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
              Walk-out (Took it)
            </button>
            <button onClick={() => setShowSchedule(true)}
              className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium">
              Schedule Delivery
            </button>
          </div>
        )}

        {/* Local delivery: SCHEDULED -> OUT_FOR_DELIVERY */}
        {data.status === "SCHEDULED" && !isOuts && !showDispatch && (
          <button onClick={() => setShowDispatch(true)} disabled={actionLoading}
            className="w-full flex items-center justify-center gap-2 bg-orange-600 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
            <Truck className="h-4 w-4" /> Dispatch
          </button>
        )}

        {showDispatch && data.status === "SCHEDULED" && (
          <Card className="border-orange-200">
            <CardContent className="p-3 space-y-2">
              <p className="text-xs font-semibold text-slate-700">Dispatch Details</p>
              <div>
                <label className="text-[10px] text-slate-500">Courier / Delivery Person *</label>
                <Input value={courierName} onChange={(e) => setCourierName(e.target.value)} placeholder="e.g. Store delivery, DTDC, BlueDart" className="text-xs" />
              </div>
              <div>
                <label className="text-[10px] text-slate-500">Tracking / Reference No</label>
                <Input value={courierTrackingNo} onChange={(e) => setCourierTrackingNo(e.target.value)} placeholder="Vehicle no, tracking ID..." className="text-xs" />
              </div>
              <div>
                <label className="text-[10px] text-slate-500">Delivery Cost (₹)</label>
                <Input type="number" value={courierCost} onChange={(e) => setCourierCost(e.target.value)} placeholder="0" className="text-xs" inputMode="numeric" />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (!courierName.trim()) { alert("Please enter courier/delivery person name"); return; }
                    updateStatus("OUT_FOR_DELIVERY", {
                      courierName: courierName.trim(),
                      courierTrackingNo: courierTrackingNo.trim() || undefined,
                      courierCost: courierCost ? parseFloat(courierCost) : undefined,
                    });
                    setShowDispatch(false);
                  }}
                  disabled={actionLoading}
                  className="flex-1 bg-orange-600 text-white py-2 rounded-lg text-xs font-medium disabled:opacity-50">
                  {actionLoading ? "Dispatching..." : "Confirm Dispatch"}
                </button>
                <button onClick={() => setShowDispatch(false)} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium">Cancel</button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Outstation: SCHEDULED -> PACKED */}
        {data.status === "SCHEDULED" && isOuts && (
          <button onClick={() => updateStatus("PACKED")} disabled={actionLoading}
            className="w-full flex items-center justify-center gap-2 bg-amber-600 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
            <Package className="h-4 w-4" /> Mark Packed
          </button>
        )}

        {/* Outstation: PACKED -> SHIPPED */}
        {data.status === "PACKED" && (
          <button onClick={() => updateStatus("SHIPPED")} disabled={actionLoading}
            className="w-full flex items-center justify-center gap-2 bg-amber-600 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
            <Truck className="h-4 w-4" /> Mark Shipped
          </button>
        )}

        {/* Outstation: SHIPPED -> IN_TRANSIT */}
        {data.status === "SHIPPED" && (
          <button onClick={() => updateStatus("IN_TRANSIT")} disabled={actionLoading}
            className="w-full flex items-center justify-center gap-2 bg-amber-600 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
            <Truck className="h-4 w-4" /> Mark In Transit
          </button>
        )}

        {/* Outstation: IN_TRANSIT -> DELIVERED */}
        {data.status === "IN_TRANSIT" && (
          <button onClick={() => {
            const delWarning = data.paymentStatus?.hasPending
              ? `⚠️ Payment pending: ${formatINR(data.paymentStatus.balance)} balance.\n\n`
              : "";
            if (!confirm(`${delWarning}Mark as delivered? Stock will be deducted.`)) return;
            updateStatus("DELIVERED");
          }} disabled={actionLoading}
            className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
            <CheckCircle2 className="h-4 w-4" /> Mark Delivered
          </button>
        )}

        {data.status === "OUT_FOR_DELIVERY" && (
          <button onClick={() => {
            const delWarning = data.paymentStatus?.hasPending
              ? `⚠️ Payment pending: ${formatINR(data.paymentStatus.balance)} balance.\n\n`
              : "";
            if (!confirm(`${delWarning}Mark as delivered? Stock will be deducted.`)) return;
            updateStatus("DELIVERED");
          }} disabled={actionLoading}
            className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
            <CheckCircle2 className="h-4 w-4" /> Mark Delivered
          </button>
        )}

        {data.status === "FLAGGED" && (
          <button onClick={() => updateStatus("PENDING")} disabled={actionLoading}
            className="w-full bg-slate-900 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
            Resolve Flag
          </button>
        )}

        {data.status === "PREBOOKED" && (
          <button onClick={() => updateStatus("VERIFIED")} disabled={actionLoading}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
            Mark Ready (Cycle Available)
          </button>
        )}

        {data.status === "DELIVERED" && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-3 text-center">
              <CheckCircle2 className="h-6 w-6 text-green-600 mx-auto mb-1" />
              <p className="text-sm font-medium text-green-900">Delivered</p>
              {data.deliveredAt && <p className="text-[10px] text-green-700">{new Date(data.deliveredAt).toLocaleString("en-IN")}</p>}
            </CardContent>
          </Card>
        )}

        {data.status === "WALK_OUT" && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-3 text-center">
              <CheckCircle2 className="h-6 w-6 text-green-600 mx-auto mb-1" />
              <p className="text-sm font-medium text-green-900">Walk-out Complete</p>
              <p className="text-[10px] text-green-700">Customer took the cycle. Stock deducted.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
