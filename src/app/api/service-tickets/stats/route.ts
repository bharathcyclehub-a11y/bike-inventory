export const revalidate = 120;

import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

const ALLOWED_ROLES = ["ADMIN", "ACCOUNTS_MANAGER", "OUTWARDS_CLERK"] as const;

export async function GET() {
  try {
    await requireAuth([...ALLOWED_ROLES]);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      totalOpen,
      escalated,
      resolvedToday,
      pendingEM,
      resolvedTickets,
      byDepartment,
      byPriority,
    ] = await Promise.all([
      // Total open: status NOT IN (RESOLVED, RESOLUTION_DELAYED)
      prisma.serviceTicket.count({
        where: { status: { notIn: ["RESOLVED", "RESOLUTION_DELAYED"] } },
      }),

      // Escalated
      prisma.serviceTicket.count({
        where: { status: "ESCALATED" },
      }),

      // Resolved today
      prisma.serviceTicket.count({
        where: { resolvedAt: { gte: todayStart } },
      }),

      // Pending EM: emTicketStatus is set but not CLOSED
      prisma.serviceTicket.count({
        where: {
          emTicketStatus: { not: null },
          NOT: { emTicketStatus: "CLOSED" },
        },
      }),

      // For avg resolution days: get resolved tickets with both dates
      prisma.serviceTicket.findMany({
        where: { resolvedAt: { not: null } },
        select: { createdAt: true, resolvedAt: true },
      }),

      // By department
      prisma.serviceTicket.groupBy({
        by: ["department"],
        _count: { _all: true },
      }),

      // By priority (only open tickets)
      prisma.serviceTicket.groupBy({
        by: ["priority"],
        where: { status: { notIn: ["RESOLVED", "RESOLUTION_DELAYED"] } },
        _count: { _all: true },
      }),
    ]);

    // Calculate average resolution days
    let avgResolutionDays = 0;
    if (resolvedTickets.length > 0) {
      const totalDays = resolvedTickets.reduce((sum, t) => {
        const created = new Date(t.createdAt).getTime();
        const resolved = new Date(t.resolvedAt!).getTime();
        return sum + (resolved - created) / (1000 * 60 * 60 * 24);
      }, 0);
      avgResolutionDays = Math.round((totalDays / resolvedTickets.length) * 10) / 10;
    }

    return successResponse({
      totalOpen,
      escalated,
      resolvedToday,
      pendingEM,
      avgResolutionDays,
      byDepartment: byDepartment.map((d) => ({
        department: d.department,
        count: d._count._all,
      })),
      byPriority: byPriority.map((p) => ({
        priority: p.priority,
        count: p._count._all,
      })),
    });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch stats", 500);
  }
}
