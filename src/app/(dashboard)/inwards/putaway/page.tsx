"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Loader2, Package, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface PutawayTransaction {
  id: string;
  quantity: number;
  referenceNo: string | null;
  notes: string | null;
  createdAt: string;
  product: {
    id: string;
    name: string;
    sku: string;
    binId: string | null;
    brand: { name: string } | null;
  };
  user: { name: string };
}

interface Bin {
  id: string;
  code: string;
  name: string;
  location: string;
  zone: string | null;
}

export default function PutawayPage() {
  const searchParams = useSearchParams();
  const ref = searchParams.get("ref") || "";

  const [transactions, setTransactions] = useState<PutawayTransaction[]>([]);
  const [verifiedCount, setVerifiedCount] = useState(0);
  const [bins, setBins] = useState<Bin[]>([]);
  const [binSelections, setBinSelections] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ verified: number; errors: { transactionId: string; error: string }[] } | null>(null);

  const fetchData = useCallback(async () => {
    if (!ref) return;
    setLoading(true);
    try {
      const [txRes, binRes] = await Promise.all([
        fetch(`/api/inventory/inwards/putaway?ref=${encodeURIComponent(ref)}`).then((r) => r.json()),
        fetch("/api/bins").then((r) => r.json()),
      ]);

      if (txRes.success) {
        const unverified: PutawayTransaction[] = txRes.data.unverified;
        setTransactions(unverified);
        setVerifiedCount(txRes.data.verifiedCount || 0);

        // Default bin selections to each product's current binId
        const defaults: Record<string, string> = {};
        for (const t of unverified) {
          if (t.product.binId) {
            defaults[t.id] = t.product.binId;
          }
        }
        setBinSelections(defaults);
      }

      if (binRes.success) {
        setBins(binRes.data);
      }
    } catch {
      setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [ref]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleBinChange = (transactionId: string, binId: string) => {
    setBinSelections((prev) => ({ ...prev, [transactionId]: binId }));
  };

  const handleConfirmAll = async () => {
    setSubmitting(true);
    setError("");
    setResult(null);

    try {
      const payload = {
        transactions: transactions.map((t) => ({
          transactionId: t.id,
          binId: binSelections[t.id] || undefined,
        })),
      };

      const res = await fetch("/api/inventory/inwards/putaway", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        setResult(data.data);
        if (data.data.errors.length === 0) {
          setDone(true);
        } else {
          // Partial success — re-fetch to show remaining items
          setError(`${data.data.verified} verified, ${data.data.errors.length} failed`);
          fetchData();
        }
      } else {
        setError(data.error || "Putaway failed");
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setSubmitting(false);
    }
  };

  // No bill reference provided
  if (!ref) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-sm text-slate-500 mb-4">No bill reference specified</p>
        <Link href="/inwards" className="text-sm text-blue-600 underline">
          Back to Inwards
        </Link>
      </div>
    );
  }

  // Success state
  if (done) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="rounded-full bg-green-100 p-4 mb-4">
          <CheckCircle2 className="h-10 w-10 text-green-600" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-1">All Items Verified & Stocked</h2>
        <p className="text-sm text-slate-500 mb-1">
          Bill {ref} — {result?.verified} item{result?.verified !== 1 ? "s" : ""} putaway
        </p>
        {verifiedCount > 0 && (
          <p className="text-xs text-slate-400 mb-4">
            ({verifiedCount} previously verified)
          </p>
        )}
        <Link
          href="/inwards"
          className="mt-2 inline-flex items-center gap-1.5 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Inwards
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Link
          href="/inwards"
          className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4 text-slate-600" />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-slate-900">Putaway</h1>
          <p className="text-sm text-slate-500">Bill {ref}</p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 mb-3 text-xs text-red-700">
          {error}
          <button onClick={() => setError("")} className="ml-2 underline">
            dismiss
          </button>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-2/3 mb-2" />
                <div className="h-3 bg-slate-200 rounded w-1/3 mb-3" />
                <div className="h-9 bg-slate-200 rounded w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : transactions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="rounded-full bg-green-100 p-3 mb-3">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <p className="text-sm font-medium text-slate-700 mb-1">
            No pending items for this bill
          </p>
          {verifiedCount > 0 && (
            <p className="text-xs text-slate-400 mb-4">
              All {verifiedCount} item{verifiedCount !== 1 ? "s" : ""} already verified
            </p>
          )}
          <Link href="/inwards" className="text-sm text-blue-600 underline">
            Back to Inwards
          </Link>
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-amber-600" />
              <span className="text-xs font-medium text-amber-800">
                {transactions.length} item{transactions.length !== 1 ? "s" : ""} pending putaway
              </span>
            </div>
            {verifiedCount > 0 && (
              <Badge variant="success" className="text-[10px]">
                {verifiedCount} already done
              </Badge>
            )}
          </div>

          {/* Item Cards */}
          <div className="space-y-2.5">
            {transactions.map((t) => (
              <Card key={t.id} className="overflow-hidden">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {t.product.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {t.product.sku}
                        {t.product.brand?.name ? ` | ${t.product.brand.name}` : ""}
                      </p>
                    </div>
                    <Badge variant="info" className="ml-2 shrink-0 text-xs font-bold">
                      x{t.quantity}
                    </Badge>
                  </div>

                  {/* Bin Selection */}
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <select
                      value={binSelections[t.id] || ""}
                      onChange={(e) => handleBinChange(t.id, e.target.value)}
                      className="flex-1 text-sm border border-slate-200 rounded-lg px-2.5 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 appearance-none"
                    >
                      <option value="">No bin assigned</option>
                      {bins.map((bin) => (
                        <option key={bin.id} value={bin.id}>
                          {bin.code} — {bin.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Result errors (partial failure) */}
          {result && result.errors.length > 0 && (
            <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-red-700 mb-1">
                {result.errors.length} item{result.errors.length !== 1 ? "s" : ""} failed:
              </p>
              {result.errors.map((e, i) => (
                <p key={i} className="text-[10px] text-red-600">
                  {e.error}
                </p>
              ))}
            </div>
          )}

          {/* Confirm All Button — fixed at bottom for mobile */}
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 z-40">
            <Button
              onClick={handleConfirmAll}
              disabled={submitting || transactions.length === 0}
              className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-semibold text-sm rounded-xl disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Verifying...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Confirm All ({transactions.length} items)
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
