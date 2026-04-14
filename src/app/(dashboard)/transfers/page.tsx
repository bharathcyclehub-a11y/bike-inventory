"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Plus, ArrowRightLeft, CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Transfer {
  id: string;
  quantity: number;
  referenceNo: string | null;
  notes: string | null;
  createdAt: string;
  product: { name: string; sku: string };
  user: { name: string };
}

type StatusFilter = "all" | "PENDING" | "APPROVED" | "REJECTED";

function parseTransferNotes(notes: string | null) {
  if (!notes) return { status: "UNKNOWN", from: "", to: "", comment: "" };
  const statusMatch = notes.match(/\[(PENDING|APPROVED|REJECTED)\]/);
  const routeMatch = notes.match(/From: (.+?) → To: (.+?)(?:\s*\||$|\s*\[)/);
  const commentMatch = notes.match(/\|\s*([^[]+?)(?:\s*\[|$)/);
  return {
    status: statusMatch?.[1] || "UNKNOWN",
    from: routeMatch?.[1]?.trim() || "",
    to: routeMatch?.[2]?.trim() || "",
    comment: commentMatch?.[1]?.trim() || "",
  };
}

export default function TransfersPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as { role?: string })?.role === "ADMIN";
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [approving, setApproving] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "50" });
    if (filter !== "all") params.set("status", filter);

    fetch(`/api/transfers?${params}`)
      .then((r) => r.json())
      .then((res) => { if (res.success) setTransfers(res.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filter]);

  async function handleAction(id: string, action: "approve" | "reject") {
    setApproving(id);
    try {
      const res = await fetch(`/api/transfers/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.success) {
        // Refresh list
        setTransfers((prev) =>
          prev.map((t) => {
            if (t.id !== id) return t;
            const newStatus = action === "approve" ? "APPROVED" : "REJECTED";
            return { ...t, notes: t.notes?.replace("[PENDING]", `[${newStatus}]`) || t.notes };
          })
        );
      }
    } catch { /* ignore */ }
    finally { setApproving(null); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Transfers</h1>
          <p className="text-xs text-slate-500">Warehouse to Store movements</p>
        </div>
        <Link href="/transfers/new">
          <Button size="sm" className="bg-purple-600 hover:bg-purple-700">
            <Plus className="h-4 w-4 mr-1" /> New Transfer
          </Button>
        </Link>
      </div>

      <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-3 pb-1">
        {(["all", "PENDING", "APPROVED", "REJECTED"] as StatusFilter[]).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === f ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}>
            {f === "all" ? "All" : f === "PENDING" ? "Pending" : f === "APPROVED" ? "Approved" : "Rejected"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-3 border border-slate-100 rounded-lg animate-pulse">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 space-y-1.5"><div className="h-4 bg-slate-200 rounded w-3/4" /><div className="h-3 bg-slate-200 rounded w-1/2" /></div>
                <div className="h-5 w-16 bg-slate-200 rounded-full" />
              </div>
              <div className="bg-slate-100 rounded-lg p-2 mb-2"><div className="h-3 bg-slate-200 rounded w-2/3 mx-auto" /></div>
              <div className="h-3 bg-slate-200 rounded w-full" />
            </div>
          ))}
        </div>
      ) : transfers.length === 0 ? (
        <div className="text-center py-12">
          <ArrowRightLeft className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400">No transfers found</p>
          <Link href="/transfers/new">
            <Button variant="outline" size="sm" className="mt-3">Create First Transfer</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {transfers.map((t) => {
            const parsed = parseTransferNotes(t.notes);
            return (
              <Card key={t.id}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0 mr-2">
                      <p className="text-sm font-medium text-slate-900 truncate">{t.product.name}</p>
                      <p className="text-xs text-slate-500">{t.product.sku} | Qty: <span className="font-semibold">{t.quantity}</span></p>
                    </div>
                    <Badge variant={parsed.status === "APPROVED" ? "success" : parsed.status === "PENDING" ? "warning" : "danger"}>
                      {parsed.status === "APPROVED" ? <><CheckCircle2 className="h-3 w-3 mr-0.5" />Approved</> :
                       parsed.status === "PENDING" ? <><Clock className="h-3 w-3 mr-0.5" />Pending</> :
                       <><XCircle className="h-3 w-3 mr-0.5" />Rejected</>}
                    </Badge>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-2 mb-2">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-600 font-medium">{parsed.from || "—"}</span>
                      <ArrowRightLeft className="h-3 w-3 text-purple-500 shrink-0" />
                      <span className="text-slate-600 font-medium">{parsed.to || "—"}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-slate-400">
                      {t.referenceNo} | {t.user.name} | {new Date(t.createdAt).toLocaleString("en-IN")}
                    </p>

                    {isAdmin && parsed.status === "PENDING" && (
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="outline"
                          className="h-7 text-xs text-green-600 border-green-200 hover:bg-green-50"
                          onClick={() => handleAction(t.id, "approve")}
                          disabled={approving === t.id}>
                          {approving === t.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Approve"}
                        </Button>
                        <Button size="sm" variant="outline"
                          className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => handleAction(t.id, "reject")}
                          disabled={approving === t.id}>
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>

                  {parsed.comment && <p className="text-[10px] text-slate-400 mt-1">{parsed.comment}</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
