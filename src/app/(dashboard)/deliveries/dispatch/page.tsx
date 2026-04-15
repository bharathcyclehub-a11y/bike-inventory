"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Truck, CheckCircle2, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface ScheduledDelivery {
  id: string;
  invoiceNo: string;
  customerName: string;
  customerArea: string | null;
  customerAddress: string | null;
  scheduledDate: string | null;
  invoiceAmount: number;
  lineItems: Array<{ name: string; quantity: number }> | null;
}

function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

export default function DispatchPage() {
  const [deliveries, setDeliveries] = useState<ScheduledDelivery[]>([]);
  const [outDeliveries, setOutDeliveries] = useState<ScheduledDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectedOut, setSelectedOut] = useState<Set<string>>(new Set());
  const [dispatching, setDispatching] = useState(false);
  const [delivering, setDelivering] = useState(false);
  const [tab, setTab] = useState<"dispatch" | "return">("dispatch");

  useEffect(() => {
    Promise.all([
      fetch("/api/deliveries?status=SCHEDULED&limit=100").then((r) => r.json()),
      fetch("/api/deliveries?status=OUT_FOR_DELIVERY&limit=100").then((r) => r.json()),
    ]).then(([schedRes, outRes]) => {
      if (schedRes.success) setDeliveries(schedRes.data);
      if (outRes.success) setOutDeliveries(outRes.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectOut = (id: string) => {
    setSelectedOut((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleDispatch = async () => {
    if (selected.size === 0) return;
    setDispatching(true);
    try {
      await fetch("/api/deliveries/batch", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryIds: Array.from(selected), action: "OUT_FOR_DELIVERY" }),
      });
      setDeliveries((prev) => prev.filter((d) => !selected.has(d.id)));
      setSelected(new Set());
    } catch { /* */ }
    finally { setDispatching(false); }
  };

  const handleDelivered = async () => {
    if (selectedOut.size === 0) return;
    setDelivering(true);
    try {
      await fetch("/api/deliveries/batch", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryIds: Array.from(selectedOut), action: "DELIVERED" }),
      });
      setOutDeliveries((prev) => prev.filter((d) => !selectedOut.has(d.id)));
      setSelectedOut(new Set());
    } catch { /* */ }
    finally { setDelivering(false); }
  };

  // Group by area
  const areaGroups: Record<string, ScheduledDelivery[]> = {};
  for (const d of tab === "dispatch" ? deliveries : outDeliveries) {
    const area = d.customerArea || "No Area";
    if (!areaGroups[area]) areaGroups[area] = [];
    areaGroups[area].push(d);
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <Link href="/deliveries" className="p-1"><ArrowLeft className="h-5 w-5 text-slate-600" /></Link>
        <h1 className="text-lg font-bold text-slate-900">Batch Dispatch</h1>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-100 rounded-lg p-0.5 mb-3">
        <button onClick={() => setTab("dispatch")}
          className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === "dispatch" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>
          Dispatch ({deliveries.length})
        </button>
        <button onClick={() => setTab("return")}
          className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === "return" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>
          Mark Delivered ({outDeliveries.length})
        </button>
      </div>

      {/* Grouped by area */}
      {Object.keys(areaGroups).length === 0 ? (
        <div className="text-center py-12">
          <Truck className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-400">{tab === "dispatch" ? "No scheduled deliveries" : "No deliveries out"}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {Object.entries(areaGroups).map(([area, items]) => (
            <div key={area}>
              <p className="text-xs font-semibold text-slate-500 mb-1.5">{area} ({items.length})</p>
              <div className="space-y-1.5">
                {items.map((d) => {
                  const isSelected = tab === "dispatch" ? selected.has(d.id) : selectedOut.has(d.id);
                  const toggle = tab === "dispatch" ? toggleSelect : toggleSelectOut;
                  return (
                    <Card key={d.id} className={isSelected ? "border-blue-300 bg-blue-50" : ""}>
                      <CardContent className="p-2.5 flex items-center gap-2.5">
                        <input type="checkbox" checked={isSelected} onChange={() => toggle(d.id)}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-900">{d.invoiceNo} — {d.customerName}</p>
                          <p className="text-[10px] text-slate-500">
                            {d.lineItems?.slice(0, 1).map((it) => `${it.name} x${it.quantity}`).join(", ")}
                            {d.lineItems && d.lineItems.length > 1 ? ` +${d.lineItems.length - 1}` : ""}
                          </p>
                          {d.customerAddress && <p className="text-[10px] text-slate-400 truncate">{d.customerAddress}</p>}
                        </div>
                        <p className="text-xs font-medium text-slate-700 shrink-0">{formatINR(d.invoiceAmount)}</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action Bar */}
      {tab === "dispatch" && selected.size > 0 && (
        <div className="fixed bottom-20 left-0 right-0 px-4">
          <button onClick={handleDispatch} disabled={dispatching}
            className="w-full max-w-lg mx-auto flex items-center justify-center gap-2 bg-orange-600 text-white py-3 rounded-xl text-sm font-medium shadow-lg disabled:opacity-50">
            <Truck className="h-4 w-4" /> {dispatching ? "Dispatching..." : `Dispatch ${selected.size} Selected`}
          </button>
        </div>
      )}

      {tab === "return" && selectedOut.size > 0 && (
        <div className="fixed bottom-20 left-0 right-0 px-4">
          <button onClick={handleDelivered} disabled={delivering}
            className="w-full max-w-lg mx-auto flex items-center justify-center gap-2 bg-green-600 text-white py-3 rounded-xl text-sm font-medium shadow-lg disabled:opacity-50">
            <CheckCircle2 className="h-4 w-4" /> {delivering ? "Updating..." : `Mark ${selectedOut.size} Delivered`}
          </button>
        </div>
      )}
    </div>
  );
}
