"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, Camera, CheckCircle2, Loader2, Search } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

type Condition = "EXCELLENT" | "GOOD" | "FAIR" | "SCRAP";

const CONDITIONS: { value: Condition; label: string; color: string }[] = [
  { value: "EXCELLENT", label: "Excellent", color: "bg-green-100 border-green-400 text-green-700" },
  { value: "GOOD", label: "Good", color: "bg-blue-100 border-blue-400 text-blue-700" },
  { value: "FAIR", label: "Fair", color: "bg-amber-100 border-amber-400 text-amber-700" },
  { value: "SCRAP", label: "Scrap", color: "bg-red-100 border-red-400 text-red-700" },
];

export default function NewSecondHandPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role || "";
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form fields
  const [zohoInvoiceNo, setZohoInvoiceNo] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [cycleName, setCycleName] = useState("");
  const [condition, setCondition] = useState<Condition | "">("");
  const [costPrice, setCostPrice] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [notes, setNotes] = useState("");

  // UI state
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [createdSku, setCreatedSku] = useState("");

  // Search Zoho for customer details by invoice number
  const handleSearchInvoice = async () => {
    if (!zohoInvoiceNo.trim()) return;
    setSearching(true);
    setError("");
    try {
      const res = await fetch("/api/deliveries/search-zoho", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: zohoInvoiceNo.trim() }),
      });
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      if (data.success && data.data.results?.length > 0) {
        const inv = data.data.results[0];
        setCustomerName(inv.customerName || "");
        setCustomerPhone(inv.phone || "");
      } else {
        setError("Invoice not found in Zoho. Enter customer details manually.");
      }
    } catch {
      setError("Could not search Zoho. Enter customer details manually.");
    } finally {
      setSearching(false);
    }
  };

  // Handle photo capture
  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Compress and convert to base64
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxSize = 800;
        let w = img.width;
        let h = img.height;
        if (w > maxSize || h > maxSize) {
          if (w > h) { h = (h / w) * maxSize; w = maxSize; }
          else { w = (w / h) * maxSize; h = maxSize; }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);
        setPhotoUrl(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const isValid = cycleName && condition && costPrice && parseFloat(costPrice) > 0 && photoUrl && customerName;

  const handleSubmit = async () => {
    if (!isValid) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/second-hand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: cycleName,
          condition,
          costPrice: parseFloat(costPrice),
          photoUrl,
          customerName,
          customerPhone: customerPhone || undefined,
          zohoInvoiceNo: zohoInvoiceNo || undefined,
          notes: notes || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCreatedSku(data.data.sku);
      } else {
        setError(data.error || "Failed to create");
      }
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  // Success screen — show SKU large
  if (createdSku) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
        <h2 className="text-lg font-bold text-slate-900 mb-2">Cycle Added!</h2>
        <p className="text-sm text-slate-500 mb-6">Write this SKU on the cycle</p>

        <div className="bg-orange-50 border-2 border-orange-400 rounded-2xl px-8 py-6 mb-6">
          <p className="text-5xl font-black text-orange-700 tracking-wider">{createdSku}</p>
        </div>

        <p className="text-xs text-slate-400 mb-6">
          {cycleName} | {condition} | {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(parseFloat(costPrice))}
        </p>

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => {
            setCreatedSku("");
            setCycleName("");
            setCondition("");
            setCostPrice("");
            setPhotoUrl("");
            setCustomerName("");
            setCustomerPhone("");
            setZohoInvoiceNo("");
            setNotes("");
          }}>Add Another</Button>
          <Link href="/second-hand">
            <Button className="bg-orange-600 hover:bg-orange-700">View All</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-8">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/second-hand" className="p-1"><ArrowLeft className="h-5 w-5 text-slate-600" /></Link>
        <div>
          <h1 className="text-lg font-bold text-slate-900">Add Second-Hand Cycle</h1>
          <p className="text-xs text-slate-500">Exchange intake</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Step 1: Zoho Invoice Search */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Zoho Invoice No (new cycle sale)</label>
          <div className="flex gap-2">
            <Input placeholder="e.g. 017616" value={zohoInvoiceNo}
              onChange={(e) => setZohoInvoiceNo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearchInvoice()} />
            <Button type="button" variant="outline" onClick={handleSearchInvoice} disabled={searching}
              className="shrink-0">
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Search to auto-fill customer details, or enter manually</p>
        </div>

        {/* Customer Info */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Customer Name *</label>
            <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Who traded in" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
            <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="Phone number" />
          </div>
        </div>

        {/* Cycle Name */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Cycle Name *</label>
          <Input value={cycleName} onChange={(e) => setCycleName(e.target.value)}
            placeholder='e.g. "Hero Sprint 26" or "Firefox Road 700c"' />
        </div>

        {/* Condition */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Condition *</label>
          <div className="grid grid-cols-4 gap-2">
            {CONDITIONS.map((c) => (
              <button key={c.value} type="button" onClick={() => setCondition(c.value)}
                className={`py-2 rounded-lg text-xs font-semibold border-2 transition-all ${
                  condition === c.value ? c.color + " border-current" : "bg-white border-slate-200 text-slate-500"
                }`}>
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Exchange Price (Cost) */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Exchange Price (Cost) *</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
            <Input type="number" value={costPrice} onChange={(e) => setCostPrice(e.target.value)}
              placeholder="0" className="pl-7 text-lg font-semibold" min="0" />
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Amount given to customer for old cycle</p>
        </div>

        {/* Photo (mandatory) */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Photo *</label>
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment"
            onChange={handlePhotoCapture} className="hidden" />

          {photoUrl ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrl} alt="Cycle photo" className="w-full h-48 object-cover rounded-lg border border-slate-200" />
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-2 right-2 bg-white/90 backdrop-blur px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 shadow">
                Retake
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => fileInputRef.current?.click()}
              className="w-full h-32 border-2 border-dashed border-orange-300 rounded-lg flex flex-col items-center justify-center gap-2 bg-orange-50/50 hover:bg-orange-50 transition-colors">
              <Camera className="h-8 w-8 text-orange-400" />
              <span className="text-xs font-medium text-orange-600">Tap to take photo</span>
            </button>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Any additional details..." rows={2}
            className="flex w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-600" />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button type="button" size="lg" disabled={!isValid || submitting} onClick={handleSubmit}
          className="w-full bg-orange-600 hover:bg-orange-700">
          {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Adding...</> : "Add Second-Hand Cycle"}
        </Button>
      </div>
    </div>
  );
}
