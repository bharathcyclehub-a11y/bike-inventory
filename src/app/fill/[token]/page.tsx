"use client";

import { useState, useEffect, use } from "react";
import { CheckCircle2, Loader2, MapPin, Phone, Navigation, Calendar, ChevronRight } from "lucide-react";
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

interface SlotDay {
  date: string;
  available: boolean;
  spotsLeft: number;
  reason: "FULL" | "CUTOFF" | "PAST" | null;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatSlotDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return `${DAY_LABELS[d.getDay()]} ${d.getDate()} ${MONTH_LABELS[d.getMonth()]}`;
}

export default function CustomerSelfFillPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);

  const [data, setData] = useState<DeliveryInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  // Step 0: delivery type
  const [deliveryType, setDeliveryType] = useState<"BANGALORE" | "OUTSIDE" | null>(null);

  // Bangalore form fields
  const [address, setAddress] = useState("");
  const [area, setArea] = useState("");
  const [pincode, setPincode] = useState("");
  const [mapsLink, setMapsLink] = useState("");
  const [phone, setPhone] = useState("");
  const [alternatePhone, setAlternatePhone] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");

  // Outside Bangalore form fields
  const [outstationAddress, setOutstationAddress] = useState("");
  const [outstationPincode, setOutstationPincode] = useState("");
  const [outstationPhone, setOutstationPhone] = useState("");
  const [outstationAltPhone, setOutstationAltPhone] = useState("");
  const [outstationNotes, setOutstationNotes] = useState("");

  // Slot selection (Bangalore only)
  const [slots, setSlots] = useState<SlotDay[]>([]);
  const [nextAvailable, setNextAvailable] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);

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
          setOutstationAddress(res.data.customerAddress || "");
          setOutstationPincode(res.data.customerPincode || "");
          setOutstationPhone(res.data.customerPhone || "");
          if (res.data.selfFillCompletedAt) setSubmitted(true);
        } else {
          setError(res.error || "Invalid or expired link");
        }
      })
      .catch(() => setError("Could not connect. Please check your internet and try again."))
      .finally(() => setLoading(false));
  }, [token]);

  // Load slots when customer selects Bangalore
  useEffect(() => {
    if (deliveryType !== "BANGALORE") return;
    setSlotsLoading(true);
    fetch("/api/public/delivery-slots")
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setSlots(res.data.slots);
          setNextAvailable(res.data.nextAvailable);
          if (res.data.nextAvailable) setSelectedDate(res.data.nextAvailable);
        }
      })
      .catch(() => {})
      .finally(() => setSlotsLoading(false));
  }, [deliveryType]);

  const handleSubmit = async () => {
    if (deliveryType === "BANGALORE") {
      if (!address.trim()) return;
      if (!pincode.trim() || !/^\d{6}$/.test(pincode.trim())) return;
      if (!selectedDate) return;
    } else {
      if (!outstationAddress.trim()) return;
      if (!outstationPincode.trim()) return;
    }

    setSaving(true);
    try {
      const payload =
        deliveryType === "BANGALORE"
          ? {
              isOutstation: false,
              customerAddress: address.trim(),
              customerArea: area.trim() || undefined,
              customerPincode: pincode.trim() || undefined,
              mapsLink: mapsLink.trim() || undefined,
              customerPhone: phone.trim() || undefined,
              alternatePhone: alternatePhone.trim() || undefined,
              deliveryNotes: deliveryNotes.trim() || undefined,
              requestedDate: selectedDate,
            }
          : {
              isOutstation: true,
              customerAddress: outstationAddress.trim(),
              customerPincode: outstationPincode.trim() || undefined,
              customerPhone: outstationPhone.trim() || undefined,
              alternatePhone: outstationAltPhone.trim() || undefined,
              deliveryNotes: outstationNotes.trim() || undefined,
            };

      const res = await fetch(`/api/public/delivery/${token}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then((r) => r.json());

      if (res.success) {
        setSubmitted(true);
      } else if (res.error?.includes("slot is now full")) {
        setError("This date just got fully booked. Please choose another date.");
        // Refresh slots
        fetch("/api/public/delivery-slots")
          .then((r) => r.json())
          .then((res2) => {
            if (res2.success) {
              setSlots(res2.data.slots);
              setNextAvailable(res2.data.nextAvailable);
              setSelectedDate(res2.data.nextAvailable);
            }
          })
          .catch(() => {});
      } else {
        setError(res.error || "Failed to save. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ── Loading state ──
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  // ── Error state (no data) ──
  if (error && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <p className="text-red-600 font-medium text-base">{error}</p>
            <p className="text-slate-400 text-sm mt-2">This link may have expired. Please contact the store for a new link.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Already submitted ──
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-900 mb-2">Thank You!</h2>
            <p className="text-slate-600 text-sm">
              Your delivery details have been saved. Our team will contact you before the delivery.
            </p>
            {selectedDate && (
              <div className="mt-4 bg-blue-50 rounded-lg p-3 text-left">
                <p className="text-xs text-blue-600 font-medium">Requested Delivery Date</p>
                <p className="text-sm font-semibold text-blue-900">{formatSlotDate(selectedDate)} at 6:00 PM</p>
              </div>
            )}
            {data && (
              <div className="mt-3 bg-slate-50 rounded-lg p-3 text-left">
                <p className="text-xs text-slate-500">Invoice</p>
                <p className="text-sm font-medium text-slate-900">{data.invoiceNo}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const bangaloreFormValid =
    address.trim().length >= 5 &&
    /^\d{6}$/.test(pincode.trim()) &&
    selectedDate !== null;

  const outstationFormValid =
    outstationAddress.trim().length >= 5 &&
    outstationPincode.trim().length >= 1;

  const canSubmit =
    deliveryType === "BANGALORE" ? bangaloreFormValid : deliveryType === "OUTSIDE" ? outstationFormValid : false;

  return (
    <div className="min-h-screen bg-slate-50 p-4 pb-10">
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
              <div className="mt-2 space-y-0.5">
                {data.lineItems.slice(0, 3).map((item, i) => (
                  <p key={i} className="text-xs text-slate-500">{item.name} ×{item.quantity}</p>
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

        {/* ── STEP 0: Bangalore / Outside ── */}
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-bold text-slate-900 mb-3">Where should we deliver?</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => { setDeliveryType("BANGALORE"); setError(""); }}
                className={`py-4 rounded-xl text-sm font-semibold border-2 transition-all ${
                  deliveryType === "BANGALORE"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-slate-700 border-slate-200"
                }`}
              >
                🏙️ Inside Bangalore
              </button>
              <button
                onClick={() => { setDeliveryType("OUTSIDE"); setError(""); }}
                className={`py-4 rounded-xl text-sm font-semibold border-2 transition-all ${
                  deliveryType === "OUTSIDE"
                    ? "bg-amber-600 text-white border-amber-600"
                    : "bg-white text-slate-700 border-slate-200"
                }`}
              >
                🚚 Outside Bangalore
              </button>
            </div>
          </CardContent>
        </Card>

        {/* ── BANGALORE FORM ── */}
        {deliveryType === "BANGALORE" && (
          <>
            <Card>
              <CardContent className="p-4 space-y-4">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-blue-500" /> Delivery Address
                </h2>

                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">
                    Full Address <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="House no, street, landmark..."
                    className="w-full border border-slate-200 rounded-lg p-3 text-sm min-h-[72px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
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
                    <label className="text-xs font-medium text-slate-600 block mb-1">
                      Pincode <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value)}
                      placeholder="560011"
                      maxLength={6}
                      inputMode="numeric"
                      className={`w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        pincode && !/^\d{6}$/.test(pincode) ? "border-red-300 bg-red-50" : "border-slate-200"
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">
                    Google Maps Location Link <span className="text-slate-400 font-normal">(optional — share later if needed)</span>
                  </label>
                  <input
                    type="url"
                    value={mapsLink}
                    onChange={(e) => setMapsLink(e.target.value)}
                    placeholder="https://maps.app.goo.gl/..."
                    className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    inputMode="url"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Open Google Maps → tap &apos;Share&apos; → paste the link here</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-4">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Phone className="h-4 w-4 text-green-500" /> Contact Details
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

            <Card>
              <CardContent className="p-4">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3">
                  <Navigation className="h-4 w-4 text-orange-500" /> Delivery Instructions
                </h2>
                <textarea
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  placeholder="Call before delivery, gate code, building number..."
                  className="w-full border border-slate-200 rounded-lg p-3 text-sm min-h-[60px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                />
              </CardContent>
            </Card>

            {/* Slot Picker */}
            <Card>
              <CardContent className="p-4">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-1">
                  <Calendar className="h-4 w-4 text-purple-500" /> Choose Delivery Date <span className="text-red-500 font-normal text-xs">*</span>
                </h2>
                <p className="text-xs text-slate-500 mb-3">Delivery at 6:00 PM. Max 10 deliveries per day.</p>

                {slotsLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                  </div>
                ) : (
                  <>
                    {nextAvailable && (
                      <p className="text-xs text-green-700 font-medium mb-2">
                        ✓ Earliest available: {formatSlotDate(nextAvailable)}
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      {slots.filter((s) => !s.reason || s.reason !== "PAST").slice(0, 10).map((slot) => (
                        <button
                          key={slot.date}
                          disabled={!slot.available}
                          onClick={() => { setSelectedDate(slot.date); setError(""); }}
                          className={`py-3 px-3 rounded-xl text-xs font-medium text-left transition-all border-2 ${
                            !slot.available
                              ? "bg-slate-100 text-slate-400 border-slate-100 cursor-not-allowed"
                              : selectedDate === slot.date
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-white text-slate-700 border-slate-200 active:bg-blue-50"
                          }`}
                        >
                          <span className="block font-semibold">{formatSlotDate(slot.date)}</span>
                          <span className="block text-[10px] mt-0.5">
                            {!slot.available
                              ? slot.reason === "FULL"
                                ? "Full"
                                : slot.reason === "CUTOFF"
                                ? "Cutoff passed"
                                : ""
                              : `${slot.spotsLeft} slot${slot.spotsLeft === 1 ? "" : "s"} left`}
                          </span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* ── OUTSIDE BANGALORE FORM ── */}
        {deliveryType === "OUTSIDE" && (
          <>
            <Card>
              <CardContent className="p-4 space-y-4">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-amber-500" /> Delivery Address
                </h2>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">
                    Full Address (with city, state) <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={outstationAddress}
                    onChange={(e) => setOutstationAddress(e.target.value)}
                    placeholder="House no, street, area, city, state..."
                    className="w-full border border-slate-200 rounded-lg p-3 text-sm min-h-[88px] focus:ring-2 focus:ring-amber-400 resize-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">
                    Pincode <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={outstationPincode}
                    onChange={(e) => setOutstationPincode(e.target.value)}
                    placeholder="6-digit pincode"
                    maxLength={6}
                    inputMode="numeric"
                    className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-4">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Phone className="h-4 w-4 text-green-500" /> Contact Details
                </h2>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={outstationPhone}
                    onChange={(e) => setOutstationPhone(e.target.value)}
                    placeholder="10-digit mobile number"
                    maxLength={10}
                    inputMode="tel"
                    className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-amber-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Alternate Phone</label>
                  <input
                    type="tel"
                    value={outstationAltPhone}
                    onChange={(e) => setOutstationAltPhone(e.target.value)}
                    placeholder="Optional"
                    maxLength={10}
                    inputMode="tel"
                    className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3">
                  <Navigation className="h-4 w-4 text-orange-500" /> Courier Instructions
                </h2>
                <textarea
                  value={outstationNotes}
                  onChange={(e) => setOutstationNotes(e.target.value)}
                  placeholder="Any packing instructions, fragile items, assembly notes..."
                  className="w-full border border-slate-200 rounded-lg p-3 text-sm min-h-[60px] focus:ring-2 focus:ring-amber-400 resize-none"
                />
              </CardContent>
            </Card>
          </>
        )}

        {/* Submit */}
        {deliveryType && (
          <button
            onClick={handleSubmit}
            disabled={saving || !canSubmit}
            className={`w-full py-4 rounded-xl text-base font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 ${
              deliveryType === "OUTSIDE"
                ? "bg-amber-600 active:bg-amber-700 text-white"
                : "bg-blue-600 active:bg-blue-700 text-white"
            }`}
          >
            {saving ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
            ) : (
              <><ChevronRight className="h-4 w-4" /> Submit Delivery Details</>
            )}
          </button>
        )}

        <p className="text-xs text-slate-400 text-center pb-4">
          Bharath Cycle Hub | Your details are secure
        </p>
      </div>
    </div>
  );
}
