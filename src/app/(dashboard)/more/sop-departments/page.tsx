"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Loader2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

const DEFAULT_DEPARTMENTS = ["Sales", "Service", "Ops", "Finance", "Billing", "BDC", "Content"];

export default function SOPDepartmentsPage() {
  const [departments, setDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newDept, setNewDept] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings?key=sop_departments")
      .then(r => r.json())
      .then(res => {
        if (res.success && Array.isArray(res.data?.value)) {
          setDepartments(res.data.value);
        } else {
          setDepartments(DEFAULT_DEPARTMENTS);
        }
      })
      .catch(() => setDepartments(DEFAULT_DEPARTMENTS))
      .finally(() => setLoading(false));
  }, []);

  const saveDepartments = async (deps: string[]) => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "sop_departments", value: deps }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      alert("Failed to save");
    }
    setSaving(false);
  };

  const handleAdd = () => {
    const name = newDept.trim();
    if (!name) return;
    if (departments.includes(name)) return;
    const updated = [...departments, name];
    setDepartments(updated);
    setNewDept("");
    saveDepartments(updated);
  };

  const handleRemove = (idx: number) => {
    const updated = departments.filter((_, i) => i !== idx);
    setDepartments(updated);
    saveDepartments(updated);
  };

  return (
    <div className="pb-20 px-4 pt-3">
      <div className="flex items-center gap-2 mb-4">
        <Link href="/more">
          <ArrowLeft className="h-5 w-5 text-slate-600" />
        </Link>
        <h1 className="text-lg font-bold text-slate-900">SOP Departments</h1>
      </div>

      <p className="text-xs text-slate-500 mb-4">
        Manage the department categories used for SOPs. These appear as filter chips and category options when creating SOPs.
      </p>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
      ) : (
        <>
          {/* Department List */}
          <div className="space-y-2 mb-4">
            {departments.map((dept, idx) => (
              <Card key={idx}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-slate-300" />
                    <span className="text-sm font-medium text-slate-700">{dept}</span>
                  </div>
                  <button
                    onClick={() => handleRemove(idx)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Add New */}
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Type department name & tap Add"
              value={newDept}
              onChange={(e) => setNewDept(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              className="text-sm"
            />
            <Button onClick={handleAdd} size="sm" disabled={!newDept.trim() || saving} className="bg-blue-600 text-white hover:bg-blue-700 px-4">
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>

          {saved && (
            <p className="text-xs text-green-600 text-center mt-2">Saved! Changes will appear in the SOP page.</p>
          )}
          {saving && (
            <div className="flex items-center justify-center gap-2 text-xs text-slate-400 mt-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...
            </div>
          )}
        </>
      )}
    </div>
  );
}
