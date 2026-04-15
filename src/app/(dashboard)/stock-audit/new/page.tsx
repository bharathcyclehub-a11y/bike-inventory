"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ArrowLeft, MapPin, Package } from "lucide-react";
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

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Owner / Director",
  SUPERVISOR: "Store Supervisor",
  PURCHASE_MANAGER: "Purchase Manager",
  ACCOUNTS_MANAGER: "Accounts Manager",
  INWARDS_CLERK: "Inventory & Receiving Lead",
  OUTWARDS_CLERK: "Sales & Dispatch Lead",
};

export default function NewStockAuditPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const user = session?.user as { userId?: string; role?: string } | undefined;

  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [scope, setScope] = useState<"bin" | "location" | "all">("bin");
  const [selectedBin, setSelectedBin] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [bins, setBins] = useState<Bin[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [assignedTo, setAssignedTo] = useState("");
  const [productType, setProductType] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/bins").then((r) => r.json()).then((res) => { if (res.success) setBins(res.data); }).catch(() => {});
    // Load team members for assignment
    fetch("/api/users").then((r) => r.json()).then((res) => { if (res.success) setUsers(res.data); }).catch(() => {});
  }, []);

  // Group bins by location
  const locationGroups = useMemo(() => {
    const groups: Record<string, { bins: Bin[]; totalProducts: number }> = {};
    bins.forEach((b) => {
      if (!groups[b.location]) groups[b.location] = { bins: [], totalProducts: 0 };
      groups[b.location].bins.push(b);
      groups[b.location].totalProducts += b._count.products;
    });
    return groups;
  }, [bins]);

  const locations = Object.keys(locationGroups).sort();

  // Estimated item count for preview
  const estimatedItems = useMemo(() => {
    if (scope === "bin" && selectedBin) {
      const bin = bins.find((b) => b.id === selectedBin);
      return bin?._count.products || 0;
    }
    if (scope === "location" && selectedLocation) {
      return locationGroups[selectedLocation]?.totalProducts || 0;
    }
    if (scope === "all") {
      return bins.reduce((sum, b) => sum + b._count.products, 0);
    }
    return 0;
  }, [scope, selectedBin, selectedLocation, bins, locationGroups]);

  // Auto-set title
  useEffect(() => {
    if (scope === "bin" && selectedBin) {
      const bin = bins.find((b) => b.id === selectedBin);
      if (bin) setTitle(`Stock Count - ${bin.code}`);
    } else if (scope === "location" && selectedLocation) {
      setTitle(`Stock Count - ${selectedLocation}`);
    }
  }, [selectedBin, selectedLocation, scope, bins]);

  const handleSubmit = async () => {
    if (!title || !dueDate) return;
    if (scope === "bin" && !selectedBin) return;
    if (scope === "location" && !selectedLocation) return;
    setSubmitting(true);
    setError("");
    try {
      const body: Record<string, unknown> = {
        title,
        dueDate,
        notes: notes || undefined,
        assignedToId: assignedTo || user?.userId,
      };

      if (scope === "bin" && selectedBin) {
        body.binId = selectedBin;
      } else if (scope === "location" && selectedLocation) {
        body.location = selectedLocation;
      }
      if (productType) {
        body.productType = productType;
      }

      const res = await fetch("/api/stock-counts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) router.push(`/stock-audit/${data.data.id}`);
      else setError(data.error || "Failed to create stock count");
    } catch {
      setError("Network error. Please try again.");
    }
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
            <button onClick={() => { setScope("bin"); setSelectedLocation(""); }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                scope === "bin" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
              }`}>By Bin</button>
            <button onClick={() => { setScope("location"); setSelectedBin(""); }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                scope === "location" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
              }`}>By Location</button>
            <button onClick={() => { setScope("all"); setSelectedBin(""); setSelectedLocation(""); }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                scope === "all" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
              }`}>All Products</button>
          </div>
        </div>

        {/* Product Type */}
        <div>
          <label className="text-xs text-slate-500 mb-2 block">Product Type</label>
          <div className="flex gap-2 flex-wrap">
            {[
              { key: "", label: "All" },
              { key: "BICYCLE", label: "Bicycles" },
              { key: "SPARE_PART", label: "Spares" },
              { key: "ACCESSORY", label: "Accessories" },
            ].map((t) => (
              <button key={t.key} onClick={() => setProductType(t.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  productType === t.key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
                }`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Bin Selector */}
        {scope === "bin" && (
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Select Bin *</label>
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {locations.map((loc) => (
                <div key={loc}>
                  <p className="text-xs font-semibold text-slate-700 px-1 py-1 sticky top-0 bg-white">{loc}</p>
                  <div className="space-y-1.5 pl-1">
                    {locationGroups[loc].bins.map((b) => {
                      const isSelected = selectedBin === b.id;
                      return (
                        <button key={b.id} onClick={() => setSelectedBin(b.id)}
                          className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all ${
                            isSelected
                              ? "border-slate-900 bg-slate-50 ring-1 ring-slate-900"
                              : "border-slate-200 bg-white"
                          }`}>
                          <div className="flex items-center justify-between">
                            <div className="min-w-0">
                              <span className="text-sm font-medium text-slate-900">{b.code}</span>
                              <span className="text-sm text-slate-500"> — {b.name}</span>
                            </div>
                            <span className={`shrink-0 ml-2 text-xs px-2 py-0.5 rounded-full ${
                              b._count.products > 0 ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-400"
                            }`}>
                              {b._count.products} items
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Location Selector */}
        {scope === "location" && (
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Select Location *</label>
            <div className="space-y-2">
              {locations.map((loc) => {
                const group = locationGroups[loc];
                const isSelected = selectedLocation === loc;
                return (
                  <button key={loc} onClick={() => setSelectedLocation(loc)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      isSelected
                        ? "border-slate-900 bg-slate-50 ring-1 ring-slate-900"
                        : "border-slate-200 bg-white"
                    }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MapPin className={`h-4 w-4 ${isSelected ? "text-slate-900" : "text-slate-400"}`} />
                        <span className="text-sm font-medium text-slate-900">{loc}</span>
                      </div>
                      <span className="text-xs text-slate-500">
                        {group.bins.length} bin{group.bins.length !== 1 ? "s" : ""} · {group.totalProducts} items
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1 ml-6">
                      {group.bins.map((b) => (
                        <span key={b.id} className="px-2 py-0.5 bg-slate-100 rounded text-[10px] text-slate-600">
                          {b.code} ({b._count.products})
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Baseline mode notice */}
        {(scope === "bin" || scope === "location") && (
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
            <Package className="h-4 w-4 text-amber-600 shrink-0" />
            <p className="text-xs text-amber-700">
              <span className="font-medium">Baseline Mode:</span> All active products will be listed. Count what you physically find — items counted with {'>'} 0 will be assigned to this {scope === "bin" ? "bin" : "location"}.
            </p>
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

        {/* Assign To — ADMIN must assign to someone else (cannot count themselves) */}
        {users.length > 0 && (
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Assign To *</label>
            <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900">
              <option value="">Select a team member...</option>
              {users.filter((u) => u.id !== (user as { userId?: string })?.userId).map((u) => (
                <option key={u.id} value={u.id}>{u.name} ({ROLE_LABELS[u.role] || u.role})</option>
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

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <button onClick={handleSubmit}
          disabled={!title || !dueDate || !assignedTo || (scope === "bin" && !selectedBin) || (scope === "location" && !selectedLocation) || submitting}
          className="w-full bg-slate-900 text-white py-3 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">
          {submitting ? "Creating..." : "Create Stock Count"}
        </button>
      </div>
    </div>
  );
}
