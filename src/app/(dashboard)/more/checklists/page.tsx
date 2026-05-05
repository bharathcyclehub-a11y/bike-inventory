"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Loader2, X, CheckSquare } from "lucide-react";

const ROLES = [
  { value: "SUPERVISOR", label: "Supervisor" },
  { value: "INWARDS_CLERK", label: "Inwards Clerk" },
  { value: "OUTWARDS_CLERK", label: "Outwards Clerk" },
  { value: "PURCHASE_MANAGER", label: "Purchase Manager" },
  { value: "ACCOUNTS_MANAGER", label: "Accounts Manager" },
];

interface Template {
  id: string;
  title: string;
  role: string;
  sortOrder: number;
  isActive: boolean;
}

export default function ChecklistManagementPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role || "";
  const isAdmin = role === "ADMIN";

  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState("SUPERVISOR");
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/checklists?role=${selectedRole}`).then(r => r.json());
      if (res.success) setTemplates(res.data);
    } catch { /* ignore */ }
    setLoading(false);
  }, [selectedRole]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/checklists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim(), role: selectedRole, sortOrder: templates.length }),
      }).then(r => r.json());
      if (res.success) {
        setNewTitle("");
        setShowForm(false);
        fetchTemplates();
      }
    } catch { /* ignore */ }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this checklist item?")) return;
    try {
      await fetch(`/api/checklists/${id}`, { method: "DELETE" });
      fetchTemplates();
    } catch { /* ignore */ }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      await fetch(`/api/checklists/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });
      fetchTemplates();
    } catch { /* ignore */ }
  };

  if (!isAdmin) {
    return <div className="p-6 text-center text-gray-500">Admin only</div>;
  }

  return (
    <div className="pb-20">
      <div className="flex items-center gap-2 mb-4">
        <Link href="/more"><ArrowLeft className="h-5 w-5 text-slate-600" /></Link>
        <div>
          <h1 className="text-lg font-bold text-slate-900">Daily Checklists</h1>
          <p className="text-xs text-slate-500">Manage role-based daily tasks</p>
        </div>
      </div>

      {/* Role Tabs */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide mb-4 pb-1">
        {ROLES.map((r) => (
          <button key={r.value} onClick={() => setSelectedRole(r.value)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              selectedRole === r.value ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
            }`}>
            {r.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
      ) : (
        <div className="space-y-2">
          {templates.length === 0 && (
            <p className="text-center py-8 text-sm text-slate-400">No checklist items for this role</p>
          )}
          {templates.map((t) => (
            <div key={t.id} className={`flex items-center gap-3 p-3 bg-white rounded-xl border shadow-sm ${!t.isActive ? "opacity-50" : ""}`}>
              <button onClick={() => handleToggle(t.id, t.isActive)}
                className={`w-5 h-5 rounded flex-shrink-0 border-2 transition-colors ${
                  t.isActive ? "bg-green-500 border-green-500" : "bg-gray-200 border-gray-300"
                }`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{t.title}</p>
              </div>
              <button onClick={() => handleDelete(t.id)} className="p-1 text-slate-400 hover:text-red-500">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add Form */}
      {showForm && (
        <div className="mt-3 bg-blue-50 border border-blue-200 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-blue-800">New checklist item for {ROLES.find(r => r.value === selectedRole)?.label}</p>
            <button onClick={() => setShowForm(false)}><X className="h-4 w-4 text-slate-400" /></button>
          </div>
          <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
            placeholder="e.g. Check delivery vehicle tyre pressure"
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="w-full px-3 py-2 text-sm border border-blue-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 mb-2" />
          <button onClick={handleAdd} disabled={saving || !newTitle.trim()}
            className="w-full py-2 bg-blue-600 text-white rounded-lg text-xs font-medium disabled:opacity-50">
            {saving ? "Adding..." : "Add Item"}
          </button>
        </div>
      )}

      {/* FAB */}
      <button onClick={() => setShowForm(true)}
        className="fixed above-nav right-4 w-14 h-14 bg-blue-600 rounded-full shadow-lg z-50 flex items-center justify-center text-white active:scale-95 transition-transform">
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
}
