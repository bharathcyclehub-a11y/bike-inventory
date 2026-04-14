"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";

interface Bin {
  id: string;
  code: string;
  name: string;
  location: string;
  _count: { products: number };
}

interface User {
  id: string;
  name: string;
  role: string;
}

export default function NewStockAuditPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const user = session?.user as { userId?: string; role?: string } | undefined;

  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [scope, setScope] = useState<"bin" | "all">("bin");
  const [selectedBin, setSelectedBin] = useState("");
  const [bins, setBins] = useState<Bin[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [assignedTo, setAssignedTo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/bins").then((r) => r.json()).then((res) => { if (res.success) setBins(res.data); }).catch(() => {});
    if (user?.role === "ADMIN") {
      fetch("/api/users").then((r) => r.json()).then((res) => { if (res.success) setUsers(res.data); }).catch(() => {});
    }
  }, [user?.role]);

  // Auto-set title when bin is selected
  useEffect(() => {
    if (scope === "bin" && selectedBin) {
      const bin = bins.find((b) => b.id === selectedBin);
      if (bin) setTitle(`Stock Count - ${bin.code}`);
    }
  }, [selectedBin, scope, bins]);

  const handleSubmit = async () => {
    if (!title || !dueDate) return;
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        title,
        dueDate,
        notes: notes || undefined,
        assignedToId: assignedTo || user?.userId || undefined,
      };

      if (scope === "bin" && selectedBin) {
        body.binId = selectedBin;
      }

      const res = await fetch("/api/stock-counts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) router.push(`/stock-audit/${data.data.id}`);
    } catch { /* */ }
    finally { setSubmitting(false); }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Link href="/stock-audit" className="p-1">
          <ArrowLeft className="h-5 w-5 text-slate-600" />
        </Link>
        <h1 className="text-lg font-bold text-slate-900">New Stock Count</h1>
      </div>

      <div className="space-y-3">
        {/* Scope */}
        <div>
          <label className="text-xs text-slate-500 mb-2 block">Count Scope</label>
          <div className="flex gap-2">
            <button onClick={() => setScope("bin")}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                scope === "bin" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
              }`}>By Bin</button>
            <button onClick={() => setScope("all")}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                scope === "all" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
              }`}>All Products</button>
          </div>
        </div>

        {/* Bin Selector */}
        {scope === "bin" && (
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Select Bin *</label>
            <select value={selectedBin} onChange={(e) => setSelectedBin(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900">
              <option value="">Choose a bin...</option>
              {bins.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code} — {b.name} ({b.location}, {b._count.products} items)
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="text-xs text-slate-500 mb-1 block">Title *</label>
          <Input placeholder="e.g. Stock Count - Assembly Bin" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div>
          <label className="text-xs text-slate-500 mb-1 block">Due Date *</label>
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>

        {/* Assign To (admin only) */}
        {user?.role === "ADMIN" && users.length > 0 && (
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Assign To</label>
            <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900">
              <option value="">Myself</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="text-xs text-slate-500 mb-1 block">Notes</label>
          <textarea
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 min-h-[80px]"
            placeholder="Any instructions for the person counting..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <button onClick={handleSubmit}
          disabled={!title || !dueDate || (scope === "bin" && !selectedBin) || submitting}
          className="w-full bg-slate-900 text-white py-3 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">
          {submitting ? "Creating..." : "Create Stock Count"}
        </button>
      </div>
    </div>
  );
}
