"use client";

import { use, useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, ShieldAlert, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface UserDetail {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { transactions: number; stockCounts: number };
}

const ROLES = [
  { value: "ADMIN", label: "Owner / Director" },
  { value: "SUPERVISOR", label: "Store Supervisor" },
  { value: "PURCHASE_MANAGER", label: "Purchase Manager" },
  { value: "ACCOUNTS_MANAGER", label: "Accounts Manager" },
  { value: "INWARDS_CLERK", label: "Inventory & Receiving Lead" },
  { value: "OUTWARDS_CLERK", label: "Sales & Dispatch Lead" },
];

const ROLE_PERMISSIONS: Record<string, string[]> = {
  ADMIN: ["Full access to all features", "Manage team & roles", "Zoho sync", "Reports", "Vendors & POs", "Bills & Payments", "Expenses", "AI Insights", "Bin management", "Settings"],
  SUPERVISOR: ["View all data", "Manage stock", "Team view", "Reports", "Vendors & POs", "Bills & Payments", "Expenses", "AI Insights", "Approve transfers"],
  PURCHASE_MANAGER: ["Reorder dashboard", "Purchase Orders", "Vendors", "Stock view", "AI Insights", "Barcode Scanner", "WhatsApp PO share"],
  ACCOUNTS_MANAGER: ["Expenses", "Accounts", "Bills & Payments", "Record Payments", "Receivables", "Stock Audit"],
  INWARDS_CLERK: ["Verify Zoho inwards (putaway)", "Stock Count", "Stock view (no cost price)", "Barcode Scanner"],
  OUTWARDS_CLERK: ["Verify Zoho outwards (dispatch)", "Stock Count", "Stock view (no cost price)", "Barcode Scanner"],
};

export default function EditTeamMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session } = useSession();
  const currentUser = session?.user as { role?: string; userId?: string } | undefined;
  const isAdmin = currentUser?.role === "ADMIN";
  const router = useRouter();

  const [user, setUser] = useState<UserDetail | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetch(`/api/users/${id}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          const u = res.data;
          setUser(u);
          setName(u.name);
          setEmail(u.email);
          setRole(u.role);
          setAccessCode(u.accessCode || "");
          setIsActive(u.isActive);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSave() {
    if (!isAdmin) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const body: Record<string, unknown> = { name, email, role, accessCode, isActive };
      if (newPassword) body.password = newPassword;

      const res = await fetch(`/api/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess("Saved successfully");
        setNewPassword("");
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(data.error || "Failed to save");
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <ShieldAlert className="h-12 w-12 text-slate-300 mx-auto mb-3" />
        <p className="text-sm text-slate-500">User not found</p>
        <Link href="/team" className="text-sm text-blue-600 mt-2 inline-block">Back to Team</Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Link href="/team" className="p-1"><ArrowLeft className="h-5 w-5 text-slate-600" /></Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-slate-900 truncate">{user.name}</h1>
          <div className="flex items-center gap-2">
            <Badge variant="info" className="text-[9px]">{ROLES.find(r => r.value === user.role)?.label || user.role}</Badge>
            {!user.isActive && <Badge variant="danger" className="text-[9px]">Inactive</Badge>}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-slate-50 rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-slate-900">{user._count.transactions}</p>
          <p className="text-[10px] text-slate-500">Transactions</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-slate-900">{user._count.stockCounts}</p>
          <p className="text-[10px] text-slate-500">Stock Audits</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-green-700">{success}</p>
        </div>
      )}

      {isAdmin ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900">
              {ROLES.map((r) => (<option key={r.value} value={r.value}>{r.label}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Access Code</label>
            <Input value={accessCode} onChange={(e) => setAccessCode(e.target.value.toUpperCase())} className="font-mono uppercase" />
          </div>

          <div className="flex items-center justify-between py-2">
            <span className="text-sm font-medium text-slate-700">Active</span>
            <button type="button" onClick={() => setIsActive(!isActive)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isActive ? "bg-green-500" : "bg-slate-300"}`}>
              <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${isActive ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
            <Input type="password" placeholder="Leave blank to keep current" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>

          {/* Role Permissions Summary */}
          {role && ROLE_PERMISSIONS[role] && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-blue-800 mb-1.5">Permissions for {ROLES.find(r => r.value === role)?.label}</p>
              <ul className="space-y-0.5">
                {ROLE_PERMISSIONS[role].map((perm) => (
                  <li key={perm} className="text-xs text-blue-700 flex items-center gap-1.5">
                    <span className="h-1 w-1 rounded-full bg-blue-400 shrink-0" />
                    {perm}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Button onClick={handleSave} size="lg" disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700">
            <Save className="h-4 w-4 mr-2" />{saving ? "Saving..." : "Save Changes"}
          </Button>

          {/* Delete / Remove user */}
          {currentUser?.userId !== id && (
            <Button variant="outline" size="lg" disabled={deleting}
              className="w-full border-red-300 text-red-600 hover:bg-red-50"
              onClick={async () => {
                if (!confirm(`Remove ${user.name} from the team?`)) return;
                setDeleting(true);
                setError("");
                try {
                  const res = await fetch(`/api/users/${id}`, { method: "DELETE" }).then(r => r.json());
                  if (res.success) {
                    const d = res.data;
                    if (d.deleted) {
                      setSuccess(d.message);
                      setTimeout(() => router.push("/team"), 1500);
                    } else if (d.deactivated) {
                      setSuccess(d.message);
                      setIsActive(false);
                      setUser((prev) => prev ? { ...prev, isActive: false } : prev);
                    }
                  } else {
                    setError(res.error || "Failed to remove");
                  }
                } catch { setError("Network error"); }
                finally { setDeleting(false); }
              }}>
              <Trash2 className="h-4 w-4 mr-2" />{deleting ? "Removing..." : "Remove from Team"}
            </Button>
          )}

          <p className="text-xs text-slate-400 text-center">
            Member since {new Date(user.createdAt).toLocaleDateString("en-IN")}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-500">Name</p>
            <p className="text-sm font-medium text-slate-900">{user.name}</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-500">Email</p>
            <p className="text-sm font-medium text-slate-900">{user.email}</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-500">Member Since</p>
            <p className="text-sm font-medium text-slate-900">{new Date(user.createdAt).toLocaleDateString("en-IN")}</p>
          </div>
          <p className="text-xs text-slate-400 text-center mt-4">Only admins can edit team members</p>
        </div>
      )}
    </div>
  );
}
