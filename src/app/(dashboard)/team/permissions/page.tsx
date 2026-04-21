"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Save, Eye, Pencil, Trash2, ShieldCheck, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface Feature {
  key: string;
  label: string;
  hasApprove: boolean;
}

interface FeaturePermission {
  view: boolean;
  edit: boolean;
  delete: boolean;
  approve: boolean;
}

type RolePermissions = Record<string, Record<string, FeaturePermission>>;

const ROLE_LABELS: Record<string, string> = {
  SUPERVISOR: "Supervisor",
  PURCHASE_MANAGER: "Purchase Mgr",
  ACCOUNTS_MANAGER: "Accounts Mgr",
  INWARDS_CLERK: "Inwards Clerk",
  OUTWARDS_CLERK: "Outwards Clerk",
};

const EDITABLE_ROLES = ["SUPERVISOR", "PURCHASE_MANAGER", "ACCOUNTS_MANAGER", "INWARDS_CLERK", "OUTWARDS_CLERK"];

export default function PermissionsPage() {
  const [permissions, setPermissions] = useState<RolePermissions>({});
  const [features, setFeatures] = useState<Feature[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedRole, setSelectedRole] = useState(EDITABLE_ROLES[0]);

  useEffect(() => {
    fetch("/api/role-permissions")
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setPermissions(res.data.permissions);
          setFeatures(res.data.features);
        }
      })
      .catch(() => setError("Failed to load permissions"))
      .finally(() => setLoading(false));
  }, []);

  const toggle = (role: string, featureKey: string, perm: keyof FeaturePermission) => {
    if (role === "ADMIN") return; // Admin always full
    setPermissions((prev) => ({
      ...prev,
      [role]: {
        ...prev[role],
        [featureKey]: {
          ...prev[role]?.[featureKey],
          [perm]: !prev[role]?.[featureKey]?.[perm],
        },
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/role-permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions }),
      }).then((r) => r.json());
      if (res.success) {
        setSuccess("Permissions saved!");
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(res.error || "Failed to save");
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm("Reset all permissions to defaults? This cannot be undone.")) return;
    setLoading(true);
    try {
      await fetch("/api/role-permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: {} }),
      });
      const res = await fetch("/api/role-permissions").then((r) => r.json());
      if (res.success) {
        setPermissions(res.data.permissions);
        setSuccess("Reset to defaults");
        setTimeout(() => setSuccess(""), 3000);
      }
    } catch {
      setError("Failed to reset");
    } finally {
      setLoading(false);
    }
  };

  const getPerm = (role: string, featureKey: string): FeaturePermission => {
    return permissions[role]?.[featureKey] || { view: false, edit: false, delete: false, approve: false };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="pb-8">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/team" className="p-1">
          <ArrowLeft className="h-5 w-5 text-slate-600" />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-slate-900">Roles & Permissions</h1>
          <p className="text-xs text-slate-500">Manage what each role can view, edit, delete, and approve</p>
        </div>
        <button onClick={handleReset} className="p-2 text-slate-400 hover:text-slate-600">
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
          <p className="text-sm text-green-700">{success}</p>
        </div>
      )}

      {/* Admin note */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 mb-4">
        <p className="text-[11px] text-blue-700">
          <strong>Admin</strong> always has full access to everything. Configure permissions for other roles below.
        </p>
      </div>

      {/* Role tabs */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide mb-4 pb-1">
        {EDITABLE_ROLES.map((role) => (
          <button
            key={role}
            onClick={() => setSelectedRole(role)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              selectedRole === role
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {ROLE_LABELS[role]}
          </button>
        ))}
      </div>

      {/* Permission legend */}
      <div className="flex items-center gap-4 mb-3 px-1">
        <div className="flex items-center gap-1 text-[10px] text-slate-500">
          <Eye className="h-3 w-3" /> View
        </div>
        <div className="flex items-center gap-1 text-[10px] text-slate-500">
          <Pencil className="h-3 w-3" /> Edit
        </div>
        <div className="flex items-center gap-1 text-[10px] text-slate-500">
          <Trash2 className="h-3 w-3" /> Delete
        </div>
        <div className="flex items-center gap-1 text-[10px] text-slate-500">
          <ShieldCheck className="h-3 w-3" /> Approve
        </div>
      </div>

      {/* Permissions matrix for selected role */}
      <div className="space-y-1.5">
        {features.map((feature) => {
          const perm = getPerm(selectedRole, feature.key);
          return (
            <Card key={feature.key} className="border-slate-100">
              <CardContent className="p-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-slate-800 flex-1 min-w-0 mr-2">
                    {feature.label}
                  </p>
                  <div className="flex items-center gap-1 shrink-0">
                    {/* View */}
                    <button
                      onClick={() => toggle(selectedRole, feature.key, "view")}
                      className={`p-1.5 rounded-md transition-colors ${
                        perm.view ? "bg-blue-100 text-blue-700" : "bg-slate-50 text-slate-300"
                      }`}
                      title="View"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    {/* Edit */}
                    <button
                      onClick={() => toggle(selectedRole, feature.key, "edit")}
                      className={`p-1.5 rounded-md transition-colors ${
                        perm.edit ? "bg-amber-100 text-amber-700" : "bg-slate-50 text-slate-300"
                      }`}
                      title="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {/* Delete */}
                    <button
                      onClick={() => toggle(selectedRole, feature.key, "delete")}
                      className={`p-1.5 rounded-md transition-colors ${
                        perm.delete ? "bg-red-100 text-red-700" : "bg-slate-50 text-slate-300"
                      }`}
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    {/* Approve (only if feature supports it) */}
                    {feature.hasApprove ? (
                      <button
                        onClick={() => toggle(selectedRole, feature.key, "approve")}
                        className={`p-1.5 rounded-md transition-colors ${
                          perm.approve ? "bg-green-100 text-green-700" : "bg-slate-50 text-slate-300"
                        }`}
                        title="Approve"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <div className="p-1.5 w-[26px]" /> // spacer
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Save button */}
      <div className="mt-4">
        <Button onClick={handleSave} size="lg" disabled={saving} className="w-full bg-indigo-600 hover:bg-indigo-700">
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Saving..." : "Save Permissions"}
        </Button>
      </div>
    </div>
  );
}
