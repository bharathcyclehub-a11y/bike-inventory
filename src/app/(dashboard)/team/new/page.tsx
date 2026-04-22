"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const ROLES = [
  { value: "ADMIN", label: "Admin — Full access" },
  { value: "SUPERVISOR", label: "Supervisor — View all, manage stock" },
  { value: "PURCHASE_MANAGER", label: "Purchase Manager — Reorder, POs, vendors" },
  { value: "ACCOUNTS_MANAGER", label: "Accounts Manager — Expenses, bills, payments, audit" },
  { value: "INWARDS_CLERK", label: "Inventory & Receiving Lead — Verify inwards, stock count" },
  { value: "OUTWARDS_CLERK", label: "Sales & Dispatch Lead — Verify outwards, stock count" },
];

export default function NewTeamMemberPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("INWARDS_CLERK");
  const [accessCode, setAccessCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !email || !accessCode) return;

    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, role, accessCode: accessCode.toUpperCase(), password: accessCode.toUpperCase() }),
      });
      const data = await res.json();
      if (data.success) {
        router.push("/team");
      } else {
        setError(data.error || "Failed to create user");
      }
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Link href="/team" className="p-1"><ArrowLeft className="h-5 w-5 text-slate-600" /></Link>
        <h1 className="text-lg font-bold text-slate-900">Add Team Member</h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
          <Input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
          <Input type="email" placeholder="name@bikeinventory.local" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Role *</label>
          <select value={role} onChange={(e) => setRole(e.target.value)}
            className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900">
            {ROLES.map((r) => (<option key={r.value} value={r.value}>{r.label}</option>))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Access Code *</label>
          <Input placeholder="e.g. JOHN123" value={accessCode} onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
            className="font-mono uppercase" />
          <p className="text-xs text-slate-400 mt-1">Used to log in. Must be unique.</p>
        </div>

        <Button type="submit" size="lg" disabled={!name || !email || !accessCode || submitting} className="w-full bg-blue-600 hover:bg-blue-700">
          {submitting ? "Creating..." : "Add Member"}
        </Button>
      </form>
    </div>
  );
}
