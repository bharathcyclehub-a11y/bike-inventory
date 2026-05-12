import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Shared API key for cross-app sync (set in both apps' .env)
const SYNC_KEY = process.env.EARN_SYNC_KEY || "";

export async function GET(req: NextRequest) {
  // Validate sync key
  const key = req.nextUrl.searchParams.get("key");
  if (!SYNC_KEY || key !== SYNC_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dateStr = req.nextUrl.searchParams.get("date");
  const date = dateStr ? new Date(dateStr) : new Date();
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  // Get all active users
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, email: true, role: true },
  });

  const userIds = users.map((u) => u.id);

  // 1. Tasks completed today
  const completedTasks = await prisma.task.findMany({
    where: {
      status: "DONE",
      completedAt: { gte: dayStart, lte: dayEnd },
    },
    include: {
      assignees: { select: { userId: true } },
    },
  });

  // Build per-user task counts
  const taskCounts = new Map<string, number>();
  for (const task of completedTasks) {
    for (const assignee of task.assignees) {
      taskCounts.set(assignee.userId, (taskCounts.get(assignee.userId) || 0) + 1);
    }
  }

  // 2. SOP compliance today (check-offs vs assigned SOPs)
  const todayStr = dayStart.toISOString().slice(0, 10);
  const checkOffs = await prisma.sOPCheckOff.findMany({
    where: { date: todayStr },
    select: { userId: true, sopId: true, timeSlot: true },
  });

  // Get all active SOPs with role assignments
  const activeSops = await prisma.sOP.findMany({
    where: { isActive: true },
    include: {
      roleAssignments: true,
      assignees: true,
    },
  });

  // Calculate compliance per user
  const sopCompliance = new Map<string, { total: number; done: number }>();
  for (const u of users) {
    // SOPs assigned to this user (by role or direct assignment)
    const assignedSops = activeSops.filter(
      (s) =>
        s.assignees.some((a) => a.userId === u.id) ||
        s.roleAssignments.some((r) => r.role === u.role)
    );
    if (assignedSops.length === 0) continue;

    const userCheckOffs = checkOffs.filter((c) => c.userId === u.id);
    const checkedSopIds = new Set(userCheckOffs.map((c) => c.sopId));

    sopCompliance.set(u.id, {
      total: assignedSops.length,
      done: assignedSops.filter((s) => checkedSopIds.has(s.id)).length,
    });
  }

  // 3. SOP violations today
  const violations = await prisma.sOPViolation.findMany({
    where: {
      createdAt: { gte: dayStart, lte: dayEnd },
      userId: { in: userIds },
    },
    select: { userId: true, id: true },
  });

  const violationCounts = new Map<string, number>();
  for (const v of violations) {
    violationCounts.set(v.userId, (violationCounts.get(v.userId) || 0) + 1);
  }

  // 4. Checklist completions today
  const checklistCompletions = await prisma.checklistCompletion.findMany({
    where: { date: todayStr, userId: { in: userIds } },
    select: { userId: true },
  });

  const checklistCounts = new Map<string, number>();
  for (const c of checklistCompletions) {
    checklistCounts.set(c.userId, (checklistCounts.get(c.userId) || 0) + 1);
  }

  // Build response per user
  const events = users.map((u) => {
    const compliance = sopCompliance.get(u.id);
    const isFullCompliance = compliance && compliance.total > 0 && compliance.done === compliance.total;

    return {
      externalUserId: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      tasksCompleted: taskCounts.get(u.id) || 0,
      sopFullCompliance: isFullCompliance ? true : false,
      sopComplianceRate: compliance ? Math.round((compliance.done / compliance.total) * 100) : 0,
      sopViolations: violationCounts.get(u.id) || 0,
      checklistItemsDone: checklistCounts.get(u.id) || 0,
    };
  });

  return NextResponse.json({
    source: "bike-inventory",
    date: todayStr,
    events: events.filter(
      (e) => e.tasksCompleted > 0 || e.sopFullCompliance || e.sopViolations > 0 || e.checklistItemsDone > 0
    ),
  });
}
