export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

export async function GET() {
  try {
    await requireAuth(["ADMIN", "CEO", "SUPERVISOR", "OUTWARDS_EXECUTIVE", "STORE_MANAGER", "SALES_MANAGER"]);

    // Exclude SERVICE invoices to match the list API behavior
    // NOTE: Must use OR with null check — Prisma's NOT filter excludes NULL rows in PostgreSQL
    const baseWhere = { OR: [{ invoiceType: null as string | null }, { invoiceType: { not: "SERVICE" } }] };

    // For "Delivered" count, match the list API behavior:
    // only count this month's delivered (list auto-hides older ones)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [pending, verified, scheduled, outForDelivery, deliveredThisMonth, flagged, prebooked, packed, shipped, inTransit, walkOut] = await Promise.all([
      prisma.delivery.count({ where: { ...baseWhere, status: "PENDING" } }),
      prisma.delivery.count({ where: { ...baseWhere, status: "VERIFIED" } }),
      prisma.delivery.count({ where: { ...baseWhere, status: "SCHEDULED" } }),
      prisma.delivery.count({ where: { ...baseWhere, status: "OUT_FOR_DELIVERY" } }),
      prisma.delivery.count({ where: { ...baseWhere, status: "DELIVERED", deliveredAt: { gte: startOfMonth } } }),
      prisma.delivery.count({ where: { ...baseWhere, status: "FLAGGED" } }),
      prisma.delivery.count({ where: { ...baseWhere, status: "PREBOOKED" } }),
      prisma.delivery.count({ where: { ...baseWhere, status: "PACKED" } }),
      prisma.delivery.count({ where: { ...baseWhere, status: "SHIPPED" } }),
      prisma.delivery.count({ where: { ...baseWhere, status: "IN_TRANSIT" } }),
      prisma.delivery.count({ where: { ...baseWhere, status: "WALK_OUT" } }),
    ]);

    return successResponse({
      pending,
      verified,
      scheduled,
      outForDelivery,
      delivered: deliveredThisMonth,
      deliveredToday: deliveredThisMonth,
      flagged,
      prebooked,
      packed,
      shipped,
      inTransit,
      walkOut,
      total: pending + verified + scheduled + outForDelivery + deliveredThisMonth + flagged + prebooked,
    });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch stats", 500);
  }
}
