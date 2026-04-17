"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Loader2, Package, MapPin, CheckSquare, Square } from "lucide-react";
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

// A single unit row exploded from a transaction with qty > 1
interface UnitRow {
  unitKey: string; // "txnId-0", "txnId-1", etc.
  transactionId: string;
  unitIndex: number;
  totalUnits: number;
  product: PutawayTransaction["product"];
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
  const [unitRows, setUnitRows] = useState<UnitRow[]>([]);
  const [verifiedCount, setVerifiedCount] = useState(0);
  const [bins, setBins] = useState<Bin[]>([]);
  const [binSelections, setBinSelections] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ verified: number; errors: { transactionId: string; error: string }[] } | null>(null);

  // Explode transactions into individual unit rows
  const explodeToUnits = (txns: PutawayTransaction[]): UnitRow[] => {
    const rows: UnitRow[] = [];
    for (const t of txns) {
      for (let i = 0; i < t.quantity; i++) {
        rows.push({
          unitKey: `${t.id}-${i}`,
          transactionId: t.id,
          unitIndex: i,
          totalUnits: t.quantity,
          product: t.product,
        });
      }
    }
    return rows;
  };

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
        const rows = explodeToUnits(unverified);
        setUnitRows(rows);
        setVerifiedCount(txRes.data.verifiedCount || 0);
        // Select all unit rows by default
        setSelected(new Set(rows.map((r) => r.unitKey)));

        const defaults: Record<string, string> = {};
        for (const r of rows) {
          if (r.product.binId) {
            defaults[r.unitKey] = r.product.binId;
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

  const handleBinChange = (unitKey: string, binId: string) => {
    setBinSelections((prev) => ({ ...prev, [unitKey]: binId }));
  };

  const toggleItem = (unitKey: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(unitKey) ? next.delete(unitKey) : next.add(unitKey);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(unitRows.map((r) => r.unitKey)));
  const deselectAll = () => setSelected(new Set());
  const allSelected = unitRows.length > 0 && selected.size === unitRows.length;

  // Apply a single bin to all selected units
  const handleBulkBin = (binId: string) => {
    setBinSelections((prev) => {
      const next = { ...prev };
      for (const key of selected) {
        if (binId) next[key] = binId;
        else delete next[key];
      }
      return next;
    });
  };

  const handleConfirmSelected = async () => {
    if (selected.size === 0) return;
    setSubmitting(true);
    setError("");
    setResult(null);

    try {
      // Group selected units by transactionId + binId
      const txnBinMap = new Map<string, { transactionId: string; bins: Map<string, number> }>();
      for (const row of unitRows) {
        if (!selected.has(row.unitKey)) continue;
        const bin = binSelections[row.unitKey] || "";
        if (!txnBinMap.has(row.transactionId)) {
          txnBinMap.set(row.transactionId, { transactionId: row.transactionId, bins: new Map() });
        }
        const entry = txnBinMap.get(row.transactionId)!;
        entry.bins.set(bin, (entry.bins.get(bin) || 0) + 1);
      }

      // Build payload: each transaction with its unit-to-bin splits
      const payload = {
        transactions: Array.from(txnBinMap.values()).map((entry) => {
          const splits = Array.from(entry.bins.entries()).map(([binId, qty]) => ({
            binId: binId || undefined,
            quantity: qty,
          }));
          return {
            transactionId: entry.transactionId,
            // If all units go to same bin, use simple format for backward compatibility
            ...(splits.length === 1
              ? { binId: splits[0].binId, quantity: splits[0].quantity }
              : { splits }),
          };
        }),
      };

      const res = await fetch("/api/inventory/inwards/putaway", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        setResult(data.data);
        if (data.data.errors.length === 0 && selected.size === unitRows.length) {
          setDone(true);
        } else {
          if (data.data.errors.length > 0) {
            setError(`${data.data.verified} verified, ${data.data.errors.length} failed`);
          }
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

  if (!ref) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-sm text-slate-500 mb-4">No bill reference specified</p>
        <Link href="/inwards" className="text-sm text-blue-600 underline">Back to Inwards</Link>
      </div>
    );
  }

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
          <p className="text-xs text-slate-400 mb-4">({verifiedCount} previously verified)</p>
        )}
        <Link href="/inwards" className="mt-2 inline-flex items-center gap-1.5 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium">
          <ArrowLeft className="h-4 w-4" /> Back to Inwards
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-40">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Link href="/inwards" className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50">
          <ArrowLeft className="h-4 w-4 text-slate-600" />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-slate-900">Putaway</h1>
          <p className="text-sm text-slate-500">Bill {ref}</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 mb-3 text-xs text-red-700">
          {error}
          <button onClick={() => setError("")} className="ml-2 underline">dismiss</button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-2/3 mb-2" />
              <div className="h-3 bg-slate-200 rounded w-1/3 mb-3" />
              <div className="h-9 bg-slate-200 rounded w-full" />
            </CardContent></Card>
          ))}
        </div>
      ) : unitRows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="rounded-full bg-green-100 p-3 mb-3">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <p className="text-sm font-medium text-slate-700 mb-1">No pending items for this bill</p>
          {verifiedCount > 0 && (
            <p className="text-xs text-slate-400 mb-4">All {verifiedCount} item{verifiedCount !== 1 ? "s" : ""} already verified</p>
          )}
          <Link href="/inwards" className="text-sm text-blue-600 underline">Back to Inwards</Link>
        </div>
      ) : (
        <>
          {/* Summary + Select All */}
          <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-amber-600" />
              <span className="text-xs font-medium text-amber-800">
                {unitRows.length} unit{unitRows.length !== 1 ? "s" : ""} pending
                <span className="text-amber-600 font-normal"> ({transactions.length} line items)</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              {verifiedCount > 0 && (
                <Badge variant="success" className="text-[10px]">{verifiedCount} done</Badge>
              )}
              <Badge variant="info" className="text-[10px]">{selected.size} selected</Badge>
            </div>
          </div>

          {/* Select All / Deselect + Bulk Bin */}
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={allSelected ? deselectAll : selectAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700"
            >
              {allSelected ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
              {allSelected ? "Deselect All" : "Select All"}
            </button>
            {selected.size > 1 && bins.length > 0 && (
              <select
                onChange={(e) => handleBulkBin(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white"
                defaultValue=""
              >
                <option value="" disabled>Assign bin to selected...</option>
                <option value="">No bin</option>
                {bins.map((bin) => (
                  <option key={bin.id} value={bin.id}>{bin.code} — {bin.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Unit-level Cards */}
          <div className="space-y-2">
            {unitRows.map((row) => {
              const isSelected = selected.has(row.unitKey);
              return (
                <Card key={row.unitKey} className={`overflow-hidden transition-colors ${isSelected ? "border-blue-300 bg-blue-50/30" : "opacity-60"}`}>
                  <CardContent className="p-3">
                    <div className="flex items-start gap-2.5">
                      {/* Checkbox */}
                      <button onClick={() => toggleItem(row.unitKey)} className="mt-0.5 shrink-0">
                        {isSelected
                          ? <CheckSquare className="h-5 w-5 text-blue-600" />
                          : <Square className="h-5 w-5 text-slate-300" />}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-900 truncate">{row.product.name}</p>
                            <p className="text-xs text-slate-500">
                              {row.product.sku}
                              {row.product.brand?.name ? ` | ${row.product.brand.name}` : ""}
                            </p>
                          </div>
                          <Badge variant="info" className="ml-2 shrink-0 text-xs font-bold">
                            {row.totalUnits > 1 ? `${row.unitIndex + 1} of ${row.totalUnits}` : "x1"}
                          </Badge>
                        </div>

                        {/* Bin Selection */}
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <select
                            value={binSelections[row.unitKey] || ""}
                            onChange={(e) => handleBinChange(row.unitKey, e.target.value)}
                            className="flex-1 text-sm border border-slate-200 rounded-lg px-2.5 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 appearance-none"
                          >
                            <option value="">Select bin...</option>
                            {bins.map((bin) => (
                              <option key={bin.id} value={bin.id}>{bin.code} — {bin.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Result errors */}
          {result && result.errors.length > 0 && (
            <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-red-700 mb-1">{result.errors.length} failed:</p>
              {result.errors.map((e, i) => (
                <p key={i} className="text-[10px] text-red-600">{e.error}</p>
              ))}
            </div>
          )}

          {/* Confirm Button — fixed above bottom nav */}
          <div className="fixed bottom-16 left-0 right-0 bg-white border-t border-slate-200 p-4 z-50">
            <Button
              onClick={handleConfirmSelected}
              disabled={submitting || selected.size === 0}
              className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-semibold text-sm rounded-xl disabled:opacity-50"
            >
              {submitting ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Verifying...</>
              ) : (
                <><CheckCircle2 className="h-4 w-4 mr-2" />Confirm {selected.size} of {unitRows.length} Units</>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
