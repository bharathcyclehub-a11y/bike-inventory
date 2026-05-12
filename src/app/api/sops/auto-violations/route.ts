export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

function dateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const TIME_SLOTS = ["MORNING", "AFTERNOON", "EVENING"];

/**
 * POST /api/sops/auto-violations
 *
 * Detects daily SOPs that were not checked off for each time slot
 * on the target date and auto-creates violation records.
 *
 * Body: { date?: "YYYY-MM-DD", timeSlot?: "MORNING"|"AFTERNOON"|"EVENING" }
 * If timeSlot omitted, checks ALL time slots for that date.
 * Only CEO/ADMIN can trigger.
 */
export async function POST(req: Request) {
  try {
    const admin = await requireAuth(["CEO", "ADMIN"]);
    const body = await req.json().catch(() => ({}));

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const targetDate = (body.date as string) || dateStr(yesterday);
    const targetSlots: string[] = body.timeSlot ? [body.timeSlot] : TIME_SLOTS;

    // Get all active daily SOPs with their role assignments and time slots
    const dailySOPs = await prisma.sOP.findMany({
      where: { isActive: true, frequency: "SOP_DAILY" },
      include: {
        roleAssignments: true,
        assignees: true,
      },
    });

    const activeUsers = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, role: true },
    });

    // Get all check-offs for that date (all time slots)
    const checkOffs = await prisma.sOPCheckOff.findMany({
      where: { date: targetDate },
      select: { sopId: true, userId: true, timeSlot: true },
    });
    const checkedSet = new Set(checkOffs.map(c => `${c.sopId}:${c.userId}:${c.timeSlot}`));

    // Get existing auto-violations for that date
    const startOfDay = new Date(targetDate + "T00:00:00.000Z");
    const endOfDay = new Date(targetDate + "T23:59:59.999Z");
    const existingViolations = await prisma.sOPViolation.findMany({
      where: {
        createdAt: { gte: startOfDay, lte: endOfDay },
        notes: { startsWith: "[AUTO]" },
      },
      select: { sopId: true, userId: true, notes: true },
    });
    const existingSet = new Set(existingViolations.map(v => {
      // Extract timeSlot from notes if present
      const match = v.notes?.match(/\[(\w+)\]/g);
      const slotTag = match && match.length > 1 ? match[1].replace(/\[|\]/g, "") : "";
      return `${v.sopId}:${v.userId}:${slotTag}`;
    }));

    let created = 0;
    const violations: { userName: string; sopTitle: string; timeSlot: string }[] = [];

    for (const sop of dailySOPs) {
      const sopTimeSlots = sop.timeSlots && sop.timeSlots.length > 0
        ? sop.timeSlots
        : TIME_SLOTS;

      // Determine expected users
      const expectedUserIds = new Set<string>();
      for (const ra of sop.roleAssignments) {
        for (const u of activeUsers) {
          if (u.role === ra.role) expectedUserIds.add(u.id);
        }
      }
      for (const a of sop.assignees) {
        if (activeUsers.some(u => u.id === a.userId)) {
          expectedUserIds.add(a.userId);
        }
      }

      // Check each target time slot
      for (const slot of targetSlots) {
        if (!sopTimeSlots.includes(slot)) continue; // SOP doesn't apply to this slot

        for (const userId of expectedUserIds) {
          const checkKey = `${sop.id}:${userId}:${slot}`;
          const existKey = `${sop.id}:${userId}:${slot}`;
          if (!checkedSet.has(checkKey) && !existingSet.has(existKey)) {
            const user = activeUsers.find(u => u.id === userId);
            await prisma.sOPViolation.create({
              data: {
                sopId: sop.id,
                userId,
                notes: `[AUTO] [${slot}] Not checked off on ${targetDate}`,
                createdById: admin.id,
              },
            });
            created++;
            violations.push({
              userName: user?.name || "Unknown",
              sopTitle: sop.title,
              timeSlot: slot,
            });
          }
        }
      }
    }

    return successResponse({
      date: targetDate,
      timeSlots: targetSlots,
      violationsCreated: created,
      summary: violations.slice(0, 30),
      totalExpectedUsers: activeUsers.length,
      totalDailySOPs: dailySOPs.length,
    });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to detect violations", 500);
  }
}
