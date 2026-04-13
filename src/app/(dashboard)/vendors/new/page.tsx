"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function NewVendorPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "", code: "", gstin: "", pan: "",
    addressLine1: "", city: "", state: "", pincode: "",
    phone: "", email: "", whatsappNumber: "",
    paymentTermDays: 30, creditLimit: 0,
    cdTermsDays: 0, cdPercentage: 0,
  });

  function update(field: string, value: string | number) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.code) return;

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to create vendor");
      router.push("/vendors");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Link href="/vendors" className="p-1">
          <ArrowLeft className="h-5 w-5 text-slate-600" />
        </Link>
        <h1 className="text-lg font-bold text-slate-900">Add Vendor</h1>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg mb-4">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Vendor Name *</label>
            <Input placeholder="Hero Cycles Ltd" value={form.name} onChange={(e) => update("name", e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Code *</label>
            <Input placeholder="HERO" value={form.code} onChange={(e) => update("code", e.target.value.toUpperCase())} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">GSTIN</label>
            <Input placeholder="22AAAAA0000A1Z5" value={form.gstin} onChange={(e) => update("gstin", e.target.value.toUpperCase())} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">PAN</label>
          <Input placeholder="AAAAA0000A" value={form.pan} onChange={(e) => update("pan", e.target.value.toUpperCase())} />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
          <Input placeholder="Street address" value={form.addressLine1} onChange={(e) => update("addressLine1", e.target.value)} />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
            <Input value={form.city} onChange={(e) => update("city", e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">State</label>
            <Input value={form.state} onChange={(e) => update("state", e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Pincode</label>
            <Input value={form.pincode} onChange={(e) => update("pincode", e.target.value)} maxLength={6} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
            <Input type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">WhatsApp</label>
            <Input type="tel" value={form.whatsappNumber} onChange={(e) => update("whatsappNumber", e.target.value)} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
          <Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Payment Terms (days)</label>
            <Input type="number" value={form.paymentTermDays} onChange={(e) => update("paymentTermDays", parseInt(e.target.value) || 0)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Credit Limit</label>
            <Input type="number" value={form.creditLimit} onChange={(e) => update("creditLimit", parseFloat(e.target.value) || 0)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">CD Terms (days)</label>
            <Input type="number" value={form.cdTermsDays} onChange={(e) => update("cdTermsDays", parseInt(e.target.value) || 0)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">CD %</label>
            <Input type="number" step="0.1" value={form.cdPercentage} onChange={(e) => update("cdPercentage", parseFloat(e.target.value) || 0)} />
          </div>
        </div>

        <Button type="submit" size="lg" disabled={!form.name || !form.code || submitting} className="w-full bg-blue-600 hover:bg-blue-700">
          {submitting ? "Creating..." : "Create Vendor"}
        </Button>
      </form>
    </div>
  );
}
