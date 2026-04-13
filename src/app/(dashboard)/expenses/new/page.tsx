"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const CATEGORIES = [
  "DELIVERY", "TRANSPORT", "SHOP_MAINTENANCE", "UTILITIES",
  "SALARY_ADVANCE", "FOOD_TEA", "STATIONERY", "MISCELLANEOUS",
];

const PAYMENT_MODES = ["CASH", "CHEQUE", "NEFT", "RTGS", "UPI"];

export default function NewExpensePage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    amount: "",
    category: "MISCELLANEOUS",
    description: "",
    paidBy: "",
    paymentMode: "CASH",
    referenceNo: "",
    notes: "",
  });

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.amount || !form.description || !form.paidBy) return;

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          amount: parseFloat(form.amount),
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to record expense");
      router.push("/expenses");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Link href="/expenses" className="p-1">
          <ArrowLeft className="h-5 w-5 text-slate-600" />
        </Link>
        <h1 className="text-lg font-bold text-slate-900">Record Expense</h1>
      </div>

      {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg mb-4">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Date *</label>
          <Input type="date" value={form.date} onChange={(e) => update("date", e.target.value)} />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Amount *</label>
          <Input
            type="number"
            placeholder="0.00"
            value={form.amount}
            onChange={(e) => update("amount", e.target.value)}
            min="0.01"
            step="0.01"
            className="text-lg"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Category *</label>
          <select
            value={form.category}
            onChange={(e) => update("category", e.target.value)}
            className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Description *</label>
          <Input
            placeholder="What was this expense for?"
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Paid By *</label>
          <Input
            placeholder="Person who paid"
            value={form.paidBy}
            onChange={(e) => update("paidBy", e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Payment Mode</label>
          <div className="flex flex-wrap gap-2">
            {PAYMENT_MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => update("paymentMode", mode)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  form.paymentMode === mode ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Reference No</label>
          <Input placeholder="Optional reference" value={form.referenceNo} onChange={(e) => update("referenceNo", e.target.value)} />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
          <textarea
            placeholder="Any additional notes..."
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
            rows={2}
            className="flex w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>

        <Button
          type="submit"
          size="lg"
          disabled={!form.amount || !form.description || !form.paidBy || submitting}
          className="w-full bg-blue-600 hover:bg-blue-700"
        >
          {submitting ? "Recording..." : "Record Expense"}
        </Button>
      </form>
    </div>
  );
}
