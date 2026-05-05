"use client";

import { useState, useEffect, use } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Phone, MapPin, Clock, CheckCircle2, Truck,
  Flag, AlertTriangle, Loader2, Package, Download, Wrench,
  MessageCircle, Check, Globe, IndianRupee, ShoppingBag, RotateCcw,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

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
  alternatePhone: string | null;
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
  reversePickup: boolean;
  googleReviewLink: string | null;
  invoiceType: string | null;
  isOutstation: boolean;
  courierName: string | null;
  courierTrackingNo: string | null;
  vehicleNo: string | null;
  courierCost: number | null;
  paymentStatus: {
    hasPending: boolean;
    balance: number;
    paidAmount: number;
    totalAmount: number;
  } | null;
  salesPerson: string | null;
}

// Inside Bangalore: simpler flow, no "Out" step
const BANGALORE_STEPS = ["PENDING", "SCHEDULED", "DELIVERED"];
// Outside Bangalore (outstation): full flow with dispatch
const OUTSTATION_STEPS = ["PENDING", "SCHEDULED", "OUT_FOR_DELIVERY", "DELIVERED"];
// Courier outstation: packed → shipped → transit → delivered
const COURIER_STEPS = ["VERIFIED", "PACKED", "SHIPPED", "IN_TRANSIT", "DELIVERED"];

function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

export default function DeliveryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const [data, setData] = useState<DeliveryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [contactSaved, setContactSaved] = useState(false);
  const [editPincode, setEditPincode] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editAltPhone, setEditAltPhone] = useState("");

  // Schedule form
  const [showSchedule, setShowSchedule] = useState(false);
  const [schedDate, setSchedDate] = useState("");
  const [delNotes, setDelNotes] = useState("");
  const [isOutstation, setIsOutstation] = useState(false);

  // Dispatch form
  const [showDispatch, setShowDispatch] = useState(false);

  // Courier fields (outstation)
  const [courierName, setCourierName] = useState("");
  const [courierTrackingNo, setCourierTrackingNo] = useState("");
  const [courierCost, setCourierCost] = useState("");

  // Local dispatch fields
  const [vehicleNo, setVehicleNo] = useState("");

  // Inline date editing
  const [editingDate, setEditingDate] = useState(false);
  const [newDate, setNewDate] = useState("");

  // Free accessories
  const [freeAccessories, setFreeAccessories] = useState("");
  const [reversePickup, setReversePickup] = useState(false);

  // Service invoice confirmation
  const [showServiceConfirm, setShowServiceConfirm] = useState(false);
  const markAsService = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/deliveries/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceType: "SERVICE" }),
      });
      const result = await res.json();
      if (result.success) setData(result.data);
    } catch { /* silent */ }
    setActionLoading(false);
    setShowServiceConfirm(false);
  };

  // Handover confirmation checklist — auto-open if ?action=walkout
  const [showHandover, setShowHandover] = useState<"WALK_OUT" | "DELIVERED" | null>(
    searchParams.get("action") === "walkout" ? "WALK_OUT" : null
  );
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [accessoriesConfirmed, setAccessoriesConfirmed] = useState(false);
  const [salesPersonConfirmed, setSalesPersonConfirmed] = useState(false);

  // WhatsApp templates
  const [templates, setTemplates] = useState<Record<string, string>>({});
  const [showDispatchWhatsApp, setShowDispatchWhatsApp] = useState(false);
  const [editingAccessories, setEditingAccessories] = useState(false);

  // Page tab: actions (default) vs details
  const [activeTab, setActiveTab] = useState<"actions" | "details">("actions");

  const fetchData = () => {
    fetch(`/api/deliveries/${id}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setData(res.data);
          setDelNotes(res.data.deliveryNotes || "");
          setFreeAccessories(res.data.freeAccessories || "");
          setIsOutstation(res.data.isOutstation || false);
          setEditPincode(res.data.customerPincode || "");
          setEditAddress(res.data.customerAddress || "");
          setEditAltPhone(res.data.alternatePhone || "");
          setCourierName(res.data.courierName || "");
          setCourierTrackingNo(res.data.courierTrackingNo || "");
          setCourierCost(res.data.courierCost ? String(res.data.courierCost) : "");
          setVehicleNo(res.data.vehicleNo || "");
          setReversePickup(res.data.reversePickup || false);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [id]); // eslint-disable-line

  useEffect(() => {
    fetch("/api/whatsapp-templates")
      .then((r) => r.json())
      .then((res) => { if (res.success) setTemplates(res.data); })
      .catch(() => {});
  }, []);

  const updateStatus = async (status: string, extra?: Record<string, unknown>) => {
    setActionLoading(true);
    try {
      await fetch(`/api/deliveries/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, ...extra }),
      });
      fetchData();
    } catch (e) { setActionError(e instanceof Error ? e.message : "Action failed"); }
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
    } catch (e) { setActionError(e instanceof Error ? e.message : "Save courier failed"); }
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
    } catch (e) { setActionError(e instanceof Error ? e.message : "Date change failed"); }
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
      window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(result.data.whatsappMessage)}`, "_blank");
    }
    fetchData();
  };

  const renderTemplate = (template: string, vars: Record<string, string>) => {
    let msg = template;
    for (const [key, val] of Object.entries(vars)) {
      msg = msg.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), val);
    }
    // Handle optional sections: {{#key}}...{{/key}} — remove if value empty
    msg = msg.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, key, content) => {
      return vars[key] ? content.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), vars[key]) : "";
    });
    return msg.trim();
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
    const encodedMsg = encodeURIComponent(message);
    window.open(`https://api.whatsapp.com/send?phone=91${cleanPhone}&text=${encodedMsg}`, "_blank");
  };

  const markWhatsAppSent = async (field: "whatsAppScheduledSent" | "whatsAppDispatchedSent" | "whatsAppDeliveredSent") => {
    try {
      await fetch(`/api/deliveries/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: true }),
      });
      fetchData();
    } catch (e) { setActionError(e instanceof Error ? e.message : "WhatsApp update failed"); }
  };

  const sendScheduledWhatsApp = () => {
    if (!data?.customerPhone) return;
    const date = data.scheduledDate ? new Date(data.scheduledDate).toLocaleDateString("en-IN") : "TBD";
    const productName = getProductName();
    let msg: string;
    if (templates.scheduled) {
      msg = renderTemplate(templates.scheduled, { customerName: data.customerName, productName, deliveryDate: date });
    } else if (data.isOutstation) {
      msg = `🚲 *Bharath Cycle Hub*\n\nHi ${data.customerName},\n\nYour order #${data.invoiceNo} has been shipped!\n\n📦 ${productName}\n\nYour package is on the way. We'll share tracking details once available.\n\n📞 For queries: 9876543210\n\nThank you! 🙏`;
    } else {
      msg = `🚲 *Bharath Cycle Hub*\n\nHi ${data.customerName},\n\nYour order #${data.invoiceNo} is out for delivery!\n\n📦 ${productName}\n\nOur delivery boy will call before arriving.\n\n📞 For queries: 9876543210\n\nThank you! 🙏`;
    }
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
    } catch (e) { setActionError(e instanceof Error ? e.message : "Save accessories failed"); }
  };

  const sendDispatchedWhatsApp = () => {
    if (!data?.customerPhone) return;
    const productName = getProductName();
    const lineItemsText = getLineItemsText();
    const accessories = data.freeAccessories || freeAccessories || "None";
    const vNo = data.vehicleNo || vehicleNo;
    const trackingLink = data.courierTrackingNo || courierTrackingNo;

    const msg = templates.dispatched
      ? renderTemplate(templates.dispatched, {
          customerName: data.customerName,
          productName,
          vehicleNo: vNo || "",
          trackingLink: trackingLink || "",
          lineItems: lineItemsText,
          accessories,
        })
      : `Hello ${data.customerName},\n\nYour ${productName} is on the way!${vNo ? `\n\nVehicle No: ${vNo}` : ""}${trackingLink ? `\nTrack: ${trackingLink}` : ""}\n\nItems:\n${lineItemsText}\n\nFree Accessories:\n${accessories}\n\nThank you for choosing Bharath Cycle Hub!`;
    openWhatsApp(data.customerPhone, msg);
    markWhatsAppSent("whatsAppDispatchedSent");
    setShowDispatchWhatsApp(false);
  };

  const sendDeliveredWhatsApp = () => {
    if (!data?.customerPhone) return;
    const reviewLink = data.googleReviewLink || "https://g.page/r/bharathcyclehub/review";
    let msg: string;
    if (templates.delivered) {
      msg = renderTemplate(templates.delivered, { customerName: data.customerName, reviewLink });
    } else if (data.isOutstation) {
      msg = `Hello ${data.customerName},\n\nYour order from Bharath Cycle Hub has been delivered!\n\nWe hope you enjoy your new cycle. If you have any issues with assembly or setup, please don't hesitate to reach out.\n\nWe'd love your feedback:\n${reviewLink}\n\nThank you for choosing Bharath Cycle Hub!\n- Team BCH`;
    } else {
      msg = `Hello ${data.customerName},\n\nThank you for your purchase from Bharath Cycle Hub!\n\nWe'd love to hear about your experience. Please leave us a review:\n${reviewLink}\n\nThank you!\n- Bharath Cycle Hub`;
    }
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
  // Choose progress steps based on delivery type
  const isCourierFlow = isOuts && ["VERIFIED", "PACKED", "SHIPPED", "IN_TRANSIT"].includes(data.status);
  const activeSteps = isCourierFlow ? COURIER_STEPS : isOuts ? OUTSTATION_STEPS : BANGALORE_STEPS;
  const stepIdx = activeSteps.indexOf(data.status);

  return (
    <div>
      {actionError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 mb-3 text-xs text-red-700">
          {actionError}
          <button onClick={() => setActionError("")} className="ml-2 underline">dismiss</button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <Link href="/deliveries" className="p-1"><ArrowLeft className="h-5 w-5 text-slate-600" /></Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-slate-900">{data.invoiceNo}</h1>
          <p className="text-xs text-slate-500">{data.customerName} | {formatINR(data.invoiceAmount)}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {data.reversePickup && (
            <Badge variant="info">
              <RotateCcw className="h-3 w-3 mr-1" />Reverse
            </Badge>
          )}
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

      {/* Tab Switcher */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 mb-3">
        <button onClick={() => setActiveTab("actions")}
          className={`flex-1 py-2 rounded-md text-sm font-semibold transition-colors ${activeTab === "actions" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>
          Actions
        </button>
        <button onClick={() => setActiveTab("details")}
          className={`flex-1 py-2 rounded-md text-sm font-semibold transition-colors ${activeTab === "details" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>
          Details
        </button>
      </div>

      {/* ═══════════ ACTIONS TAB ═══════════ */}
      {activeTab === "actions" && (<>

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

      {/* PENDING progress */}
      {data.status === "PENDING" && (
        <div className="flex items-center gap-1 mb-3">
          {BANGALORE_STEPS.map((step, i) => (
            <div key={step} className="flex-1">
              <div className={`h-1.5 rounded-full ${i === 0 ? "bg-blue-500" : "bg-slate-200"}`} />
              <p className={`text-[8px] mt-0.5 text-center ${i === 0 ? "text-blue-600 font-medium" : "text-slate-400"}`}>
                {step.charAt(0) + step.slice(1).toLowerCase()}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Quick call button on actions tab */}
      {data.customerPhone && (
        <div className="flex gap-2 mb-3">
          <a href={`tel:${data.customerPhone}`} className="flex-1 flex items-center justify-center gap-2 bg-slate-100 text-slate-700 py-2.5 rounded-lg text-sm font-medium">
            <Phone className="h-4 w-4" /> {data.customerPhone}
          </a>
        </div>
      )}

      {/* Save Contact — uses Web Share API to open native "Add Contact" */}
      {["PENDING"].includes(data.status) && data.customerPhone && !contactSaved && (
        <Card className="mb-3 border-blue-200 bg-blue-50">
          <CardContent className="p-3">
            <p className="text-[10px] text-blue-700 font-medium mb-1.5">Save the contact before proceeding</p>
            <button
              onClick={async () => {
                const phone = data.customerPhone!.replace(/\D/g, "").slice(-10);
                const contactName = `${data.customerName} - ${data.invoiceNo}`;
                const vcard = `BEGIN:VCARD\r\nVERSION:3.0\r\nFN:${contactName}\r\nTEL;TYPE=CELL:+91${phone}\r\nEND:VCARD`;
                const blob = new Blob([vcard], { type: "text/vcard" });
                const file = new File([blob], `${contactName}.vcf`, { type: "text/vcard" });

                // Try Web Share API first — opens native share sheet → Contacts app
                if (navigator.share && navigator.canShare?.({ files: [file] })) {
                  try {
                    await navigator.share({ files: [file], title: "Save Contact" });
                    setContactSaved(true);
                    return;
                  } catch {
                    // User cancelled share — fall through to fallback
                  }
                }

                // Fallback: open vCard blob URL — triggers "Open with Contacts" on most mobile browsers
                const url = URL.createObjectURL(blob);
                window.open(url, "_blank");
                setContactSaved(true);
              }}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium"
            >
              <Download className="h-4 w-4" /> Save Customer Contact
            </button>
          </CardContent>
        </Card>
      )}

      </>)}

      {/* ═══════════ DETAILS TAB ═══════════ */}
      {activeTab === "details" && (<>

      {/* Customer Info */}
      <Card className={`mb-3 ${isOuts ? "border-amber-200" : ""}`}>
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900">{data.customerName}</p>
            {data.customerPhone && (
              <a href={`tel:${data.customerPhone}`} className="flex items-center gap-1 text-xs text-blue-600">
                <Phone className="h-3.5 w-3.5" /> {data.customerPhone}
              </a>
            )}
          </div>
          {data.alternatePhone && (
            <p className="text-[10px] text-slate-500">Alt: {data.alternatePhone}</p>
          )}
          {data.customerAddress && (
            <div className="flex items-start gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
              <p className="text-xs text-slate-600">{data.customerAddress}</p>
            </div>
          )}
          {(data.customerArea || data.customerPincode) && (
            <p className="text-[10px] text-slate-500">
              {data.customerArea ? `Area: ${data.customerArea}` : ""}
              {data.customerPincode ? ` | Pincode: ${data.customerPincode}` : ""}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Delivery Details — editable on SCHEDULED (read-only summary, tap to edit pincode/address) */}
      {data.status === "SCHEDULED" && (
        <Card className={`mb-3 ${isOuts ? "border-amber-200" : "border-slate-200"}`}>
          <CardContent className="p-3 space-y-2">
            <p className="text-xs font-semibold text-slate-700">
              {isOuts ? "Outstation Delivery Details" : "Delivery Details"}
            </p>
            <div>
              <label className="text-[10px] text-slate-500">{isOuts ? "Delivery Address *" : "Pincode *"}</label>
              {isOuts ? (
                <textarea
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  placeholder="House no, street, area, city, state"
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-300 resize-none"
                  rows={2}
                />
              ) : (
                <Input
                  value={editPincode}
                  onChange={(e) => setEditPincode(e.target.value)}
                  placeholder="e.g. 560001"
                  className="text-xs"
                  inputMode="numeric"
                  maxLength={6}
                />
              )}
            </div>
            {isOuts && (
              <div>
                <label className="text-[10px] text-slate-500">Alternate Phone</label>
                <Input
                  value={editAltPhone}
                  onChange={(e) => setEditAltPhone(e.target.value)}
                  placeholder="Alternate contact number"
                  className="text-xs"
                  inputMode="tel"
                />
              </div>
            )}
            <button
              onClick={async () => {
                setActionLoading(true);
                try {
                  await fetch(`/api/deliveries/${id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      customerPincode: editPincode.trim() || undefined,
                      ...(isOuts ? {
                        customerAddress: editAddress.trim() || undefined,
                        alternatePhone: editAltPhone.trim() || undefined,
                      } : {}),
                    }),
                  });
                  fetchData();
                } catch (e) { setActionError(e instanceof Error ? e.message : "Save failed"); }
                finally { setActionLoading(false); }
              }}
              disabled={actionLoading}
              className="w-full bg-slate-800 text-white py-2 rounded-lg text-xs font-medium disabled:opacity-50"
            >
              {actionLoading ? "Saving..." : "Update Details"}
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
      {data.courierName && !["OUT_FOR_DELIVERY", "PACKED", "SHIPPED", "IN_TRANSIT"].includes(data.status) && (
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
            <button onClick={async () => {
              await handleSaveCourier();
              setShowDispatchWhatsApp(true);
            }} disabled={actionLoading}
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

      </>)}

      {/* ═══════════ ACTIONS TAB (continued) ═══════════ */}
      {activeTab === "actions" && (<>

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

      {/* Schedule Form — TeleCRM-style: Inside Bangalore / Outside Bangalore */}
      {showSchedule && (
        <Card className={`mb-3 ${isOutstation ? "border-amber-200" : "border-blue-200"}`}>
          <CardContent className="p-3 space-y-3">
            {/* Toggle: Inside / Outside Bangalore */}
            <div className="flex rounded-lg overflow-hidden border border-slate-200">
              <button
                type="button"
                onClick={() => setIsOutstation(false)}
                className={`flex-1 py-2 text-xs font-medium transition-colors ${
                  !isOutstation ? "bg-blue-600 text-white" : "bg-slate-50 text-slate-600"
                }`}
              >
                Inside Bangalore
              </button>
              <button
                type="button"
                onClick={() => setIsOutstation(true)}
                className={`flex-1 py-2 text-xs font-medium transition-colors ${
                  isOutstation ? "bg-amber-600 text-white" : "bg-slate-50 text-slate-600"
                }`}
              >
                Outside Bangalore
              </button>
            </div>

            {/* Auto-populated: Invoice Number */}
            <div>
              <label className="text-[10px] text-slate-500">Invoice Number</label>
              <div className="text-xs font-medium text-slate-900 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">{data.invoiceNo}</div>
            </div>

            {/* Auto-populated: Product Name */}
            <div>
              <label className="text-[10px] text-slate-500">Product Name</label>
              <div className="text-xs font-medium text-slate-900 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                {data.lineItems?.map((i) => i.name).join(", ") || "—"}
              </div>
            </div>

            {/* Auto-populated: Sales Person */}
            <div>
              <label className="text-[10px] text-slate-500">Sales Person</label>
              <div className="text-xs font-medium text-slate-900 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                {data.salesPerson || "—"}
              </div>
            </div>

            {/* Alternate Phone */}
            <div>
              <label className="text-[10px] text-slate-500">Alternate Phone</label>
              <Input
                value={editAltPhone}
                onChange={(e) => setEditAltPhone(e.target.value)}
                placeholder="Alternate contact number"
                className="text-xs"
                inputMode="tel"
              />
            </div>

            {/* --- Inside Bangalore specific fields --- */}
            {!isOutstation && (
              <>
                <div>
                  <label className="text-[10px] text-slate-500">Pincode *</label>
                  <Input
                    value={editPincode}
                    onChange={(e) => setEditPincode(e.target.value)}
                    placeholder="e.g. 560001"
                    className="text-xs"
                    inputMode="numeric"
                    maxLength={6}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500">Free Accessories</label>
                  <Input
                    value={freeAccessories}
                    onChange={(e) => setFreeAccessories(e.target.value)}
                    placeholder="e.g. Lock, Bell, Pump, Toolkit"
                    className="text-xs"
                  />
                </div>
                <label className="flex items-center gap-2 py-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reversePickup}
                    onChange={(e) => setReversePickup(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  <span className="text-xs font-medium text-slate-700">Reverse Pickup (exchange old cycle)</span>
                </label>
              </>
            )}

            {/* --- Outside Bangalore specific fields --- */}
            {isOutstation && (
              <>
                <div>
                  <label className="text-[10px] text-slate-500">Delivery Address *</label>
                  <textarea
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    placeholder="House no, street, area, city, state, pincode"
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-300 resize-none"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500">Free Accessories</label>
                  <Input
                    value={freeAccessories}
                    onChange={(e) => setFreeAccessories(e.target.value)}
                    placeholder="e.g. Lock, Bell, Pump, Toolkit"
                    className="text-xs"
                  />
                </div>
              </>
            )}

            {/* Estimated Delivery Date */}
            <div>
              <label className="text-[10px] text-slate-500">Estimated Delivery *</label>
              <div className="grid grid-cols-3 gap-1.5 mt-1">
                {[
                  { label: "Today", days: 0 },
                  { label: "Tomorrow", days: 1 },
                  { label: "After 3 days", days: 3 },
                  { label: "After a week", days: 7 },
                  { label: "After a month", days: 30 },
                ].map((opt) => {
                  const d = new Date();
                  d.setDate(d.getDate() + opt.days);
                  const val = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                  return (
                    <button key={opt.label} type="button" onClick={() => setSchedDate(val)}
                      className={`px-2 py-2 rounded-lg text-xs font-medium transition-colors ${
                        schedDate === val
                          ? (isOutstation ? "bg-amber-600 text-white" : "bg-blue-600 text-white")
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}>
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              {schedDate && (
                <p className={`text-[10px] mt-1 ${isOutstation ? "text-amber-600" : "text-blue-600"}`}>
                  Selected: {new Date(schedDate + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                </p>
              )}
            </div>

            {/* Delivery Notes */}
            <div>
              <label className="text-[10px] text-slate-500">Delivery Notes</label>
              <Input value={delNotes} onChange={(e) => setDelNotes(e.target.value)} placeholder="Landmark, instructions..." className="text-xs" />
            </div>

            {/* Submit */}
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  if (!schedDate) return;
                  setActionLoading(true);
                  try {
                    const payload: Record<string, unknown> = {
                      status: "SCHEDULED",
                      scheduledDate: schedDate,
                      deliveryNotes: delNotes,
                      isOutstation,
                      alternatePhone: editAltPhone.trim() || undefined,
                      freeAccessories: freeAccessories.trim() || undefined,
                      ...(isOutstation
                        ? { customerAddress: editAddress.trim() || undefined }
                        : {
                            customerPincode: editPincode.trim() || undefined,
                            reversePickup,
                          }),
                    };
                    await fetch(`/api/deliveries/${id}`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(payload),
                    });
                    setShowSchedule(false);
                    // Auto-trigger WhatsApp scheduled message
                    if (data?.customerPhone) {
                      const date = new Date(schedDate).toLocaleDateString("en-IN");
                      const productName = getProductName();
                      const msg = templates.scheduled
                        ? renderTemplate(templates.scheduled, { customerName: data.customerName, productName, deliveryDate: date })
                        : `Hello ${data.customerName},\n\nYour order from Bharath Cycle Hub has been scheduled for delivery.\n\nProduct: ${productName}\nDelivery Date: ${date}\n\nPlease share your delivery location on WhatsApp so our rider can reach you.\n\nThank you!\n- Bharath Cycle Hub`;
                      openWhatsApp(data.customerPhone, msg);
                      markWhatsAppSent("whatsAppScheduledSent");
                    }
                    fetchData();
                  } catch (e) { setActionError(e instanceof Error ? e.message : "Schedule failed"); }
                  finally { setActionLoading(false); }
                }}
                disabled={!schedDate || actionLoading}
                className={`flex-1 text-white py-2.5 rounded-lg text-xs font-medium disabled:opacity-50 ${
                  isOutstation ? "bg-amber-600" : "bg-blue-600"
                }`}
              >
                {actionLoading ? "Scheduling..." : "Schedule Delivery"}
              </button>
              <button onClick={() => setShowSchedule(false)} className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium">Cancel</button>
            </div>
          </CardContent>
        </Card>
      )}

      </>)}

      {/* ═══════════ DETAILS TAB (continued) ═══════════ */}
      {activeTab === "details" && (<>

      {/* Delivery Info */}
      {data.scheduledDate && (() => {
        const canEditDate = ["SCHEDULED", "OUT_FOR_DELIVERY", "PACKED", "SHIPPED", "IN_TRANSIT"].includes(data.status);
        return (
          <Card className="mb-3">
            <CardContent className="p-3">
              {editingDate ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: "Today", days: 0 },
                      { label: "Tomorrow", days: 1 },
                      { label: "After 3 days", days: 3 },
                      { label: "After a week", days: 7 },
                      { label: "After a month", days: 30 },
                    ].map((opt) => {
                      const d = new Date();
                      d.setDate(d.getDate() + opt.days);
                      const val = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                      return (
                        <button key={opt.label} type="button" onClick={() => setNewDate(val)}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors ${
                            newDate === val ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"
                          }`}>
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                  {newDate && (
                    <p className="text-[10px] text-blue-600">
                      {new Date(newDate).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button onClick={handleDateChange} disabled={!newDate || actionLoading}
                      className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50">Save</button>
                    <button onClick={() => setEditingDate(false)} className="text-slate-500 text-xs">Cancel</button>
                  </div>
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

      {/* Auto-prompt: Send WhatsApp after dispatch */}
      {showDispatchWhatsApp && data.customerPhone && !data.whatsAppDispatchedSent && (
        <Card className="mb-3 border-green-300 bg-green-50 ring-2 ring-green-300">
          <CardContent className="p-3 space-y-2">
            <p className="text-xs font-semibold text-green-900">Dispatched! Send WhatsApp to customer?</p>
            <p className="text-[10px] text-green-700">
              {data.vehicleNo && `Vehicle: ${data.vehicleNo}`}
              {data.vehicleNo && data.courierTrackingNo && " | "}
              {data.courierTrackingNo && `Tracking: ${data.courierTrackingNo}`}
            </p>
            <div className="flex gap-2">
              <button onClick={sendDispatchedWhatsApp}
                className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white py-2.5 rounded-lg text-sm font-medium">
                <MessageCircle className="h-4 w-4" /> Send WhatsApp Now
              </button>
              <button onClick={() => setShowDispatchWhatsApp(false)}
                className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium">
                Skip
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      </>)}

      {/* ═══════════ ACTIONS TAB (handover + buttons) ═══════════ */}
      {activeTab === "actions" && (<>

      {/* Handover Confirmation Checklist */}
      {showHandover && (
        <Card className="mb-3 border-green-300 bg-green-50 ring-2 ring-green-300">
          <CardContent className="p-3 space-y-3">
            <p className="text-xs font-bold text-green-900">
              {showHandover === "WALK_OUT" ? "Walk-out Handover Checklist" : "Delivery Handover Checklist"}
            </p>
            {data.paymentStatus?.hasPending && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-2">
                <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                <p className="text-[10px] text-red-700 font-medium">Payment pending: {formatINR(data.paymentStatus.balance)} balance</p>
              </div>
            )}

            {/* Line items — each must be checked */}
            <div className="space-y-1.5">
              <p className="text-[10px] text-green-800 font-semibold uppercase">Items</p>
              {(data.lineItems || []).map((item, i) => {
                const key = `item-${i}`;
                return (
                  <label key={key} className="flex items-center gap-2 bg-white rounded-lg px-2.5 py-2 border border-green-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checkedItems.has(key)}
                      onChange={(e) => {
                        const next = new Set(checkedItems);
                        e.target.checked ? next.add(key) : next.delete(key);
                        setCheckedItems(next);
                      }}
                      className="rounded border-green-400 text-green-600 focus:ring-green-500"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-900 truncate">{item.name}</p>
                      <p className="text-[10px] text-slate-500">{item.sku} | Qty: {item.quantity}</p>
                    </div>
                    <CheckCircle2 className={`h-4 w-4 shrink-0 ${checkedItems.has(key) ? "text-green-600" : "text-slate-200"}`} />
                  </label>
                );
              })}
              {(!data.lineItems || data.lineItems.length === 0) && (
                <p className="text-[10px] text-slate-400 italic">No line items on this invoice</p>
              )}
            </div>

            {/* Accessories confirmation */}
            <label className="flex items-center gap-2 bg-white rounded-lg px-2.5 py-2 border border-blue-200 cursor-pointer">
              <input
                type="checkbox"
                checked={accessoriesConfirmed}
                onChange={(e) => setAccessoriesConfirmed(e.target.checked)}
                className="rounded border-blue-400 text-blue-600 focus:ring-blue-500"
              />
              <div className="flex-1">
                <p className="text-xs font-medium text-slate-900">Free accessories handed over</p>
                <p className="text-[10px] text-slate-500">
                  {data.freeAccessories || freeAccessories || "None specified"}
                </p>
              </div>
              <Package className={`h-4 w-4 shrink-0 ${accessoriesConfirmed ? "text-blue-600" : "text-slate-200"}`} />
            </label>

            {/* Sales person confirmation */}
            <label className="flex items-center gap-2 bg-white rounded-lg px-2.5 py-2 border border-purple-200 cursor-pointer">
              <input
                type="checkbox"
                checked={salesPersonConfirmed}
                onChange={(e) => setSalesPersonConfirmed(e.target.checked)}
                className="rounded border-purple-400 text-purple-600 focus:ring-purple-500"
              />
              <div className="flex-1">
                <p className="text-xs font-medium text-slate-900">Confirmed with sales person</p>
                <p className="text-[10px] text-slate-500">
                  {data.salesPerson || "—"}
                </p>
              </div>
              <Check className={`h-4 w-4 shrink-0 ${salesPersonConfirmed ? "text-purple-600" : "text-slate-200"}`} />
            </label>

            {/* Confirm / Cancel */}
            {(() => {
              const itemCount = data.lineItems?.length || 0;
              const allItemsChecked = itemCount === 0 || checkedItems.size >= itemCount;
              const allConfirmed = allItemsChecked && accessoriesConfirmed && salesPersonConfirmed;
              return (
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      if (showHandover === "WALK_OUT") {
                        await updateStatus("WALK_OUT");
                      } else {
                        await updateStatus("DELIVERED");
                        if (data.customerPhone) sendDeliveredWhatsApp();
                      }
                      setShowHandover(null);
                      setCheckedItems(new Set());
                      setAccessoriesConfirmed(false);
                      setSalesPersonConfirmed(false);
                    }}
                    disabled={!allConfirmed || actionLoading}
                    className={`flex-1 flex items-center justify-center gap-2 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-40 ${
                      showHandover === "WALK_OUT" ? "bg-green-600" : "bg-green-700"
                    }`}
                  >
                    {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    {actionLoading
                      ? "Processing..."
                      : allConfirmed
                        ? (showHandover === "WALK_OUT" ? "Confirm Walk-out" : "Confirm Delivered")
                        : `Check all items (${checkedItems.size + (accessoriesConfirmed ? 1 : 0) + (salesPersonConfirmed ? 1 : 0)}/${itemCount + 2})`
                    }
                  </button>
                  <button
                    onClick={() => {
                      setShowHandover(null);
                      setCheckedItems(new Set());
                      setAccessoriesConfirmed(false);
                      setSalesPersonConfirmed(false);
                    }}
                    className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium"
                  >
                    Cancel
                  </button>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="space-y-2">
        {data.status === "PENDING" && !showSchedule && !showHandover && (
          <div className="flex gap-2">
            {!contactSaved && data.customerPhone ? (
              <p className="text-xs text-amber-600 font-medium py-2">Save customer contact above to proceed</p>
            ) : (
              <button onClick={() => setShowSchedule(true)}
                className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium">
                Schedule Delivery
              </button>
            )}
          </div>
        )}

        {/* Inside Bangalore: SCHEDULED -> DELIVERED directly */}
        {data.status === "SCHEDULED" && !isOuts && !showHandover && (
          <button onClick={() => setShowHandover("DELIVERED")} disabled={actionLoading}
            className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
            <CheckCircle2 className="h-4 w-4" /> Mark Delivered
          </button>
        )}

        {/* Outstation: SCHEDULED -> dispatch form */}
        {data.status === "SCHEDULED" && isOuts && !showDispatch && (
          <button onClick={() => setShowDispatch(true)} disabled={actionLoading}
            className="w-full flex items-center justify-center gap-2 bg-orange-600 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
            <Truck className="h-4 w-4" /> Dispatch
          </button>
        )}

        {showDispatch && data.status === "SCHEDULED" && isOuts && (
          <Card className="border-orange-200">
            <CardContent className="p-3 space-y-2">
              <p className="text-xs font-semibold text-slate-700">Dispatch Details (Outstation)</p>
              <div>
                <label className="text-[10px] text-slate-500">Courier / Delivery Person *</label>
                <Input value={courierName} onChange={(e) => setCourierName(e.target.value)} placeholder="e.g. DTDC, BlueDart" className="text-xs" />
              </div>
              <div>
                <label className="text-[10px] text-slate-500">Tracking Number</label>
                <Input value={courierTrackingNo} onChange={(e) => setCourierTrackingNo(e.target.value)} placeholder="Tracking ID" className="text-xs" />
              </div>
              <div>
                <label className="text-[10px] text-slate-500">Delivery Cost (₹)</label>
                <Input type="number" value={courierCost} onChange={(e) => setCourierCost(e.target.value)} placeholder="0" className="text-xs" inputMode="numeric" />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    if (!courierName.trim()) { alert("Please enter courier name"); return; }
                    await updateStatus("OUT_FOR_DELIVERY", {
                      courierName: courierName.trim(),
                      courierTrackingNo: courierTrackingNo.trim() || undefined,
                      courierCost: courierCost ? parseFloat(courierCost) : undefined,
                    });
                    setShowDispatch(false);
                    if (data.customerPhone) sendDispatchedWhatsApp();
                  }}
                  disabled={actionLoading}
                  className="flex-1 bg-amber-600 text-white py-2 rounded-lg text-xs font-medium disabled:opacity-50">
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
        {data.status === "IN_TRANSIT" && !showHandover && (
          <button onClick={() => setShowHandover("DELIVERED")} disabled={actionLoading}
            className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
            <CheckCircle2 className="h-4 w-4" /> Mark Delivered
          </button>
        )}

        {data.status === "OUT_FOR_DELIVERY" && !showHandover && (
          <button onClick={() => setShowHandover("DELIVERED")} disabled={actionLoading}
            className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
            <CheckCircle2 className="h-4 w-4" /> Mark Delivered
          </button>
        )}

        {/* Mark as Service — only for PENDING invoices not already tagged */}
        {data.status === "PENDING" && data.invoiceType !== "SERVICE" && !showServiceConfirm && (
          <button onClick={() => setShowServiceConfirm(true)} disabled={actionLoading}
            className="w-full flex items-center justify-center gap-2 bg-purple-100 text-purple-700 border border-purple-200 py-2.5 rounded-lg text-sm font-medium">
            <Wrench className="h-4 w-4" /> Mark as Service Invoice
          </button>
        )}

        {/* Service confirmation dialog */}
        {showServiceConfirm && (
          <Card className="border-amber-300 bg-amber-50">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-900">Mark as Service Invoice?</p>
                  <p className="text-xs text-amber-700 mt-1">This invoice will be moved to the Service section and removed from deliveries. This action cannot be undone.</p>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={markAsService} disabled={actionLoading}
                  className="flex-1 bg-purple-600 text-white py-2 rounded-lg text-xs font-medium disabled:opacity-50">
                  {actionLoading ? "Saving..." : "Yes, it's a Service Invoice"}
                </button>
                <button onClick={() => setShowServiceConfirm(false)}
                  className="flex-1 bg-white text-slate-700 border border-slate-200 py-2 rounded-lg text-xs font-medium">
                  Cancel
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Service invoice banner */}
        {data.invoiceType === "SERVICE" && (
          <Card className="border-purple-200 bg-purple-50">
            <CardContent className="p-3 text-center">
              <Wrench className="h-6 w-6 text-purple-600 mx-auto mb-1" />
              <p className="text-sm font-medium text-purple-900">Service Invoice</p>
              <p className="text-[10px] text-purple-700">No delivery required. Service billing only.</p>
            </CardContent>
          </Card>
        )}

        {data.status === "FLAGGED" && (
          <button onClick={() => updateStatus("PENDING")} disabled={actionLoading}
            className="w-full bg-slate-900 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
            Resolve Flag
          </button>
        )}

        {data.status === "PREBOOKED" && (
          <button onClick={() => updateStatus("PENDING")} disabled={actionLoading}
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
      </>)}

      {/* Extra padding so buttons aren't hidden behind bottom nav */}
      <div className="h-20" />
    </div>
  );
}
