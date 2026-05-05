export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

export async function GET() {
  try {
    await requireAuth(["ADMIN", "SUPERVISOR", "OUTWARDS_CLERK"]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Exclude SERVICE invoices to match the list API behavior
    const baseWhere = { NOT: { invoiceType: "SERVICE" } };

    const [pending, verified, scheduled, outForDelivery, deliveredToday, flagged, prebooked] = await Promise.all([
      prisma.delivery.count({ where: { ...baseWhere, status: "PENDING" } }),
      prisma.delivery.count({ where: { ...baseWhere, status: "VERIFIED" } }),
      prisma.delivery.count({ where: { ...baseWhere, status: "SCHEDULED" } }),
      prisma.delivery.count({ where: { ...baseWhere, status: "OUT_FOR_DELIVERY" } }),
      prisma.delivery.count({ where: { ...baseWhere, status: "DELIVERED" } }),
      prisma.delivery.count({ where: { ...baseWhere, status: "FLAGGED" } }),
      prisma.delivery.count({ where: { ...baseWhere, status: "PREBOOKED" } }),
    ]);

    return successResponse({
      pending,
      verified,
      scheduled,
      outForDelivery,
      delivered: deliveredToday,
      deliveredToday: deliveredToday, // kept for backward compat
      flagged,
      prebooked,
      total: pending + verified + scheduled + outForDelivery + deliveredToday + flagged + prebooked,
    });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch stats", 500);
  }
}
