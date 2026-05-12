export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { sopCheckOffSchema } from "@/lib/validations";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

function todayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date") || todayDateString();
    const timeSlot = searchParams.get("timeSlot") || undefined;
    const userId = searchParams.get("userId") || undefined;

    const checkOffs = await prisma.sOPCheckOff.findMany({
      where: {
        date,
        ...(timeSlot && { timeSlot }),
        ...(userId && { userId }),
      },
      include: {
        sop: { select: { id: true, title: true, category: true, frequency: true, timeSlots: true } },
        user: { select: { id: true, name: true } },
      },
    });

    return successResponse(checkOffs);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch compliance", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await req.json();
    const data = sopCheckOffSchema.parse(body);

    const date = data.date || todayDateString();
    const timeSlot = data.timeSlot || "MORNING";

    // Admin/CEO can check off on behalf of another user
    const isAdmin = user.role === "ADMIN" || user.role === "CEO";
    const targetUserId = (isAdmin && body.targetUserId) ? body.targetUserId : user.id;

    // Toggle logic: if exists, remove; if not, create
    const existing = await prisma.sOPCheckOff.findFirst({
      where: { sopId: data.sopId, userId: targetUserId, date, timeSlot },
    });

    if (existing) {
      await prisma.sOPCheckOff.delete({ where: { id: existing.id } });
      return successResponse({ checked: false, sopId: data.sopId, date, timeSlot });
    }

    const checkOff = await prisma.sOPCheckOff.create({
      data: {
        sopId: data.sopId,
        userId: targetUserId,
        date,
        timeSlot,
        checkedAt: new Date(),
      },
    });

    // Trim records older than 90 days
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    const cutoffDate = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}-${String(cutoff.getDate()).padStart(2, "0")}`;

    await prisma.sOPCheckOff.deleteMany({
      where: { date: { lt: cutoffDate } },
    });

    return successResponse({ checked: true, sopId: data.sopId, date, timeSlot, id: checkOff.id });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to toggle check-off", 400);
  }
}
