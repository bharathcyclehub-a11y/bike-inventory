export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

// GET: Checklist completion stats for admin dashboard
export async function GET(req: NextRequest) {
  try {
    await requireAuth(["ADMIN", "SUPERVISOR"]);
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date") || new Date().toISOString().slice(0, 10);

    // Get all active users (except ADMIN)
    const users = await prisma.user.findMany({
      where: { isActive: true, role: { not: "ADMIN" } },
      select: { id: true, name: true, role: true },
    });

    // Get all active templates
    const templates = await prisma.checklistTemplate.findMany({
      where: { isActive: true },
      select: { id: true, role: true },
    });

    // Get completions for the date
    const completions = await prisma.checklistCompletion.findMany({
      where: { date },
      select: { templateId: true, userId: true },
    });

    // Build per-user stats
    const userStats = users.map((u) => {
      const userTemplates = templates.filter((t) => t.role === u.role);
      const userCompletions = completions.filter((c) => c.userId === u.id);
      const completed = userCompletions.length;
      const total = userTemplates.length;
      return {
        userId: u.id,
        name: u.name,
        role: u.role,
        total,
        completed,
        pending: total - completed,
        percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    }).filter((u) => u.total > 0); // Only show users with checklists

    return successResponse({ date, users: userStats });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed", 500);
  }
}
