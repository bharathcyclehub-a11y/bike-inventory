"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Users, Plus, Shield, ShieldCheck, UserCog, PackagePlus, PackageMinus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useDebounce } from "@/lib/utils";

interface TeamUser {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  _count: { transactions: number };
}

const ROLE_CONFIG: Record<string, { label: string; icon: typeof Shield; color: "danger" | "warning" | "info" | "success" | "default" }> = {
  ADMIN: { label: "Owner / Director", icon: ShieldCheck, color: "danger" },
  SUPERVISOR: { label: "Store Supervisor", icon: Shield, color: "warning" },
  PURCHASE_MANAGER: { label: "Purchase Manager", icon: UserCog, color: "info" },
  ACCOUNTS_MANAGER: { label: "Accounts Manager", icon: UserCog, color: "info" },
  INWARDS_CLERK: { label: "Purchase & Receiving Executive", icon: PackagePlus, color: "success" },
  OUTWARDS_CLERK: { label: "Sales & Dispatch Executive", icon: PackageMinus, color: "default" },
};

export default function TeamPage() {
  const { data: session } = useSession();
  const user = session?.user as { role?: string } | undefined;
  const isAdmin = user?.role === "ADMIN";
  const [members, setMembers] = useState<TeamUser[]>([]);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "50" });
    if (debouncedSearch.length >= 2) params.set("search", debouncedSearch);
    fetch(`/api/users?${params}`)
      .then((r) => r.json())
      .then((res) => { if (res.success) setMembers(res.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [debouncedSearch]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Team</h1>
          <p className="text-xs text-slate-500">{members.length} members</p>
        </div>
        {isAdmin && (
          <Link href="/team/new">
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-3.5 w-3.5 mr-1" />Add
            </Button>
          </Link>
        )}
      </div>

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input placeholder="Search team..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-3 border border-slate-100 rounded-lg animate-pulse">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-slate-200 shrink-0" />
                <div className="flex-1 space-y-1.5"><div className="h-4 bg-slate-200 rounded w-1/2" /><div className="h-3 bg-slate-200 rounded w-1/3" /></div>
                <div className="h-5 w-16 bg-slate-200 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : members.length === 0 ? (
        <div className="text-center py-12">
          <Users className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No team members found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {members.map((m) => {
            const rc = ROLE_CONFIG[m.role] || ROLE_CONFIG.INWARDS_CLERK;
            const Icon = rc.icon;
            return (
              <Link key={m.id} href={`/team/${m.id}`}>
                <Card className={`${!m.isActive ? "opacity-50" : ""}`}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                      <Icon className="h-5 w-5 text-slate-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900 truncate">{m.name}</p>
                        {!m.isActive && <Badge variant="danger" className="text-[9px]">Inactive</Badge>}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant={rc.color} className="text-[9px]">{rc.label}</Badge>
                        <span className="text-[10px] text-slate-400">{m._count.transactions} transactions</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] text-slate-400">
                        {new Date(m.createdAt).toLocaleDateString("en-IN")}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
