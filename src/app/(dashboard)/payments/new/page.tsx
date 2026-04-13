"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface VendorOption { id: string; name: string; code: string; }
interface BillOption { id: string; billNo: string; amount: number; paidAmount: number; vendorId: string; }

const PAYMENT_MODES = ["CASH", "CHEQUE", "NEFT", "RTGS", "UPI"];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}

export default function NewPaymentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetBillId = searchParams.get("billId") || "";

  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [bills, setBills] = useState<BillOption[]>([]);
  const [vendorId, setVendorId] = useState("");
  const [billId, setBillId] = useState(presetBillId);
  const [amount, setAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState("CASH");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [referenceNo, setReferenceNo] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/vendors?limit=100")
      .then((r) => r.json())
      .then((res) => { if (res.success) setVendors(res.data); });
  }, []);

  useEffect(() => {
    if (!vendorId) { setBills([]); return; }
    fetch(`/api/bills?vendorId=${vendorId}&status=PENDING&limit=50`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          const allBills = res.data as BillOption[];
          setBills(allBills);
          // Also fetch partially paid
          fetch(`/api/bills?vendorId=${vendorId}&status=PARTIALLY_PAID&limit=50`)
            .then((r2) => r2.json())
            .then((res2) => {
              if (res2.success) setBills([...allBills, ...res2.data]);
            });
        }
      });
  }, [vendorId]);

  const selectedBill = bills.find((b) => b.id === billId);
  const billRemaining = selectedBill ? selectedBill.amount - selectedBill.paidAmount : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!vendorId || !amount || !paymentDate) return;

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId,
          billId: billId || undefined,
          amount: parseFloat(amount),
          paymentMode,
          paymentDate,
          referenceNo,
          notes,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to record payment");
      router.push("/accounts");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Link href="/accounts" className="p-1">
          <ArrowLeft className="h-5 w-5 text-slate-600" />
        </Link>
        <h1 className="text-lg font-bold text-slate-900">Record Payment</h1>
      </div>

      {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg mb-4">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Vendor *</label>
          <select
            value={vendorId}
            onChange={(e) => { setVendorId(e.target.value); setBillId(""); }}
            className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          >
            <option value="">Select vendor...</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>{v.name} ({v.code})</option>
            ))}
          </select>
        </div>

        {vendorId && bills.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Against Bill (optional)</label>
            <select
              value={billId}
              onChange={(e) => {
                setBillId(e.target.value);
                const bill = bills.find((b) => b.id === e.target.value);
                if (bill) setAmount(String(bill.amount - bill.paidAmount));
              }}
              className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              <option value="">Advance / No bill</option>
              {bills.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.billNo} — Due: {formatCurrency(b.amount - b.paidAmount)}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Amount *</label>
          <Input
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min="0.01"
            step="0.01"
            className="text-lg"
          />
          {selectedBill && (
            <p className="text-xs text-slate-500 mt-1">
              Bill remaining: {formatCurrency(billRemaining)}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Payment Mode *</label>
          <div className="flex flex-wrap gap-2">
            {PAYMENT_MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setPaymentMode(mode)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  paymentMode === mode ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Payment Date *</label>
          <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Reference No</label>
          <Input placeholder="Cheque/UTR/Transaction No" value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
          <textarea
            placeholder="Any notes..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="flex w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>

        <Button type="submit" size="lg" disabled={!vendorId || !amount || submitting} className="w-full bg-blue-600 hover:bg-blue-700">
          {submitting ? "Recording..." : "Record Payment"}
        </Button>
      </form>
    </div>
  );
}
