"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Phone, MapPin, Clock, CheckCircle2, Truck,
  Flag, AlertTriangle, Loader2, Package,
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
}

const STATUS_STEPS = ["PENDING", "VERIFIED", "SCHEDULED", "OUT_FOR_DELIVERY", "DELIVERED"];

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
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [id]); // eslint-disable-line

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
      await fetch(`/api/deliveries/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "SCHEDULED",
          customerAddress: address,
          customerArea: area,
          customerPincode: pincode,
          scheduledDate: schedDate,
          deliveryNotes: delNotes,
        }),
      });
      setShowSchedule(false);
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

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
  }
  if (!data) {
    return <div className="text-center py-12"><p className="text-slate-400">Not found</p><Link href="/deliveries" className="text-blue-600 text-sm">Back</Link></div>;
  }

  const stepIdx = STATUS_STEPS.indexOf(data.status);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <Link href="/deliveries" className="p-1"><ArrowLeft className="h-5 w-5 text-slate-600" /></Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-slate-900">{data.invoiceNo}</h1>
          <p className="text-xs text-slate-500">{data.customerName} | {formatINR(data.invoiceAmount)}</p>
        </div>
        <Badge variant={data.status === "FLAGGED" ? "danger" : data.status === "DELIVERED" || data.status === "WALK_OUT" ? "success" : "info"}>
          {data.status === "OUT_FOR_DELIVERY" ? "Out" : data.status === "WALK_OUT" ? "Walk-out" : data.status.charAt(0) + data.status.slice(1).toLowerCase().replace(/_/g, " ")}
        </Badge>
      </div>

      {/* Progress Steps */}
      {!["FLAGGED", "WALK_OUT", "PREBOOKED"].includes(data.status) && (
        <div className="flex items-center gap-1 mb-3">
          {STATUS_STEPS.map((step, i) => (
            <div key={step} className="flex-1">
              <div className={`h-1.5 rounded-full ${i <= stepIdx ? "bg-blue-500" : "bg-slate-200"}`} />
              <p className={`text-[8px] mt-0.5 text-center ${i <= stepIdx ? "text-blue-600 font-medium" : "text-slate-400"}`}>
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
                <label className="text-[10px] text-slate-500">Pincode</label>
                <Input value={pincode} onChange={(e) => setPincode(e.target.value)} placeholder="560034" className="text-xs" />
              </div>
            </div>
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
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-xs font-medium disabled:opacity-50">
                {actionLoading ? "Scheduling..." : "Schedule"}
              </button>
              <button onClick={() => setShowSchedule(false)} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium">Cancel</button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delivery Info */}
      {data.scheduledDate && (
        <Card className="mb-3">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-600" />
              <p className="text-xs text-slate-700">
                Delivery: <span className="font-medium">{new Date(data.scheduledDate).toLocaleDateString("en-IN")}</span>
                {data.deliveryNotes && ` — ${data.deliveryNotes}`}
              </p>
            </div>
            {data.dispatchedAt && <p className="text-[10px] text-slate-500 ml-6 mt-0.5">Dispatched: {new Date(data.dispatchedAt).toLocaleString("en-IN")}</p>}
            {data.deliveredAt && <p className="text-[10px] text-green-600 ml-6 mt-0.5">Delivered: {new Date(data.deliveredAt).toLocaleString("en-IN")}</p>}
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
              if (!confirm("Mark as walk-out? Stock will be deducted.")) return;
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

        {data.status === "SCHEDULED" && (
          <button onClick={() => updateStatus("OUT_FOR_DELIVERY")} disabled={actionLoading}
            className="w-full flex items-center justify-center gap-2 bg-orange-600 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
            <Truck className="h-4 w-4" /> Dispatch
          </button>
        )}

        {data.status === "OUT_FOR_DELIVERY" && (
          <button onClick={() => {
            if (!confirm("Mark as delivered? Stock will be deducted.")) return;
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
