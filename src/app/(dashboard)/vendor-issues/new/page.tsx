"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface VendorOption {
  id: string;
  name: string;
  code: string;
}
interface BillOption {
  id: string;
  billNo: string;
  amount: number;
}

const ISSUE_TYPES = [
  "QUALITY",
  "SHORTAGE",
  "DAMAGE",
  "WRONG_ITEM",
  "BILLING_ERROR",
  "DELIVERY_DELAY",
  "OTHER",
] as const;

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

const ISSUE_TYPE_COLORS: Record<string, string> = {
  QUALITY: "bg-red-100 text-red-700 border-red-200",
  SHORTAGE: "bg-orange-100 text-orange-700 border-orange-200",
  DAMAGE: "bg-red-100 text-red-700 border-red-200",
  WRONG_ITEM: "bg-purple-100 text-purple-700 border-purple-200",
  BILLING_ERROR: "bg-blue-100 text-blue-700 border-blue-200",
  DELIVERY_DELAY: "bg-yellow-100 text-yellow-700 border-yellow-200",
  OTHER: "bg-slate-100 text-slate-700 border-slate-200",
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "bg-slate-100 text-slate-700 border-slate-200",
  MEDIUM: "bg-blue-100 text-blue-700 border-blue-200",
  HIGH: "bg-orange-100 text-orange-700 border-orange-200",
  URGENT: "bg-red-100 text-red-700 border-red-200",
};

export default function NewVendorIssuePage() {
  const router = useRouter();

  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [bills, setBills] = useState<BillOption[]>([]);
  const [vendorId, setVendorId] = useState("");
  const [issueType, setIssueType] = useState<string>("");
  const [priority, setPriority] = useState<string>("MEDIUM");
  const [description, setDescription] = useState("");
  const [billId, setBillId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/vendors?limit=100")
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setVendors(res.data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!vendorId) {
      setBills([]);
      setBillId("");
      return;
    }
    fetch(`/api/bills?vendorId=${vendorId}&limit=50`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setBills(res.data);
      })
      .catch(() => {});
  }, [vendorId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!vendorId || !issueType || !description.trim()) return;

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/vendor-issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId,
          issueType,
          description: description.trim(),
          priority,
          billId: billId || undefined,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to create issue");
      router.push("/vendor-issues");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Link href="/vendor-issues" className="p-1">
          <ArrowLeft className="h-5 w-5 text-slate-600" />
        </Link>
        <h1 className="text-lg font-bold text-slate-900">New Issue</h1>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Vendor */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Vendor *
          </label>
          <select
            value={vendorId}
            onChange={(e) => {
              setVendorId(e.target.value);
              setBillId("");
            }}
            className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          >
            <option value="">Select vendor...</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} ({v.code})
              </option>
            ))}
          </select>
        </div>

        {/* Issue Type */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Issue Type *
          </label>
          <div className="flex flex-wrap gap-2">
            {ISSUE_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setIssueType(type)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  issueType === type
                    ? ISSUE_TYPE_COLORS[type]
                    : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {type.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        </div>

        {/* Priority */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Priority *
          </label>
          <div className="flex flex-wrap gap-2">
            {PRIORITIES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  priority === p
                    ? PRIORITY_COLORS[p]
                    : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Description *
          </label>
          <textarea
            placeholder="Describe the issue in detail..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="flex w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>

        {/* Bill (optional, only when vendor selected) */}
        {vendorId && bills.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Related Bill (optional)
            </label>
            <select
              value={billId}
              onChange={(e) => setBillId(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              <option value="">No bill</option>
              {bills.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.billNo}
                </option>
              ))}
            </select>
          </div>
        )}

        <Button
          type="submit"
          size="lg"
          disabled={!vendorId || !issueType || !description.trim() || submitting}
          className="w-full bg-blue-600 hover:bg-blue-700"
        >
          {submitting ? "Creating..." : "Create Issue"}
        </Button>
      </form>
    </div>
  );
}
