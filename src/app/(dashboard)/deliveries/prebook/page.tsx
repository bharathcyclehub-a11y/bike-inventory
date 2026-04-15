"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function PrebookPage() {
  const router = useRouter();
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [productDesc, setProductDesc] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!customerName || !invoiceNo) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/deliveries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          customerPhone: customerPhone || undefined,
          invoiceNo,
          invoiceAmount: invoiceAmount ? parseFloat(invoiceAmount) : 0,
          expectedReadyDate: expectedDate || undefined,
          prebookNotes: notes || undefined,
          lineItems: productDesc ? [{ name: productDesc, quantity: 1 }] : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        router.push("/deliveries");
      } else {
        setError(data.error || "Failed to create prebook");
      }
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Link href="/deliveries" className="p-1"><ArrowLeft className="h-5 w-5 text-slate-600" /></Link>
        <h1 className="text-lg font-bold text-slate-900">New Prebook</h1>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Customer Name *</label>
          <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Customer name" />
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Phone</label>
          <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Phone number" type="tel" />
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Invoice / Reference No *</label>
          <Input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="INV-2024-XXX or PB-001" />
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Advance Amount</label>
          <Input value={invoiceAmount} onChange={(e) => setInvoiceAmount(e.target.value)} placeholder="0" type="number" inputMode="numeric" />
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Product / Cycle Description</label>
          <Input value={productDesc} onChange={(e) => setProductDesc(e.target.value)} placeholder="e.g. Hero Sprint 26&quot; Red" />
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Expected Ready Date</label>
          <Input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Notes</label>
          <textarea
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 min-h-[60px]"
            placeholder="Any notes about the prebook..."
            value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <button onClick={handleSubmit} disabled={!customerName || !invoiceNo || submitting}
          className="w-full bg-slate-900 text-white py-3 rounded-lg text-sm font-medium disabled:opacity-50">
          {submitting ? "Creating..." : "Create Prebook"}
        </button>
      </div>
    </div>
  );
}
