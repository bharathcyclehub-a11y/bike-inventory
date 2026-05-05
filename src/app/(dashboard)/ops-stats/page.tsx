"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Ban,
  TrendingUp,
  TrendingDown,
  ClipboardCheck,
  ShieldAlert,
  Users,
  ListChecks,
  Loader2,
  Inbox,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/* ── Types ─────────────────────────────────────────────── */

interface PerUserStat {
  userId: string;
  name: string;
  role: string;
  total: number;
  done: number;
  pending: number;
  inProgress: number;
  blocked: number;
  completedThisWeek: number;
  overdue: number;
  followThrough: number;
}

interface StatsData {
  global: {
    totalActiveTasks: number;
    overdueCount: number;
    staleCount: number;
    unassignedCount: number;
    thisWeekCompleted: number;
    lastWeekCompleted: number;
  };
  sop: {
    totalActiveSOPs: number;
    todayCheckOffs: number;
    todayExpected: number;
    weekViolations: number;
    mostViolatedSop: { title: string; count: number } | null;
  };
  perUser: PerUserStat[];
}

/* ── Status color config ───────────────────────────────── */

const STATUS_CONFIG = {
  done: { color: "text-green-600", bg: "bg-green-50", icon: CheckCircle2 },
  overdue: { color: "text-red-600", bg: "bg-red-50", icon: AlertTriangle },
  blocked: { color: "text-orange-600", bg: "bg-orange-50", icon: Ban },
  pending: { color: "text-yellow-600", bg: "bg-yellow-50", icon: Clock },
  active: { color: "text-blue-600", bg: "bg-blue-50", icon: ListChecks },
};

/* ── Helpers ───────────────────────────────────────────── */

function followThroughColor(pct: number) {
  if (pct >= 75) return "text-green-600";
  if (pct >= 50) return "text-yellow-600";
  return "text-red-600";
}

function followThroughBg(pct: number) {
  if (pct >= 75) return "bg-green-500";
  if (pct >= 50) return "bg-yellow-500";
  return "bg-red-500";
}

function WoWArrow({ current, previous }: { current: number; previous: number }) {
  if (current > previous) return <TrendingUp className="h-4 w-4 text-green-600" />;
  if (current < previous) return <TrendingDown className="h-4 w-4 text-red-600" />;
  return <span className="text-xs text-gray-400">--</span>;
}

/* ── Loading skeleton ──────────────────────────────────── */

function LoadingSkeleton() {
  return (
    <div className="space-y-6 p-4">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-32 rounded-xl" />
      <Skeleton className="h-28 rounded-xl" />
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────── */

export default function OpsStatsPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role || "";
  const isAllowed = role === "ADMIN" || role === "SUPERVISOR";

  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isAllowed) return;
    fetch("/api/ops-stats")
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setData(res.data);
        else setError(res.error || "Failed to load stats");
      })
      .catch(() => setError("Network error"))
      .finally(() => setLoading(false));
  }, [isAllowed]);

  if (!isAllowed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-gray-500">
        <ShieldAlert className="h-12 w-12 mb-3" />
        <p className="text-lg font-medium">Access Denied</p>
        <p className="text-sm">Admin or Supervisor role required.</p>
      </div>
    );
  }

  if (loading) return <LoadingSkeleton />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-red-500">
        <AlertTriangle className="h-12 w-12 mb-3" />
        <p className="font-medium">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const { global: g, sop, perUser } = data;

  // Overall follow-through across all users
  const totalTasks = perUser.reduce((s, u) => s + u.total, 0);
  const totalDoneAndIP = perUser.reduce((s, u) => s + u.done + u.inProgress, 0);
  const overallFollowThrough = totalTasks > 0
    ? Math.round((totalDoneAndIP / totalTasks) * 100)
    : 0;

  const sopComplianceRate = sop.todayExpected > 0
    ? Math.round((sop.todayCheckOffs / sop.todayExpected) * 100)
    : 0;

  // Empty state
  const isEmpty = totalTasks === 0 && sop.totalActiveSOPs === 0;

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-gray-400 p-4">
        <Inbox className="h-16 w-16 mb-4" />
        <p className="text-lg font-medium text-gray-600">No Tasks or SOPs Yet</p>
        <p className="text-sm text-center mt-1">
          Create tasks and SOPs from the Operations Hub to see stats here.
        </p>
      </div>
    );
  }

  // Sort users by follow-through descending
  const sortedUsers = [...perUser]
    .filter((u) => u.total > 0)
    .sort((a, b) => b.followThrough - a.followThrough);

  return (
    <div className="space-y-6 p-4 pb-24 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2">
        <BarChart3 className="h-6 w-6 text-indigo-600" />
        <h1 className="text-xl font-bold text-gray-900">Ops Stats</h1>
      </div>

      {/* ── 1. Delegation Overview ──────────────────────── */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 space-y-4">
          {/* Follow-through big number */}
          <div className="text-center">
            <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">
              Follow-Through Rate
            </p>
            <p className={`text-5xl font-extrabold ${followThroughColor(overallFollowThrough)}`}>
              {overallFollowThrough}%
            </p>
          </div>

          {/* 2x2 stat cards */}
          <div className="grid grid-cols-2 gap-3">
            {/* Total Active */}
            <div className={`${STATUS_CONFIG.active.bg} rounded-xl p-3 text-center`}>
              <ListChecks className={`h-5 w-5 mx-auto mb-1 ${STATUS_CONFIG.active.color}`} />
              <p className={`text-2xl font-bold ${STATUS_CONFIG.active.color}`}>{g.totalActiveTasks}</p>
              <p className="text-xs text-gray-600">Active Tasks</p>
            </div>

            {/* Done this week */}
            <div className={`${STATUS_CONFIG.done.bg} rounded-xl p-3 text-center`}>
              <CheckCircle2 className={`h-5 w-5 mx-auto mb-1 ${STATUS_CONFIG.done.color}`} />
              <p className={`text-2xl font-bold ${STATUS_CONFIG.done.color}`}>{g.thisWeekCompleted}</p>
              <p className="text-xs text-gray-600">Done This Week</p>
            </div>

            {/* Overdue */}
            <div className={`${STATUS_CONFIG.overdue.bg} rounded-xl p-3 text-center`}>
              <AlertTriangle className={`h-5 w-5 mx-auto mb-1 ${STATUS_CONFIG.overdue.color}`} />
              <p className={`text-2xl font-bold ${STATUS_CONFIG.overdue.color}`}>{g.overdueCount}</p>
              <p className="text-xs text-gray-600">Overdue</p>
            </div>

            {/* Blocked */}
            <div className={`${STATUS_CONFIG.blocked.bg} rounded-xl p-3 text-center`}>
              <Ban className={`h-5 w-5 mx-auto mb-1 ${STATUS_CONFIG.blocked.color}`} />
              <p className={`text-2xl font-bold ${STATUS_CONFIG.blocked.color}`}>{g.staleCount}</p>
              <p className="text-xs text-gray-600">Stale (3d+)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── 2. SOP Compliance ───────────────────────────── */}
      {sop.totalActiveSOPs > 0 && (
        <div className="bg-teal-50 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-teal-700" />
            <h2 className="font-semibold text-teal-900">SOP Compliance</h2>
          </div>

          {/* Compliance rate */}
          <div className="text-center">
            <p className={`text-3xl font-bold ${sopComplianceRate >= 80 ? "text-teal-700" : sopComplianceRate >= 50 ? "text-yellow-600" : "text-red-600"}`}>
              {sopComplianceRate}%
            </p>
            <p className="text-xs text-gray-600">
              {sop.todayCheckOffs} of {sop.todayExpected} SOPs checked today
            </p>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-teal-200 rounded-full h-2">
            <div
              className="bg-teal-600 h-2 rounded-full transition-all"
              style={{ width: `${Math.min(sopComplianceRate, 100)}%` }}
            />
          </div>

          {/* Violations */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Violations this week</span>
            <span className={`font-semibold ${sop.weekViolations > 0 ? "text-red-600" : "text-teal-700"}`}>
              {sop.weekViolations}
            </span>
          </div>

          {/* Most broken SOP */}
          {sop.mostViolatedSop && (
            <div className="bg-white/60 rounded-lg p-2 text-sm">
              <p className="text-gray-500 text-xs">Most Broken SOP</p>
              <p className="font-medium text-gray-800 truncate">
                {sop.mostViolatedSop.title}{" "}
                <span className="text-red-500">({sop.mostViolatedSop.count}x)</span>
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── 3. Week-over-Week ───────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Week-over-Week
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {/* Completed */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <WoWArrow current={g.thisWeekCompleted} previous={g.lastWeekCompleted} />
              </div>
              <p className="text-lg font-bold text-gray-900">{g.thisWeekCompleted}</p>
              <p className="text-[10px] text-gray-500">vs {g.lastWeekCompleted} last wk</p>
              <p className="text-xs text-gray-600 mt-1">Completed</p>
            </CardContent>
          </Card>

          {/* Unassigned */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3 text-center">
              <Users className="h-4 w-4 mx-auto mb-1 text-gray-400" />
              <p className="text-lg font-bold text-gray-900">{g.unassignedCount}</p>
              <p className="text-xs text-gray-600 mt-1">Unassigned</p>
            </CardContent>
          </Card>

          {/* SOP Compliance */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3 text-center">
              <ClipboardCheck className="h-4 w-4 mx-auto mb-1 text-teal-500" />
              <p className="text-lg font-bold text-gray-900">{sopComplianceRate}%</p>
              <p className="text-xs text-gray-600 mt-1">SOP Rate</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── 4. Per-Person Breakdown ─────────────────────── */}
      {sortedUsers.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Per-Person Breakdown
          </h2>
          <div className="space-y-3">
            {sortedUsers.map((u) => (
              <Card key={u.userId} className="border-0 shadow-sm">
                <CardContent className="p-4 space-y-3">
                  {/* Name + follow-through */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">{u.name}</p>
                      <p className="text-xs text-gray-400">{u.role.replace(/_/g, " ")}</p>
                    </div>
                    <p className={`text-2xl font-bold ${followThroughColor(u.followThrough)}`}>
                      {u.followThrough}%
                    </p>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${followThroughBg(u.followThrough)}`}
                      style={{ width: `${u.followThrough}%` }}
                    />
                  </div>

                  {/* Stats row */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-green-600 font-medium">
                      {u.done} done
                    </span>
                    <span className="text-yellow-600 font-medium">
                      {u.pending} pending
                    </span>
                    <span className="text-blue-600 font-medium">
                      {u.inProgress} in-prog
                    </span>
                    <span className="text-red-600 font-medium">
                      {u.overdue} overdue
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
