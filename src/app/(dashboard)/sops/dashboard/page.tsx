"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  ArrowLeft, TrendingUp, Trophy, AlertTriangle, Target,
  CheckCircle2, XCircle, Flame, Shield, Users, Loader2,
  Share2, Crown, Star,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/* ── Types ─────────────────────────────────────────── */

interface KPIs {
  teamAdherenceRate: number;
  teamWeeklyScore: number;
  totalExpectedToday: number;
  totalDoneToday: number;
  totalViolations: number;
  deviationFreq: number;
  mostMissedSop: { title: string; count: number } | null;
  champion: { name: string; streak: number; score: number } | null;
}

interface UserStat {
  userId: string;
  name: string;
  role: string;
  expectedToday: number;
  doneToday: number;
  adherenceToday: number;
  weeklyScore: number;
  streak: number;
  violations: number;
  rank: number;
}

interface DashboardData {
  kpis: KPIs;
  leaderboard: UserStat[];
  totalActiveSOPs: number;
  totalDailySOPs: number;
}

const ROLE_LABELS: Record<string, string> = {
  CEO: "CEO",
  ADMIN: "Owner",
  SUPERVISOR: "Ops Mgr",
  ACCOUNTS_MANAGER: "Finance",
  INWARDS_EXECUTIVE: "Inventory",
  OUTWARDS_EXECUTIVE: "Sales",
  STORE_MANAGER: "Store Mgr",
  SALES_MANAGER: "Sales Mgr",
  SERVICE_MANAGER: "Service Mgr",
  PURCHASE_MANAGER: "Purchase",
  CUSTOM: "Staff",
};

function scoreColor(pct: number): string {
  if (pct >= 85) return "text-green-600";
  if (pct >= 60) return "text-yellow-600";
  return "text-red-600";
}

function scoreBg(pct: number): string {
  if (pct >= 85) return "bg-green-50 border-green-200";
  if (pct >= 60) return "bg-yellow-50 border-yellow-200";
  return "bg-red-50 border-red-200";
}

function streakEmoji(streak: number): string {
  if (streak >= 14) return "🏆";
  if (streak >= 7) return "🔥";
  if (streak >= 3) return "⚡";
  return "";
}

/* ── Main Page ─────────────────────────────────────── */

export default function SOPDashboardPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role || "";
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/sops/dashboard")
      .then(r => r.json())
      .then(res => {
        if (res.success) setData(res.data);
        else setError(res.error || "Failed to load");
      })
      .catch(() => setError("Network error"))
      .finally(() => setLoading(false));
  }, []);

  const shareWhatsApp = () => {
    if (!data) return;
    const { kpis, leaderboard } = data;
    const top3 = leaderboard.slice(0, 3);
    const lines = [
      `📊 *BCH SOP Compliance Report*`,
      `📅 ${new Date().toLocaleDateString("en-IN")}`,
      "",
      `🎯 Team Adherence: *${kpis.teamAdherenceRate}%*`,
      `📈 Weekly Score: *${kpis.teamWeeklyScore}%*`,
      `✅ Done Today: ${kpis.totalDoneToday}/${kpis.totalExpectedToday}`,
      `⚠️ Violations: ${kpis.totalViolations}`,
      "",
    ];
    if (kpis.champion) {
      lines.push(`🏆 Champion: *${kpis.champion.name}* (${kpis.champion.streak} day streak)`);
    }
    if (kpis.mostMissedSop) {
      lines.push(`❌ Most Missed: ${kpis.mostMissedSop.title} (${kpis.mostMissedSop.count} people)`);
    }
    if (top3.length) {
      lines.push("", "🏅 *Top 3 This Week:*");
      top3.forEach((u, i) => {
        const stars = Math.max(0, 5 - u.violations * 0.5);
        const starStr = "⭐".repeat(Math.floor(stars)) + (stars % 1 >= 0.5 ? "½" : "");
        lines.push(`  ${i + 1}. ${u.name} — ${u.weeklyScore}% ${starStr} ${streakEmoji(u.streak)}`);
      });
    }
    const bottom3 = [...leaderboard].sort((a, b) => a.weeklyScore - b.weeklyScore).slice(0, 3);
    if (bottom3.length && bottom3[0].weeklyScore < 85) {
      lines.push("", "⚠️ *Needs Improvement:*");
      bottom3.forEach(u => {
        lines.push(`  • ${u.name} — ${u.weeklyScore}%`);
      });
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(lines.join("\n"))}`, "_blank");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 text-center text-red-500">
        <AlertTriangle className="h-6 w-6 mx-auto mb-2" />
        <p className="text-sm">{error || "Failed to load dashboard"}</p>
      </div>
    );
  }

  const { kpis, leaderboard } = data;

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Link href="/sops" className="text-slate-400">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-bold text-slate-900">SOP Compliance</h1>
        </div>
        <button onClick={shareWhatsApp} className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
          <Share2 className="h-4 w-4 text-green-600" />
        </button>
      </div>

      {/* KPI Cards - 2x2 grid */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {/* Team Adherence (Today) */}
        <Card className={`border ${scoreBg(kpis.teamAdherenceRate)}`}>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Target className="h-3.5 w-3.5 text-slate-500" />
              <span className="text-[10px] font-medium text-slate-500 uppercase">Today</span>
            </div>
            <p className={`text-2xl font-bold ${scoreColor(kpis.teamAdherenceRate)}`}>
              {kpis.teamAdherenceRate}%
            </p>
            <p className="text-[10px] text-slate-400">
              {kpis.totalDoneToday}/{kpis.totalExpectedToday} check-offs
            </p>
          </CardContent>
        </Card>

        {/* Weekly Score */}
        <Card className={`border ${scoreBg(kpis.teamWeeklyScore)}`}>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="h-3.5 w-3.5 text-slate-500" />
              <span className="text-[10px] font-medium text-slate-500 uppercase">Week</span>
            </div>
            <p className={`text-2xl font-bold ${scoreColor(kpis.teamWeeklyScore)}`}>
              {kpis.teamWeeklyScore}%
            </p>
            <p className="text-[10px] text-slate-400">team average</p>
          </CardContent>
        </Card>

        {/* Violations */}
        <Card className={`border ${kpis.totalViolations > 0 ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}`}>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Shield className="h-3.5 w-3.5 text-slate-500" />
              <span className="text-[10px] font-medium text-slate-500 uppercase">Violations</span>
            </div>
            <p className={`text-2xl font-bold ${kpis.totalViolations > 0 ? "text-red-600" : "text-green-600"}`}>
              {kpis.totalViolations}
            </p>
            <p className="text-[10px] text-slate-400">{kpis.deviationFreq}/person avg</p>
          </CardContent>
        </Card>

        {/* Champion */}
        <Card className="border bg-amber-50 border-amber-200">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Trophy className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-[10px] font-medium text-slate-500 uppercase">Champion</span>
            </div>
            {kpis.champion ? (
              <>
                <p className="text-sm font-bold text-amber-700 truncate">{kpis.champion.name}</p>
                <p className="text-[10px] text-amber-600">{kpis.champion.streak} day streak {streakEmoji(kpis.champion.streak)}</p>
              </>
            ) : (
              <p className="text-xs text-slate-400">No data yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Most Missed SOP */}
      {kpis.mostMissedSop && (
        <Card className="border border-red-200 bg-red-50 mb-4">
          <CardContent className="p-3 flex items-center gap-2">
            <XCircle className="h-4 w-4 text-red-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] font-medium text-red-500 uppercase">Most Missed Today</p>
              <p className="text-xs font-semibold text-red-700 truncate">{kpis.mostMissedSop.title}</p>
              <p className="text-[10px] text-red-500">{kpis.mostMissedSop.count} people haven&apos;t checked off</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Leaderboard */}
      <div className="mb-2 flex items-center gap-2">
        <Users className="h-4 w-4 text-slate-500" />
        <h2 className="text-sm font-bold text-slate-800">Leaderboard</h2>
        <span className="text-[10px] text-slate-400 ml-auto">Sorted by weekly score</span>
      </div>

      <div className="space-y-1.5">
        {leaderboard.map((u, idx) => {
          const isTop3 = idx < 3;
          const medalColors = ["text-amber-500", "text-slate-400", "text-orange-400"];

          return (
            <Card key={u.userId} className={`border ${u.weeklyScore < 60 ? "border-red-200" : ""}`}>
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  {/* Rank */}
                  <div className="w-6 text-center shrink-0">
                    {isTop3 ? (
                      <Crown className={`h-4 w-4 mx-auto ${medalColors[idx]}`} />
                    ) : (
                      <span className="text-xs font-bold text-slate-400">#{u.rank}</span>
                    )}
                  </div>

                  {/* Name + role */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{u.name}</p>
                    <p className="text-[10px] text-slate-400">{ROLE_LABELS[u.role] || u.role}</p>
                  </div>

                  {/* Streak */}
                  {u.streak > 0 && (
                    <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-orange-50 shrink-0">
                      <Flame className="h-3 w-3 text-orange-500" />
                      <span className="text-[10px] font-bold text-orange-600">{u.streak}d</span>
                    </div>
                  )}

                  {/* Today's progress */}
                  <div className="text-right shrink-0 w-16">
                    <div className="flex items-center justify-end gap-0.5">
                      <CheckCircle2 className={`h-3 w-3 ${u.adherenceToday === 100 ? "text-green-500" : "text-slate-300"}`} />
                      <span className={`text-xs font-bold ${scoreColor(u.adherenceToday)}`}>
                        {u.doneToday}/{u.expectedToday}
                      </span>
                    </div>
                    <p className={`text-[10px] font-medium ${scoreColor(u.weeklyScore)}`}>{u.weeklyScore}% wk</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-1.5 h-1 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      u.adherenceToday >= 85 ? "bg-green-500" :
                      u.adherenceToday >= 60 ? "bg-yellow-500" : "bg-red-500"
                    }`}
                    style={{ width: `${Math.min(u.adherenceToday, 100)}%` }}
                  />
                </div>

                {/* Star Rating: 5 base, -0.5 per violation */}
                {(() => {
                  const stars = Math.max(0, 5 - u.violations * 0.5);
                  const fullStars = Math.floor(stars);
                  const hasHalf = stars % 1 >= 0.5;
                  return (
                    <div className="mt-1.5 flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-3 w-3 ${
                            i < fullStars
                              ? "text-amber-400 fill-amber-400"
                              : i === fullStars && hasHalf
                              ? "text-amber-400 fill-amber-400/50"
                              : "text-slate-200"
                          }`}
                        />
                      ))}
                      <span className="text-[10px] text-slate-400 ml-1">{stars.toFixed(1)}</span>
                      {u.violations > 0 && (
                        <span className="text-[10px] text-red-500 ml-1">(-{u.violations * 0.5} for {u.violations} violation{u.violations > 1 ? "s" : ""})</span>
                      )}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          );
        })}

        {leaderboard.length === 0 && (
          <div className="text-center py-8 text-slate-400">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No SOP data yet. Seed SOPs and start checking off!</p>
          </div>
        )}
      </div>
    </div>
  );
}
