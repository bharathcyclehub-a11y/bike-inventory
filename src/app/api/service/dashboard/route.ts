export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

export async function GET(_req: NextRequest) {
  try {
    await requireAuth();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const terminalStatuses = ["DELIVERED", "CANCELLED"];

    const [
      totalOpen,
      todayCreated,
      completedToday,
      revenueToday,
      byStatusRaw,
      byMechanicRaw,
      recentJobs,
    ] = await Promise.all([
      prisma.serviceJob.count({
        where: { status: { notIn: terminalStatuses as never[] } },
      }),

      prisma.serviceJob.count({
        where: { createdAt: { gte: todayStart, lte: todayEnd } },
      }),

      prisma.serviceJob.count({
        where: { completedAt: { gte: todayStart, lte: todayEnd } },
      }),

      prisma.serviceJobInvoice.aggregate({
        where: {
          paidAt: { gte: todayStart, lte: todayEnd },
          status: "PAID",
        },
        _sum: { paidAmount: true },
      }),

      prisma.serviceJob.groupBy({
        by: ["status"],
        _count: { id: true },
      }),

      prisma.serviceJob.findMany({
        where: {
          assignedToId: { not: null },
          status: { notIn: terminalStatuses as never[] },
        },
        select: {
          assignedTo: { select: { id: true, name: true } },
        },
      }),

      prisma.serviceJob.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          jobNo: true,
          status: true,
          priority: true,
          createdAt: true,
          customer: { select: { name: true, phone: true } },
        },
      }),
    ]);

    const byStatus: Record<string, number> = {};
    for (const row of byStatusRaw) {
      byStatus[row.status] = row._count.id;
    }

    const mechanicMap = new Map<string, { id: string; name: string; count: number }>();
    for (const row of byMechanicRaw) {
      if (row.assignedTo) {
        const key = row.assignedTo.id;
        const existing = mechanicMap.get(key);
        if (existing) {
          existing.count++;
        } else {
          mechanicMap.set(key, { id: row.assignedTo.id, name: row.assignedTo.name, count: 1 });
        }
      }
    }
    const byMechanic = Array.from(mechanicMap.values());

    return successResponse({
      totalOpen,
      todayCreated,
      completedToday,
      revenueToday: revenueToday._sum.paidAmount || 0,
      byStatus,
      byMechanic,
      recentJobs,
    });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch dashboard", 500);
  }
}
