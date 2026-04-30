"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Loader2, GripVertical, Save } from "lucide-react";
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

  const handleAdd = () => {
    const name = newDept.trim();
    if (!name) return;
    if (departments.includes(name)) return;
    setDepartments([...departments, name]);
    setNewDept("");
    setSaved(false);
  };

  const handleRemove = (idx: number) => {
    setDepartments(departments.filter((_, i) => i !== idx));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "sop_departments", value: departments }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      alert("Failed to save");
    }
    setSaving(false);
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
              placeholder="New department name..."
              value={newDept}
              onChange={(e) => setNewDept(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              className="text-sm"
            />
            <Button onClick={handleAdd} size="sm" variant="outline" disabled={!newDept.trim()}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Save Button */}
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            {saved ? "Saved!" : "Save Departments"}
          </Button>

          {saved && (
            <p className="text-xs text-green-600 text-center mt-2">Departments saved. Changes will appear in the SOP page.</p>
          )}
        </>
      )}
    </div>
  );
}
