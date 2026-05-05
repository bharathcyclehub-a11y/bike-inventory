"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { CheckCircle2, Loader2, WifiOff } from "lucide-react";
import { usePermissions } from "@/lib/use-permissions";
import { SOP_CATEGORIES, todayStr } from "@/lib/ops-constants";
import {
  getCachedSOPCheckOffs,
  cacheSOPCheckOffsLocally,
  queueOfflineAction,
  syncPendingActions,
} from "@/lib/offline-cache";

/* ── Types ─────────────────────────────────────────── */

interface SOP {
  id: string;
  title: string;
  description: string | null;
  category: string;
  frequency: string;
  isActive: boolean;
}

interface ComplianceRecord {
  id: string;
  sopId: string;
  userId: string;
  date: string;
}

/* ── Main Page ─────────────────────────────────────── */

export default function MyCheckoffsPage() {
  const { data: session, status: sessionStatus } = useSession();
  const role = (session?.user as { role?: string })?.role || "";
  const userId = (session?.user as { userId?: string })?.userId || "";
  const { canView } = usePermissions(role);

  const today = todayStr();

  const [sops, setSops] = useState<SOP[]>([]);
  const [compliance, setCompliance] = useState<ComplianceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(false);
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [expandedSopId, setExpandedSopId] = useState<string | null>(null);

  /* ── Check online status ── */
  useEffect(() => {
    const goOnline = () => {
      setOffline(false);
      syncPendingActions().catch(() => {});
    };
    const goOffline = () => setOffline(true);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    if (!navigator.onLine) setOffline(true);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  /* ── Sync pending actions on mount when online ── */
  useEffect(() => {
    if (navigator.onLine) {
      syncPendingActions().catch(() => {});
    }
  }, []);

  /* ── Fetch SOPs + compliance ── */
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [sopsRes, compRes] = await Promise.all([
        fetch("/api/sops?isActive=true"),
        fetch(`/api/sops/compliance?date=${today}`),
      ]);

      const sopsJson = await sopsRes.json();
      const compJson = await compRes.json();

      if (sopsJson.success) {
        setSops(sopsJson.data ?? []);
      } else {
        throw new Error(sopsJson.error || "Failed to load SOPs");
      }

      if (compJson.success) {
        const records = compJson.data ?? [];
        setCompliance(records);
        cacheSOPCheckOffsLocally(records);
      }
    } catch (err) {
      // Attempt offline fallback
      const cached = getCachedSOPCheckOffs() as ComplianceRecord[] | null;
      if (cached) {
        setCompliance(cached);
        setOffline(true);
      } else {
        setError("Failed to load data. Please check your connection.");
      }
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── Derive checked set ── */
  const checkedSopIds = new Set(compliance.map((c) => c.sopId));

  /* ── Group SOPs by category ── */
  const grouped: Record<string, SOP[]> = {};
  for (const sop of sops) {
    if (!grouped[sop.category]) grouped[sop.category] = [];
    grouped[sop.category].push(sop);
  }
  // Keep categories in saved department order, then any extras
  const [deptOrder, setDeptOrder] = useState<string[]>(SOP_CATEGORIES.filter(c => c !== "All"));
  useEffect(() => {
    fetch("/api/settings?key=sop_departments")
      .then(r => r.json())
      .then(res => { if (res.success && Array.isArray(res.data?.value) && res.data.value.length > 0) setDeptOrder(res.data.value); })
      .catch(() => {});
  }, []);
  const orderedCategories = [
    ...deptOrder.filter((c) => grouped[c]),
    ...Object.keys(grouped).filter((c) => !deptOrder.includes(c)),
  ];

  /* ── Progress ── */
  const totalSops = sops.length;
  const completedCount = sops.filter((s) => checkedSopIds.has(s.id)).length;
  const progressPct = totalSops > 0 ? Math.round((completedCount / totalSops) * 100) : 0;

  /* ── Toggle check-off ── */
  const handleToggle = async (sopId: string) => {
    const wasChecked = checkedSopIds.has(sopId);

    // Optimistic update
    if (wasChecked) {
      setCompliance((prev) => prev.filter((c) => c.sopId !== sopId));
    } else {
      const optimistic: ComplianceRecord = { id: `temp-${sopId}`, sopId, userId, date: today };
      setCompliance((prev) => [...prev, optimistic]);
    }

    setTogglingIds((prev) => new Set(prev).add(sopId));

    if (!navigator.onLine) {
      queueOfflineAction({ type: "sop_checkoff", payload: { sopId, date: today, userId } });
      setTogglingIds((prev) => { const n = new Set(prev); n.delete(sopId); return n; });
      return;
    }

    try {
      const res = await fetch("/api/sops/compliance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sopId, date: today }),
      });
      if (!res.ok) throw new Error();
      // Refetch compliance for accurate data
      const compRes = await fetch(`/api/sops/compliance?date=${today}`);
      const compJson = await compRes.json();
      if (compJson.success) {
        setCompliance(compJson.data ?? []);
        cacheSOPCheckOffsLocally(compJson.data ?? []);
      }
    } catch {
      // Revert on failure
      if (wasChecked) {
        const restored: ComplianceRecord = { id: `restored-${sopId}`, sopId, userId, date: today };
        setCompliance((prev) => [...prev, restored]);
      } else {
        setCompliance((prev) => prev.filter((c) => c.sopId !== sopId));
      }
    } finally {
      setTogglingIds((prev) => { const n = new Set(prev); n.delete(sopId); return n; });
    }
  };

  /* ── Auth loading ── */
  if (sessionStatus === "loading") {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  /* ── Render ── */
  return (
    <div className="pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900">My SOPs</h1>
          <span className="text-xs text-gray-400">
            {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          </span>
        </div>
      </div>

      {/* Offline banner */}
      {offline && (
        <div className="mx-4 mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2">
          <WifiOff className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <p className="text-xs text-amber-700">
            Offline mode — changes will sync when connected
          </p>
        </div>
      )}

      {/* Progress summary */}
      {!loading && totalSops > 0 && (
        <div className="mx-4 mt-3 bg-white rounded-xl border shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-700">
              {completedCount} of {totalSops} completed today
            </p>
            <span className="text-xs font-semibold text-teal-600">{progressPct}%</span>
          </div>
          <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
            <div
              className="bg-teal-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mx-4 mt-4 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Empty */}
      {!loading && !error && totalSops === 0 && (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-gray-500 text-sm">No active SOPs assigned</p>
          <p className="text-gray-400 text-xs mt-1">SOPs will appear here once created by admin</p>
        </div>
      )}

      {/* SOP list grouped by category — numbered, expandable */}
      {!loading && !error && orderedCategories.length > 0 && (() => {
        let globalIndex = 0;
        return (
          <div className="px-4 mt-4 space-y-5">
            {orderedCategories.map((cat) => (
              <div key={cat}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{cat}</p>
                <div className="space-y-2">
                  {grouped[cat].map((sop) => {
                    globalIndex++;
                    const num = globalIndex;
                    const checked = checkedSopIds.has(sop.id);
                    const toggling = togglingIds.has(sop.id);
                    const isExpanded = expandedSopId === sop.id;
                    return (
                      <div key={sop.id} className="bg-white rounded-xl border shadow-sm overflow-hidden">
                        <div className="flex items-center gap-3 p-3">
                          {/* Checkbox circle */}
                          <button
                            onClick={() => handleToggle(sop.id)}
                            disabled={toggling}
                            className={`w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                              checked ? "bg-teal-500 border-teal-500" : "border-gray-300 bg-white"
                            }`}
                          >
                            {checked && <CheckCircle2 className="w-4 h-4 text-white" />}
                            {toggling && !checked && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />}
                          </button>

                          {/* Content — tap to expand */}
                          <button
                            onClick={() => setExpandedSopId(isExpanded ? null : sop.id)}
                            className="flex-1 min-w-0 text-left"
                          >
                            <p className={`text-sm font-medium ${checked ? "text-gray-400 line-through" : "text-gray-900"}`}>
                              <span className="text-gray-400 mr-1.5">{num}.</span>
                              {sop.title}
                            </p>
                          </button>

                          {/* Category badge */}
                          <span className="bg-purple-100 text-purple-700 text-[10px] px-2 py-0.5 rounded-full flex-shrink-0">
                            {sop.category}
                          </span>
                        </div>

                        {/* Expanded description */}
                        {isExpanded && sop.description && (
                          <div className="px-4 pb-3 pt-0 ml-10">
                            <p className="text-xs text-gray-500 whitespace-pre-wrap leading-relaxed">
                              {sop.description}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}
