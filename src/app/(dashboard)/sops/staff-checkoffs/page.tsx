"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { ArrowLeft, CheckCircle2, Loader2, Sun, Sunrise, Moon, Users, ChevronDown } from "lucide-react";
import Link from "next/link";
import { SOP_CATEGORIES, todayStr } from "@/lib/ops-constants";

interface User {
  id: string;
  name: string;
  role: string;
}

interface SOP {
  id: string;
  title: string;
  description: string | null;
  category: string;
  frequency: string;
  timeSlots: string[];
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
  { key: "MORNING", label: "Morning", icon: Sunrise, range: "9 AM - 12 PM" },
  { key: "AFTERNOON", label: "Afternoon", icon: Sun, range: "12 PM - 5 PM" },
  { key: "EVENING", label: "Evening", icon: Moon, range: "5 PM - 9 PM" },
];

const ROLE_LABELS: Record<string, string> = {
  CEO: "CEO", ADMIN: "Owner", SUPERVISOR: "Ops Mgr", ACCOUNTS_MANAGER: "Finance",
  INWARDS_EXECUTIVE: "Inventory", OUTWARDS_EXECUTIVE: "Sales", STORE_MANAGER: "Store Mgr",
  SALES_MANAGER: "Sales Mgr", SERVICE_MANAGER: "Service Mgr", PURCHASE_MANAGER: "Purchase", CUSTOM: "Staff",
};

export default function StaffCheckoffsPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role || "";
  const isAdmin = role === "ADMIN" || role === "CEO";

  const today = todayStr();

  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [sops, setSops] = useState<SOP[]>([]);
  const [compliance, setCompliance] = useState<ComplianceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [sopLoading, setSopLoading] = useState(false);
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [activeSlot, setActiveSlot] = useState<TimeSlotKey>("MORNING");
  const [showUserPicker, setShowUserPicker] = useState(false);

  // Fetch users
  useEffect(() => {
    if (!isAdmin) return;
    fetch("/api/users?limit=50")
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          const allUsers = (res.data || []).filter((u: User) => u.role !== "CEO" && u.role !== "ADMIN");
          setUsers(allUsers);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isAdmin]);

  // Fetch SOPs + compliance for selected user
  const fetchUserData = useCallback(async () => {
    if (!selectedUser) return;
    setSopLoading(true);
    try {
      const [sopsRes, compRes] = await Promise.all([
        fetch(`/api/sops?isActive=true&forRole=${selectedUser.role}&forUserId=${selectedUser.id}`),
        fetch(`/api/sops/compliance?date=${today}&userId=${selectedUser.id}`),
      ]);
      const sopsJson = await sopsRes.json();
      const compJson = await compRes.json();
      if (sopsJson.success) setSops(sopsJson.data ?? []);
      if (compJson.success) setCompliance(compJson.data ?? []);
    } catch { /* ignore */ }
    finally { setSopLoading(false); }
  }, [selectedUser, today]);

  useEffect(() => { fetchUserData(); }, [fetchUserData]);

  // Filter SOPs for active slot
  const slotSops = sops.filter(s => {
    if (!s.timeSlots || s.timeSlots.length === 0) return true;
    return s.timeSlots.includes(activeSlot);
  });

  const checkedSopIds = new Set(
    compliance.filter(c => c.userId === selectedUser?.id && c.timeSlot === activeSlot).map(c => c.sopId)
  );

  // Group by category
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
    ...deptOrder.filter(c => grouped[c]),
    ...Object.keys(grouped).filter(c => !deptOrder.includes(c)),
  ];

  const totalSops = slotSops.length;
  const completedCount = slotSops.filter(s => checkedSopIds.has(s.id)).length;
  const progressPct = totalSops > 0 ? Math.round((completedCount / totalSops) * 100) : 0;

  // All slot stats
  const allSlotStats = TIME_SLOT_CONFIG.map(slot => {
    const slotFiltered = sops.filter(s => !s.timeSlots || s.timeSlots.length === 0 || s.timeSlots.includes(slot.key));
    const slotChecked = new Set(compliance.filter(c => c.userId === selectedUser?.id && c.timeSlot === slot.key).map(c => c.sopId));
    const done = slotFiltered.filter(s => slotChecked.has(s.id)).length;
    return { key: slot.key, total: slotFiltered.length, done };
  });

  // Toggle checkoff on behalf of user
  const handleToggle = async (sopId: string) => {
    if (!selectedUser) return;
    const wasChecked = checkedSopIds.has(sopId);

    // Optimistic update
    if (wasChecked) {
      setCompliance(prev => prev.filter(c => !(c.sopId === sopId && c.userId === selectedUser.id && c.timeSlot === activeSlot)));
    } else {
      setCompliance(prev => [...prev, { id: `temp-${sopId}`, sopId, userId: selectedUser.id, date: today, timeSlot: activeSlot }]);
    }

    setTogglingIds(prev => new Set(prev).add(sopId));
    try {
      const res = await fetch("/api/sops/compliance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sopId, date: today, timeSlot: activeSlot, targetUserId: selectedUser.id }),
      });
      if (!res.ok) throw new Error();
      // Refresh
      const compRes = await fetch(`/api/sops/compliance?date=${today}&userId=${selectedUser.id}`);
      const compJson = await compRes.json();
      if (compJson.success) setCompliance(compJson.data ?? []);
    } catch {
      // Revert
      if (wasChecked) {
        setCompliance(prev => [...prev, { id: `rev-${sopId}`, sopId, userId: selectedUser.id, date: today, timeSlot: activeSlot }]);
      } else {
        setCompliance(prev => prev.filter(c => !(c.sopId === sopId && c.userId === selectedUser.id && c.timeSlot === activeSlot)));
      }
    } finally {
      setTogglingIds(prev => { const n = new Set(prev); n.delete(sopId); return n; });
    }
  };

  if (!isAdmin) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-sm">Only Admin/CEO can manage staff checkoffs</p>
      </div>
    );
  }

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b px-4 py-3">
        <div className="flex items-center gap-3 mb-3">
          <Link href="/sops" className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Staff Checkoffs</h1>
            <p className="text-[10px] text-gray-400">Mark SOPs on behalf of team members</p>
          </div>
        </div>

        {/* User Picker */}
        <button
          onClick={() => setShowUserPicker(!showUserPicker)}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border bg-gray-50 text-sm"
        >
          <span className="flex items-center gap-2">
            <Users className="h-4 w-4 text-gray-400" />
            {selectedUser ? (
              <span className="font-medium">{selectedUser.name} <span className="text-xs text-gray-400">({ROLE_LABELS[selectedUser.role] || selectedUser.role})</span></span>
            ) : (
              <span className="text-gray-400">Select a team member...</span>
            )}
          </span>
          <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${showUserPicker ? "rotate-180" : ""}`} />
        </button>

        {showUserPicker && (
          <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border bg-white shadow-lg">
            {loading ? (
              <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
            ) : users.length === 0 ? (
              <p className="text-center py-4 text-xs text-gray-400">No team members found</p>
            ) : (
              users.map(u => (
                <button
                  key={u.id}
                  onClick={() => { setSelectedUser(u); setShowUserPicker(false); }}
                  className={`w-full text-left px-4 py-2.5 text-sm border-b last:border-b-0 hover:bg-gray-50 transition-colors ${
                    selectedUser?.id === u.id ? "bg-teal-50 text-teal-700 font-medium" : ""
                  }`}
                >
                  {u.name} <span className="text-xs text-gray-400 ml-1">{ROLE_LABELS[u.role] || u.role}</span>
                </button>
              ))
            )}
          </div>
        )}

        {/* Time Slot Tabs */}
        {selectedUser && (
          <div className="flex gap-1 mt-3">
            {TIME_SLOT_CONFIG.map(slot => {
              const isActive2 = activeSlot === slot.key;
              const stat = allSlotStats.find(s => s.key === slot.key);
              const SlotIcon = slot.icon;
              const allDone = stat && stat.total > 0 && stat.done === stat.total;
              return (
                <button
                  key={slot.key}
                  onClick={() => setActiveSlot(slot.key)}
                  className={`flex-1 rounded-xl py-2 px-2 text-center transition-colors ${
                    isActive2
                      ? "bg-teal-500 text-white shadow-sm"
                      : allDone
                      ? "bg-green-50 text-green-700 border border-green-200"
                      : "bg-gray-50 text-gray-600 border border-gray-200"
                  }`}
                >
                  <SlotIcon className={`w-4 h-4 mx-auto mb-0.5 ${isActive2 ? "text-white" : ""}`} />
                  <p className="text-[11px] font-semibold">{slot.label}</p>
                  <p className={`text-[9px] ${isActive2 ? "text-teal-100" : "text-gray-400"}`}>
                    {stat ? `${stat.done}/${stat.total}` : "0/0"}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* No user selected */}
      {!selectedUser && !loading && (
        <div className="text-center py-16">
          <Users className="h-12 w-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Select a team member to manage their checkoffs</p>
        </div>
      )}

      {/* Progress bar */}
      {selectedUser && !sopLoading && totalSops > 0 && (
        <div className="mx-4 mt-3 bg-white rounded-xl border shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-700">
              {completedCount} of {totalSops} completed
            </p>
            <span className={`text-xs font-semibold ${progressPct === 100 ? "text-green-600" : "text-teal-600"}`}>
              {progressPct}%{progressPct === 100 ? " Done" : ""}
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

      {/* Loading SOPs */}
      {sopLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      )}

      {/* Empty */}
      {selectedUser && !sopLoading && totalSops === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-sm">No SOPs assigned for this time slot</p>
        </div>
      )}

      {/* SOP list */}
      {selectedUser && !sopLoading && orderedCategories.length > 0 && (
        <div className="px-4 mt-4 space-y-5">
          {orderedCategories.map(cat => (
            <div key={cat}>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{cat}</p>
              <div className="space-y-2">
                {grouped[cat].map(sop => {
                  const checked = checkedSopIds.has(sop.id);
                  const toggling = togglingIds.has(sop.id);
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
                          {toggling ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
                          ) : checked ? (
                            <CheckCircle2 className="w-4 h-4 text-white" />
                          ) : null}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${checked ? "text-green-700 line-through" : "text-gray-900"}`}>
                            {sop.title}
                          </p>
                          {sop.description && (
                            <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-1">{sop.description}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
