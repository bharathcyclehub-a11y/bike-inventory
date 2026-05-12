export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

function dateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const ALL_SLOTS = ["MORNING", "AFTERNOON", "EVENING"];

export async function GET() {
  try {
    await requireAuth();

    const now = new Date();
    const today = dateStr(now);

    // Week boundaries (Mon-Sun)
    const dayOfWeek = now.getDay();
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - diffToMonday);
    weekStart.setHours(0, 0, 0, 0);

    const [activeUsers, activeSOPs, roleAssignments] = await Promise.all([
      prisma.user.findMany({
        where: { isActive: true },
        select: { id: true, name: true, role: true },
      }),
      prisma.sOP.findMany({
        where: { isActive: true },
        select: { id: true, title: true, category: true, frequency: true, timeSlots: true },
      }),
      prisma.sOPRoleAssignment.findMany({
        where: { sop: { isActive: true } },
        select: { sopId: true, role: true },
      }),
    ]);

    // Build role→SOP map
    const roleSopMap: Record<string, Set<string>> = {};
    for (const ra of roleAssignments) {
      if (!roleSopMap[ra.role]) roleSopMap[ra.role] = new Set();
      roleSopMap[ra.role].add(ra.sopId);
    }

    // Build user→expected SOPs
    const userExpectedSops: Record<string, Set<string>> = {};
    for (const u of activeUsers) {
      userExpectedSops[u.id] = new Set(roleSopMap[u.role] || []);
    }

    const individualAssignments = await prisma.sOPAssignee.findMany({
      where: { sop: { isActive: true }, user: { isActive: true } },
      select: { sopId: true, userId: true },
    });
    for (const ia of individualAssignments) {
      if (userExpectedSops[ia.userId]) {
        userExpectedSops[ia.userId].add(ia.sopId);
      }
    }

    // Daily SOPs only
    const dailySopIds = new Set(
      activeSOPs.filter(s => s.frequency === "SOP_DAILY").map(s => s.id)
    );

    // SOP timeSlots map
    const sopTimeSlotsMap: Record<string, string[]> = {};
    for (const s of activeSOPs) {
      sopTimeSlotsMap[s.id] = s.timeSlots && s.timeSlots.length > 0 ? s.timeSlots : ALL_SLOTS;
    }

    // Get check-offs for last 30 days
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDate = dateStr(thirtyDaysAgo);

    const checkOffs = await prisma.sOPCheckOff.findMany({
      where: { date: { gte: cutoffDate } },
      select: { sopId: true, userId: true, date: true, timeSlot: true },
    });

    // Violations this week
    const weekViolations = await prisma.sOPViolation.findMany({
      where: { createdAt: { gte: weekStart } },
      select: { sopId: true, userId: true },
    });

    // KPI 1: Team Adherence Rate (today) — count per-timeSlot
    const todayCheckOffs = checkOffs.filter(c => c.date === today);
    let totalExpectedToday = 0;
    let totalDoneToday = 0;

    for (const u of activeUsers) {
      const expectedDaily = [...(userExpectedSops[u.id] || [])].filter(sid => dailySopIds.has(sid));
      for (const sid of expectedDaily) {
        const slots = sopTimeSlotsMap[sid] || ALL_SLOTS;
        totalExpectedToday += slots.length;
        for (const slot of slots) {
          if (todayCheckOffs.some(c => c.userId === u.id && c.sopId === sid && c.timeSlot === slot)) {
            totalDoneToday++;
          }
        }
      }
    }

    const teamAdherenceRate = totalExpectedToday > 0
      ? Math.round((totalDoneToday / totalExpectedToday) * 100)
      : 0;

    // Per-user stats
    // Build date→user→sopId:timeSlot checked set
    const dateUserChecks: Record<string, Record<string, Set<string>>> = {};
    for (const c of checkOffs) {
      if (!dateUserChecks[c.date]) dateUserChecks[c.date] = {};
      if (!dateUserChecks[c.date][c.userId]) dateUserChecks[c.date][c.userId] = new Set();
      dateUserChecks[c.date][c.userId].add(`${c.sopId}:${c.timeSlot}`);
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

    const userStats: UserStat[] = [];

    for (const u of activeUsers) {
      const expectedDaily = [...(userExpectedSops[u.id] || [])].filter(sid => dailySopIds.has(sid));
      if (expectedDaily.length === 0) continue;

      // Build expected slot keys for this user
      const expectedSlotKeys: string[] = [];
      for (const sid of expectedDaily) {
        const slots = sopTimeSlotsMap[sid] || ALL_SLOTS;
        for (const slot of slots) {
          expectedSlotKeys.push(`${sid}:${slot}`);
        }
      }

      // Today
      const userTodayChecks = dateUserChecks[today]?.[u.id] || new Set();
      const doneToday = expectedSlotKeys.filter(k => userTodayChecks.has(k)).length;
      const adherenceToday = expectedSlotKeys.length > 0 ? Math.round((doneToday / expectedSlotKeys.length) * 100) : 0;

      // Weekly score
      let weekTotal = 0;
      let weekDone = 0;
      for (let d = new Date(weekStart); d <= now; d.setDate(d.getDate() + 1)) {
        const ds = dateStr(d);
        weekTotal += expectedSlotKeys.length;
        const dayChecks = dateUserChecks[ds]?.[u.id] || new Set();
        weekDone += expectedSlotKeys.filter(k => dayChecks.has(k)).length;
      }
      const weeklyScore = weekTotal > 0 ? Math.round((weekDone / weekTotal) * 100) : 0;

      // Streak
      let streak = 0;
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      for (let d = new Date(yesterday); d >= thirtyDaysAgo; d.setDate(d.getDate() - 1)) {
        const ds = dateStr(d);
        const dayChecks = dateUserChecks[ds]?.[u.id] || new Set();
        const dayDone = expectedSlotKeys.filter(k => dayChecks.has(k)).length;
        if (dayDone >= expectedSlotKeys.length) {
          streak++;
        } else {
          break;
        }
      }
      if (adherenceToday === 100) streak++;

      const violations = weekViolations.filter(v => v.userId === u.id).length;

      userStats.push({
        userId: u.id,
        name: u.name,
        role: u.role,
        expectedToday: expectedSlotKeys.length,
        doneToday,
        adherenceToday,
        weeklyScore,
        streak,
        violations,
        rank: 0,
      });
    }

    userStats.sort((a, b) => b.weeklyScore - a.weeklyScore || b.streak - a.streak);
    userStats.forEach((u, i) => { u.rank = i + 1; });

    const teamWeeklyScore = userStats.length > 0
      ? Math.round(userStats.reduce((sum, u) => sum + u.weeklyScore, 0) / userStats.length)
      : 0;

    // Most missed SOP (counting all slots)
    const sopMissCount: Record<string, number> = {};
    for (const u of activeUsers) {
      const expectedDaily = [...(userExpectedSops[u.id] || [])].filter(sid => dailySopIds.has(sid));
      const userDone = dateUserChecks[today]?.[u.id] || new Set();
      for (const sid of expectedDaily) {
        const slots = sopTimeSlotsMap[sid] || ALL_SLOTS;
        for (const slot of slots) {
          if (!userDone.has(`${sid}:${slot}`)) {
            sopMissCount[sid] = (sopMissCount[sid] || 0) + 1;
          }
        }
      }
    }
    const mostMissedSopId = Object.entries(sopMissCount).sort((a, b) => b[1] - a[1])[0];
    const mostMissedSop = mostMissedSopId
      ? { title: activeSOPs.find(s => s.id === mostMissedSopId[0])?.title || "Unknown", count: mostMissedSopId[1] }
      : null;

    const champion = userStats.length > 0
      ? userStats.reduce((best, u) => u.streak > best.streak ? u : best, userStats[0])
      : null;

    const totalViolations = weekViolations.length;
    const deviationFreq = userStats.length > 0
      ? Math.round((totalViolations / userStats.length) * 10) / 10
      : 0;

    return successResponse({
      kpis: {
        teamAdherenceRate,
        teamWeeklyScore,
        totalExpectedToday,
        totalDoneToday,
        totalViolations,
        deviationFreq,
        mostMissedSop,
        champion: champion ? { name: champion.name, streak: champion.streak, score: champion.weeklyScore } : null,
      },
      leaderboard: userStats,
      totalActiveSOPs: activeSOPs.length,
      totalDailySOPs: dailySopIds.size,
    });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch SOP dashboard", 500);
  }
}
