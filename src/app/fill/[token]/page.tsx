"use client";

import { useState, useEffect, use } from "react";
import { CheckCircle2, Loader2, MapPin, Phone, Navigation } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface DeliveryInfo {
  invoiceNo: string;
  customerName: string;
  customerPhone: string | null;
  customerAddress: string | null;
  customerArea: string | null;
  customerPincode: string | null;
  lineItems: Array<{ name: string; quantity: number }> | null;
  selfFillCompletedAt: string | null;
}

export default function CustomerSelfFillPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);

  const [data, setData] = useState<DeliveryInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [address, setAddress] = useState("");
  const [area, setArea] = useState("");
  const [pincode, setPincode] = useState("");
  const [phone, setPhone] = useState("");
  const [alternatePhone, setAlternatePhone] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");

  useEffect(() => {
    fetch(`/api/public/delivery/${token}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setData(res.data);
          setAddress(res.data.customerAddress || "");
          setArea(res.data.customerArea || "");
          setPincode(res.data.customerPincode || "");
          setPhone(res.data.customerPhone || "");
          if (res.data.selfFillCompletedAt) setSubmitted(true);
        } else {
          setError(res.error || "Invalid or expired link");
        }
      })
      .catch(() => setError("Could not connect. Please check your internet and try again."))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async () => {
    if (!address.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/public/delivery/${token}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerAddress: address.trim(),
          customerArea: area.trim() || undefined,
          customerPincode: pincode.trim() || undefined,
          customerPhone: phone.trim() || undefined,
          alternatePhone: alternatePhone.trim() || undefined,
          deliveryNotes: deliveryNotes.trim() || undefined,
        }),
      }).then((r) => r.json());

      if (res.success) {
        setSubmitted(true);
      } else {
        setError(res.error || "Failed to save. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <p className="text-red-600 font-medium text-base">{error}</p>
            <p className="text-slate-400 text-sm mt-2">
              This link may have expired. Please contact the store for a new link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-900 mb-2">Thank You!</h2>
            <p className="text-slate-600 text-sm">
              Your delivery details have been saved. Our team will schedule your delivery shortly.
            </p>
            {data && (
              <div className="mt-4 bg-slate-50 rounded-lg p-3 text-left">
                <p className="text-xs text-slate-500">Invoice</p>
                <p className="text-sm font-medium text-slate-900">{data.invoiceNo}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-md mx-auto space-y-4">
        {/* Store Header */}
        <div className="text-center py-4">
          <h1 className="text-lg font-bold text-slate-900">Bharath Cycle Hub</h1>
          <p className="text-sm text-slate-500">Delivery Details Form</p>
        </div>

        {/* Order Summary */}
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 mb-1">Invoice</p>
            <p className="text-sm font-semibold text-slate-900">{data?.invoiceNo}</p>
            <p className="text-sm text-slate-600 mt-1">{data?.customerName}</p>
            {data?.lineItems && data.lineItems.length > 0 && (
              <div className="mt-2 space-y-1">
                {data.lineItems.slice(0, 3).map((item, i) => (
                  <p key={i} className="text-xs text-slate-500">
                    {item.name} x{item.quantity}
                  </p>
                ))}
                {data.lineItems.length > 3 && (
                  <p className="text-xs text-slate-400">+{data.lineItems.length - 3} more</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Error Banner */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Delivery Address Form */}
        <Card>
          <CardContent className="p-4 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-blue-500" />
              Delivery Address
            </h2>

            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">
                Full Address <span className="text-red-500">*</span>
              </label>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="House no, street, landmark..."
                className="w-full border border-slate-200 rounded-lg p-3 text-sm min-h-[80px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Area</label>
                <input
                  type="text"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder="e.g. Jayanagar"
                  className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Pincode</label>
                <input
                  type="text"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  placeholder="560011"
                  maxLength={6}
                  inputMode="numeric"
                  className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Details */}
        <Card>
          <CardContent className="p-4 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Phone className="h-4 w-4 text-green-500" />
              Contact Details
            </h2>

            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="10-digit mobile number"
                maxLength={10}
                inputMode="tel"
                className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Alternate Phone</label>
              <input
                type="tel"
                value={alternatePhone}
                onChange={(e) => setAlternatePhone(e.target.value)}
                placeholder="Optional"
                maxLength={10}
                inputMode="tel"
                className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </CardContent>
        </Card>

        {/* Delivery Instructions */}
        <Card>
          <CardContent className="p-4">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3">
              <Navigation className="h-4 w-4 text-orange-500" />
              Delivery Instructions
            </h2>
            <textarea
              value={deliveryNotes}
              onChange={(e) => setDeliveryNotes(e.target.value)}
              placeholder="Any special instructions? (e.g. call before delivery, gate code, etc.)"
              className="w-full border border-slate-200 rounded-lg p-3 text-sm min-h-[60px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </CardContent>
        </Card>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={saving || !address.trim()}
          className="w-full bg-blue-600 text-white py-4 rounded-xl text-base font-semibold disabled:opacity-50 disabled:cursor-not-allowed active:bg-blue-700 transition-colors"
        >
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Saving...
            </span>
          ) : (
            "Submit Delivery Details"
          )}
        </button>

        <p className="text-xs text-slate-400 text-center pb-6">
          Bharath Cycle Hub | Your details are secure
        </p>
      </div>
    </div>
  );
}
