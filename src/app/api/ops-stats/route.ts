export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

export async function GET() {
  try {
    await requireAuth();

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Start of current week (Monday)
    const dayOfWeek = now.getDay();
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - diffToMonday);

    // Start of last week
    const lastWeekStart = new Date(weekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(weekStart);

    // 3 days ago for stale detection
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const todayStr = today.toISOString().slice(0, 10);

    // ── Parallel queries ────────────────────────────────────────

    const [
      activeUsers,
      allTaskAssignees,
      // Global aggregations
      totalActiveTasks,
      overdueTasks,
      staleTasks,
      thisWeekCompleted,
      lastWeekCompleted,
      // SOP stats
      activeSOPs,
      todayCheckOffs,
      weekViolations,
      violationsBySop,
    ] = await Promise.all([
      // Active users
      prisma.user.findMany({
        where: { isActive: true },
        select: { id: true, name: true, role: true },
      }),

      // All task assignees with task data for per-user stats
      prisma.taskAssignee.findMany({
        include: {
          task: {
            select: {
              id: true,
              status: true,
              dueDate: true,
              completedAt: true,
            },
          },
        },
      }),

      // Total active tasks (not DONE)
      prisma.task.count({
        where: { status: { not: "DONE" } },
      }),

      // Overdue tasks
      prisma.task.count({
        where: {
          dueDate: { lt: today },
          status: { not: "DONE" },
        },
      }),

      // Stale tasks (PENDING, created > 3 days ago)
      prisma.task.count({
        where: {
          status: "PENDING",
          createdAt: { lt: threeDaysAgo },
        },
      }),

      // This week completed
      prisma.task.count({
        where: {
          status: "DONE",
          completedAt: { gte: weekStart },
        },
      }),

      // Last week completed
      prisma.task.count({
        where: {
          status: "DONE",
          completedAt: { gte: lastWeekStart, lt: lastWeekEnd },
        },
      }),

      // Active SOPs
      prisma.sOP.count({
        where: { isActive: true },
      }),

      // Today's check-offs
      prisma.sOPCheckOff.count({
        where: { date: todayStr },
      }),

      // This week's violations
      prisma.sOPViolation.count({
        where: { createdAt: { gte: weekStart } },
      }),

      // Violations grouped by SOP this week
      prisma.sOPViolation.groupBy({
        by: ["sopId"],
        where: { createdAt: { gte: weekStart } },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 1,
      }),
    ]);

    // ── Unassigned tasks (tasks with 0 assignees) ───────────────

    const tasksWithAssignees = await prisma.task.findMany({
      where: { status: { not: "DONE" } },
      select: {
        id: true,
        _count: { select: { assignees: true } },
      },
    });
    const unassignedCount = tasksWithAssignees.filter(
      (t) => t._count.assignees === 0
    ).length;

    // ── Per-user stats ──────────────────────────────────────────

    const perUser = activeUsers.map((u) => {
      const assignments = allTaskAssignees.filter((a) => a.userId === u.id);
      const total = assignments.length;
      const done = assignments.filter((a) => a.task.status === "DONE").length;
      const pending = assignments.filter((a) => a.task.status === "PENDING").length;
      const inProgress = assignments.filter((a) => a.task.status === "IN_PROGRESS").length;
      const blocked = assignments.filter((a) => a.task.status === "BLOCKED").length;
      const completedThisWeek = assignments.filter(
        (a) => a.task.status === "DONE" && a.task.completedAt && a.task.completedAt >= weekStart
      ).length;
      const overdue = assignments.filter(
        (a) => a.task.dueDate && a.task.dueDate < today && a.task.status !== "DONE"
      ).length;
      const followThrough = total > 0
        ? Math.round(((done + inProgress) / total) * 100)
        : 0;

      return {
        userId: u.id,
        name: u.name,
        role: u.role,
        total,
        done,
        pending,
        inProgress,
        blocked,
        completedThisWeek,
        overdue,
        followThrough,
      };
    });

    // ── Most violated SOP ───────────────────────────────────────

    let mostViolatedSop: { title: string; count: number } | null = null;
    if (violationsBySop.length > 0) {
      const sop = await prisma.sOP.findUnique({
        where: { id: violationsBySop[0].sopId },
        select: { title: true },
      });
      mostViolatedSop = {
        title: sop?.title || "Unknown",
        count: violationsBySop[0]._count.id,
      };
    }

    // ── SOP expected check-offs today ───────────────────────────
    // Daily SOPs assigned to active users = expected daily count
    const dailySopAssignees = await prisma.sOPAssignee.count({
      where: {
        sop: { isActive: true, frequency: "SOP_DAILY" },
        user: { isActive: true },
      },
    });

    // ── Response ────────────────────────────────────────────────

    return successResponse({
      global: {
        totalActiveTasks,
        overdueCount: overdueTasks,
        staleCount: staleTasks,
        unassignedCount,
        thisWeekCompleted,
        lastWeekCompleted,
      },
      sop: {
        totalActiveSOPs: activeSOPs,
        todayCheckOffs,
        todayExpected: dailySopAssignees,
        weekViolations,
        mostViolatedSop,
      },
      perUser,
    });
  } catch (error) {
    if (error instanceof AuthError)
      return errorResponse(error.message, error.status);
    return errorResponse(
      error instanceof Error ? error.message : "Failed to fetch ops stats",
      500
    );
  }
}
