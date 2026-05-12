"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { CheckCircle2, Loader2, WifiOff, Sun, Sunrise, Moon } from "lucide-react";
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
  timeSlots: string[];
  isActive: boolean;
}

interface ComplianceRecord {
  id: string;
  sopId: string;
  userId: string;
  date: string;
  timeSlot: string;
}

type TimeSlotKey = "MORNING" | "AFTERNOON" | "EVENING";

const TIME_SLOT_CONFIG: { key: TimeSlotKey; label: string; icon: typeof Sunrise; range: string }[] = [
  { key: "MORNING", label: "Morning", icon: Sunrise, range: "9 AM – 12 PM" },
  { key: "AFTERNOON", label: "Afternoon", icon: Sun, range: "12 PM – 5 PM" },
  { key: "EVENING", label: "Evening", icon: Moon, range: "5 PM – 9 PM" },
];

function getCurrentTimeSlot(): TimeSlotKey {
  const hour = new Date().getHours();
  if (hour < 12) return "MORNING";
  if (hour < 17) return "AFTERNOON";
  return "EVENING";
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
  const [activeSlot, setActiveSlot] = useState<TimeSlotKey>(getCurrentTimeSlot());

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

  useEffect(() => {
    if (navigator.onLine) {
      syncPendingActions().catch(() => {});
    }
  }, []);

  /* ── Fetch SOPs + compliance (all time slots for today) ── */
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [sopsRes, compRes] = await Promise.all([
        fetch("/api/sops?isActive=true&forMyRole=true"),
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
    } catch {
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

  /* ── Filter SOPs for active time slot ── */
  const slotSops = sops.filter(s => {
    const slots = s.timeSlots;
    if (!slots || slots.length === 0) return true; // Legacy SOPs without timeSlots
    return slots.includes(activeSlot);
  });

  /* ── Checked set for active slot ── */
  const checkedSopIds = new Set(
    compliance
      .filter(c => c.timeSlot === activeSlot)
      .map(c => c.sopId)
  );

  /* ── Group SOPs by category ── */
  const grouped: Record<string, SOP[]> = {};
  for (const sop of slotSops) {
    if (!grouped[sop.category]) grouped[sop.category] = [];
    grouped[sop.category].push(sop);
  }

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

  /* ── Progress for active slot ── */
  const totalSops = slotSops.length;
  const completedCount = slotSops.filter((s) => checkedSopIds.has(s.id)).length;
  const progressPct = totalSops > 0 ? Math.round((completedCount / totalSops) * 100) : 0;

  /* ── Overall progress across all slots ── */
  const allSlotStats = TIME_SLOT_CONFIG.map(slot => {
    const slotFilteredSops = sops.filter(s => !s.timeSlots || s.timeSlots.length === 0 || s.timeSlots.includes(slot.key));
    const slotChecked = new Set(compliance.filter(c => c.timeSlot === slot.key).map(c => c.sopId));
    const done = slotFilteredSops.filter(s => slotChecked.has(s.id)).length;
    return { key: slot.key, total: slotFilteredSops.length, done };
  });

  /* ── Toggle check-off ── */
  const handleToggle = async (sopId: string) => {
    const wasChecked = checkedSopIds.has(sopId);

    if (wasChecked) {
      setCompliance((prev) => prev.filter((c) => !(c.sopId === sopId && c.timeSlot === activeSlot)));
    } else {
      const optimistic: ComplianceRecord = { id: `temp-${sopId}-${activeSlot}`, sopId, userId, date: today, timeSlot: activeSlot };
      setCompliance((prev) => [...prev, optimistic]);
    }

    setTogglingIds((prev) => new Set(prev).add(sopId));

    if (!navigator.onLine) {
      queueOfflineAction({ type: "sop_checkoff", payload: { sopId, date: today, timeSlot: activeSlot, userId } });
      setTogglingIds((prev) => { const n = new Set(prev); n.delete(sopId); return n; });
      return;
    }

    try {
      const res = await fetch("/api/sops/compliance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sopId, date: today, timeSlot: activeSlot }),
      });
      if (!res.ok) throw new Error();
      const compRes = await fetch(`/api/sops/compliance?date=${today}`);
      const compJson = await compRes.json();
      if (compJson.success) {
        setCompliance(compJson.data ?? []);
        cacheSOPCheckOffsLocally(compJson.data ?? []);
      }
    } catch {
      if (wasChecked) {
        const restored: ComplianceRecord = { id: `restored-${sopId}`, sopId, userId, date: today, timeSlot: activeSlot };
        setCompliance((prev) => [...prev, restored]);
      } else {
        setCompliance((prev) => prev.filter((c) => !(c.sopId === sopId && c.timeSlot === activeSlot)));
      }
    } finally {
      setTogglingIds((prev) => { const n = new Set(prev); n.delete(sopId); return n; });
    }
  };

  if (sessionStatus === "loading") {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

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

        {/* Time Slot Tabs */}
        <div className="flex gap-1 mt-3">
          {TIME_SLOT_CONFIG.map((slot) => {
            const isActive = activeSlot === slot.key;
            const stat = allSlotStats.find(s => s.key === slot.key);
            const SlotIcon = slot.icon;
            const allDone = stat && stat.total > 0 && stat.done === stat.total;
            return (
              <button
                key={slot.key}
                onClick={() => setActiveSlot(slot.key)}
                className={`flex-1 rounded-xl py-2 px-2 text-center transition-colors ${
                  isActive
                    ? "bg-teal-500 text-white shadow-sm"
                    : allDone
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-gray-50 text-gray-600 border border-gray-200"
                }`}
              >
                <SlotIcon className={`w-4 h-4 mx-auto mb-0.5 ${isActive ? "text-white" : ""}`} />
                <p className="text-[11px] font-semibold">{slot.label}</p>
                <p className={`text-[9px] ${isActive ? "text-teal-100" : "text-gray-400"}`}>
                  {stat ? `${stat.done}/${stat.total}` : "0/0"}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Offline banner */}
      {offline && (
        <div className="mx-4 mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2">
          <WifiOff className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <p className="text-xs text-amber-700">Offline mode — changes will sync when connected</p>
        </div>
      )}

      {/* Progress summary for active slot */}
      {!loading && totalSops > 0 && (
        <div className="mx-4 mt-3 bg-white rounded-xl border shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-700">
              {completedCount} of {totalSops} completed
            </p>
            <span className={`text-xs font-semibold ${progressPct === 100 ? "text-green-600" : "text-teal-600"}`}>
              {progressPct}%{progressPct === 100 && " ✓"}
            </span>
          </div>
          <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${progressPct === 100 ? "bg-green-500" : "bg-teal-500"}`}
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
          <p className="text-gray-500 text-sm">No SOPs for this time slot</p>
          <p className="text-gray-400 text-xs mt-1">Check other time slots or wait for admin to assign SOPs</p>
        </div>
      )}

      {/* SOP list grouped by category */}
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
                      <div key={sop.id} className={`bg-white rounded-xl border shadow-sm overflow-hidden ${checked ? "border-green-200 bg-green-50/30" : ""}`}>
                        <div className="flex items-center gap-3 p-3">
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

                          <button
                            onClick={() => setExpandedSopId(isExpanded ? null : sop.id)}
                            className="flex-1 min-w-0 text-left"
                          >
                            <p className={`text-sm font-medium ${checked ? "text-gray-400 line-through" : "text-gray-900"}`}>
                              <span className="text-gray-400 mr-1.5">{num}.</span>
                              {sop.title}
                            </p>
                          </button>

                          <span className="bg-purple-100 text-purple-700 text-[10px] px-2 py-0.5 rounded-full flex-shrink-0">
                            {sop.category}
                          </span>
                        </div>

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
