"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Search, Plus, ChevronDown, ChevronUp, Trash2, Pencil,
  AlertTriangle, Smartphone, Loader2, ShieldAlert, X,
} from "lucide-react";
import { usePermissions } from "@/lib/use-permissions";
import {
  SOP_CATEGORIES, FREQUENCY_LABELS, todayStr,
  buildSOPChecklistWhatsApp, buildViolationReportWhatsApp,
} from "@/lib/ops-constants";

/* ── Types ─────────────────────────────────────────── */

interface SOP {
  id: string;
  title: string;
  description: string | null;
  category: string;
  frequency: string;
  isActive: boolean;
  _count?: { assignments?: number };
}

interface Violation {
  id: string;
  sopId: string;
  userId: string;
  notes: string | null;
  createdAt: string;
  sop?: { title: string };
  user?: { name: string };
}

/* ── Main Page ─────────────────────────────────────── */

export default function SOPManagementPage() {
  const { data: session, status: sessionStatus } = useSession();
  const role = (session?.user as { role?: string })?.role || "";
  const userId = (session?.user as { userId?: string })?.userId || "";
  const userName = session?.user?.name || "Admin";
  const { canView } = usePermissions(role);

  const isAdmin = role === "ADMIN";
  const isSupervisor = role === "SUPERVISOR";
  const canAccess = isAdmin || isSupervisor;

  const [tab, setTab] = useState<"sops" | "compliance">("sops");

  /* ── SOP state ── */
  const [sops, setSops] = useState<SOP[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("All");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  /* ── Auto-open form from ?action=add ── */
  const searchParams = useSearchParams();
  /* ── Form state ── */
  const [showForm, setShowForm] = useState(searchParams.get("action") === "add");
  const [editingSop, setEditingSop] = useState<SOP | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formCat, setFormCat] = useState("Sales");
  const [formFreq, setFormFreq] = useState("SOP_DAILY");
  const [saving, setSaving] = useState(false);

  /* ── Violation state ── */
  const [violations, setViolations] = useState<Violation[]>([]);
  const [violationsLoading, setViolationsLoading] = useState(false);
  const [showViolationForm, setShowViolationForm] = useState(false);
  const [violSopId, setViolSopId] = useState("");
  const [violNotes, setViolNotes] = useState("");
  const [violStaffName, setViolStaffName] = useState("");
  const [violSaving, setViolSaving] = useState(false);

  /* ── Fetch SOPs ── */
  const fetchSops = useCallback(() => {
    setLoading(true);
    setError("");
    fetch("/api/sops")
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setSops(res.data ?? []);
        else setError(res.error || "Failed to load SOPs");
      })
      .catch(() => setError("Network error loading SOPs"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { if (canAccess) fetchSops(); }, [canAccess, fetchSops]);

  /* ── Fetch violations ── */
  const fetchViolations = useCallback(() => {
    setViolationsLoading(true);
    fetch("/api/sops/violations")
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setViolations(res.data ?? []);
      })
      .catch(() => {})
      .finally(() => setViolationsLoading(false));
  }, []);

  useEffect(() => { if (tab === "compliance" && canAccess) fetchViolations(); }, [tab, canAccess, fetchViolations]);

  /* ── Handlers ── */

  const handleToggleActive = async (sop: SOP) => {
    const prev = sops.map((s) => ({ ...s }));
    setSops((prev) => prev.map((s) => s.id === sop.id ? { ...s, isActive: !s.isActive } : s));
    try {
      const res = await fetch(`/api/sops/${sop.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !sop.isActive }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setSops(prev);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this SOP?")) return;
    setSops((prev) => prev.filter((s) => s.id !== id));
    try {
      await fetch(`/api/sops/${id}`, { method: "DELETE" });
    } catch {
      fetchSops();
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const res = await fetch("/api/sops/seed", { method: "POST" });
      if (res.ok) fetchSops();
    } catch {}
    setSeeding(false);
  };

  const openAddForm = () => {
    setEditingSop(null);
    setFormTitle("");
    setFormDesc("");
    setFormCat("Sales");
    setFormFreq("SOP_DAILY");
    setShowForm(true);
  };

  const openEditForm = (sop: SOP) => {
    setEditingSop(sop);
    setFormTitle(sop.title);
    setFormDesc(sop.description || "");
    setFormCat(sop.category);
    setFormFreq(sop.frequency);
    setShowForm(true);
  };

  const handleSaveForm = async () => {
    if (!formTitle.trim()) return;
    setSaving(true);
    try {
      const body = { title: formTitle.trim(), description: formDesc.trim(), category: formCat, frequency: formFreq };
      const url = editingSop ? `/api/sops/${editingSop.id}` : "/api/sops";
      const method = editingSop ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) {
        setShowForm(false);
        fetchSops();
      }
    } catch {}
    setSaving(false);
  };

  const handleLogViolation = async () => {
    if (!violSopId) return;
    setViolSaving(true);
    const notesText = violStaffName.trim()
      ? `Staff: ${violStaffName.trim()}${violNotes.trim() ? ` | ${violNotes.trim()}` : ""}`
      : violNotes.trim();
    try {
      const res = await fetch("/api/sops/violations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sopId: violSopId, userId, notes: notesText, date: todayStr() }),
      });
      if (res.ok) {
        setShowViolationForm(false);
        setViolSopId("");
        setViolNotes("");
        setViolStaffName("");
        fetchViolations();
      }
    } catch {}
    setViolSaving(false);
  };

  /* ── Filtered SOPs ── */
  const filtered = sops.filter((s) => {
    if (catFilter !== "All" && s.category !== catFilter) return false;
    if (search && !s.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  /* ── Violation analytics ── */
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const violationsThisWeek = violations.filter((v) => v.createdAt >= weekAgo);
  const sopViolCounts: Record<string, number> = {};
  for (const v of violations) {
    const t = v.sop?.title || v.sopId;
    sopViolCounts[t] = (sopViolCounts[t] || 0) + 1;
  }
  const mostBroken = Object.entries(sopViolCounts).sort((a, b) => b[1] - a[1])[0];

  /* ── Grouped violations by date ── */
  const violByDate: Record<string, Violation[]> = {};
  for (const v of violations) {
    const d = new Date(v.createdAt).toLocaleDateString("en-IN");
    if (!violByDate[d]) violByDate[d] = [];
    violByDate[d].push(v);
  }

  /* ── Auth guard ── */
  if (sessionStatus === "loading") {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="p-6 text-center text-gray-500">
        <ShieldAlert className="w-10 h-10 mx-auto mb-2 text-gray-400" />
        <p className="font-medium">Access restricted to Admin and Supervisor</p>
      </div>
    );
  }

  /* ── Render ── */
  return (
    <div className="pb-32">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b px-4 py-3">
        <h1 className="text-lg font-bold text-gray-900">SOP Management</h1>
        {/* Tabs */}
        <div className="flex gap-1 mt-2">
          {(["sops", "compliance"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                tab === t
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {t === "sops" ? "SOPs" : "Compliance"}
            </button>
          ))}
        </div>
      </div>

      {/* ──────────── SOPs Tab ──────────── */}
      {tab === "sops" && (
        <div className="px-4 pt-3">
          {/* Category chips */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {["All", ...SOP_CATEGORIES].map((c) => (
              <button
                key={c}
                onClick={() => setCatFilter(c)}
                className={`whitespace-nowrap px-3 py-1 text-xs rounded-full transition-colors ${
                  catFilter === c
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search SOPs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Empty + Seed */}
          {!loading && !error && sops.length === 0 && (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">📋</div>
              <p className="text-gray-500 mb-4">No SOPs created yet</p>
              <button
                onClick={handleSeed}
                disabled={seeding}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium disabled:opacity-60"
              >
                {seeding && <Loader2 className="w-4 h-4 animate-spin" />}
                Seed BCH SOPs
              </button>
            </div>
          )}

          {/* SOP list */}
          {!loading && filtered.length > 0 && (
            <div className="mt-3 space-y-2">
              {filtered.map((sop) => {
                const expanded = expandedId === sop.id;
                return (
                  <div
                    key={sop.id}
                    className="bg-white rounded-xl border shadow-sm overflow-hidden"
                  >
                    {/* Card header */}
                    <button
                      onClick={() => setExpandedId(expanded ? null : sop.id)}
                      className="w-full flex items-center gap-3 p-3 text-left"
                    >
                      {/* Active toggle */}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleToggleActive(sop); }}
                        className={`w-5 h-5 rounded-full flex-shrink-0 border-2 transition-colors ${
                          sop.isActive
                            ? "bg-green-500 border-green-500"
                            : "bg-gray-200 border-gray-300"
                        }`}
                        aria-label={sop.isActive ? "Deactivate" : "Activate"}
                      />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${sop.isActive ? "text-gray-900" : "text-gray-400 line-through"}`}>
                          {sop.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="bg-purple-100 text-purple-700 text-[10px] px-2 py-0.5 rounded-full">
                            {sop.category}
                          </span>
                          <span className="bg-gray-100 text-gray-500 text-[10px] px-2 py-0.5 rounded-full">
                            {FREQUENCY_LABELS[sop.frequency] || sop.frequency}
                          </span>
                          {sop._count?.assignments != null && (
                            <span className="text-[10px] text-gray-400">
                              {sop._count.assignments} assigned
                            </span>
                          )}
                        </div>
                      </div>
                      {expanded ? (
                        <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      )}
                    </button>

                    {/* Expanded section */}
                    {expanded && (
                      <div className="border-t px-3 pb-3 pt-2 space-y-3">
                        {sop.description && (
                          <p className="text-xs text-gray-600 leading-relaxed">{sop.description}</p>
                        )}
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => {
                              setViolSopId(sop.id);
                              setShowViolationForm(true);
                              setTab("compliance");
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs font-medium"
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Log Violation
                          </button>
                          <a
                            href={`https://wa.me/?text=${buildSOPChecklistWhatsApp(
                              [{ title: sop.title, category: sop.category, checked: false }],
                              userName,
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-medium"
                          >
                            <Smartphone className="w-3.5 h-3.5" />
                            WhatsApp
                          </a>
                          <button
                            onClick={() => openEditForm(sop)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-50 text-gray-600 border border-gray-200 rounded-lg text-xs font-medium"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Edit
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => handleDelete(sop.id)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-medium"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* No results for filter */}
          {!loading && !error && sops.length > 0 && filtered.length === 0 && (
            <div className="text-center py-8 text-sm text-gray-400">
              No SOPs match your search or filter
            </div>
          )}
        </div>
      )}

      {/* ──────────── Compliance Tab ──────────── */}
      {tab === "compliance" && (
        <div className="px-4 pt-3">
          {/* Analytics summary */}
          <div className="bg-orange-50 rounded-xl p-4 space-y-2">
            <h3 className="text-sm font-semibold text-orange-800">Violation Summary</h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-2xl font-bold text-orange-700">{violations.length}</p>
                <p className="text-[10px] text-orange-600">Total</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-orange-700">{violationsThisWeek.length}</p>
                <p className="text-[10px] text-orange-600">This week</p>
              </div>
              <div>
                <p className="text-sm font-medium text-orange-700 leading-tight truncate">
                  {mostBroken ? mostBroken[0] : "--"}
                </p>
                <p className="text-[10px] text-orange-600">Most broken</p>
              </div>
            </div>
          </div>

          {/* Loading */}
          {violationsLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          )}

          {/* Empty */}
          {!violationsLoading && violations.length === 0 && (
            <div className="text-center py-10 text-sm text-gray-400">
              No violations recorded yet
            </div>
          )}

          {/* Violation list grouped by date */}
          {!violationsLoading && Object.keys(violByDate).length > 0 && (
            <div className="mt-4 space-y-4">
              {Object.entries(violByDate).map(([date, items]) => (
                <div key={date}>
                  <p className="text-xs font-semibold text-gray-500 mb-2">{date}</p>
                  <div className="space-y-2">
                    {items.map((v) => (
                      <div key={v.id} className="bg-white rounded-xl border shadow-sm p-3">
                        <div className="flex items-start justify-between">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {v.sop?.title || "Unknown SOP"}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {v.user?.name || "--"}
                            </p>
                          </div>
                          <span className="text-[10px] text-gray-400 flex-shrink-0 ml-2">
                            {new Date(v.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        {v.notes && (
                          <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{v.notes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Log Violation button */}
          <div className="mt-4">
            <button
              onClick={() => setShowViolationForm(true)}
              className="w-full py-3 bg-red-600 text-white rounded-xl text-sm font-medium"
            >
              Log Violation
            </button>
          </div>

          {/* WhatsApp share violations */}
          {violations.length > 0 && (
            <div className="mt-3">
              <a
                href={`https://wa.me/?text=${buildViolationReportWhatsApp(
                  violations.map((v) => ({
                    staffName: v.user?.name || "--",
                    sopTitle: v.sop?.title || "Unknown",
                    notes: v.notes || undefined,
                    timestamp: v.createdAt,
                  })),
                  userName,
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full py-3 bg-green-50 text-green-700 border border-green-200 rounded-xl text-sm font-medium text-center"
              >
                Share Violation Report via WhatsApp
              </a>
            </div>
          )}
        </div>
      )}

      {/* ──────────── FAB (SOPs tab only) ──────────── */}
      {tab === "sops" && (
        <button
          onClick={openAddForm}
          className="fixed bottom-24 right-4 w-14 h-14 bg-blue-600 rounded-full shadow-lg z-50 flex items-center justify-center text-white active:scale-95 transition-transform"
          aria-label="Add SOP"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      {/* ──────────── Add/Edit SOP Bottom Sheet ──────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowForm(false)} />
          {/* Sheet */}
          <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[85vh] overflow-y-auto z-50">
            <div className="p-4 space-y-4">
              {/* Handle */}
              <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto" />
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-900">
                  {editingSop ? "Edit SOP" : "New SOP"}
                </h2>
                <button onClick={() => setShowForm(false)} className="p-1">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Title */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Title</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="SOP title..."
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Description</label>
                <textarea
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Describe the SOP steps..."
                  rows={3}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* Category chips */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-2 block">Category</label>
                <div className="flex flex-wrap gap-2">
                  {SOP_CATEGORIES.map((c) => (
                    <button
                      key={c}
                      onClick={() => setFormCat(c)}
                      className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
                        formCat === c
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Frequency radio */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-2 block">Frequency</label>
                <div className="flex gap-3">
                  {Object.entries(FREQUENCY_LABELS).map(([key, label]) => (
                    <label
                      key={key}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm cursor-pointer transition-colors ${
                        formFreq === key
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-gray-200 text-gray-600"
                      }`}
                    >
                      <input
                        type="radio"
                        name="freq"
                        value={key}
                        checked={formFreq === key}
                        onChange={() => setFormFreq(key)}
                        className="sr-only"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2 pb-4">
                <button
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveForm}
                  disabled={saving || !formTitle.trim()}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-sm font-medium disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingSop ? "Update" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──────────── Log Violation Bottom Sheet ──────────── */}
      {showViolationForm && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowViolationForm(false)} />
          <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[85vh] overflow-y-auto z-50">
            <div className="p-4 space-y-4">
              <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto" />
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-900">Log Violation</h2>
                <button onClick={() => setShowViolationForm(false)} className="p-1">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* SOP select */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">SOP</label>
                <select
                  value={violSopId}
                  onChange={(e) => setViolSopId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">Select SOP...</option>
                  {sops.map((s) => (
                    <option key={s.id} value={s.id}>{s.title}</option>
                  ))}
                </select>
              </div>

              {/* Staff name (free text since no staff data pull) */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Staff name (optional)</label>
                <input
                  type="text"
                  value={violStaffName}
                  onChange={(e) => setViolStaffName(e.target.value)}
                  placeholder="Name of staff member..."
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Notes</label>
                <textarea
                  value={violNotes}
                  onChange={(e) => setViolNotes(e.target.value)}
                  placeholder="Describe the violation..."
                  rows={3}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2 pb-4">
                <button
                  onClick={() => setShowViolationForm(false)}
                  className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLogViolation}
                  disabled={violSaving || !violSopId}
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl text-sm font-medium disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {violSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Log Violation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
