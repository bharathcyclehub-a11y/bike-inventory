export const revalidate = 120; // cache 2 min

import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

interface PersonStats {
  name: string;
  role: string;
  pending: number;
  overdue24h: number;
  overdue48h: number;
  overdue72h: number;
}

interface CriticalAlert {
  type: string;
  message: string;
  owner: string;
  count: number;
}

export async function GET() {
  try {
    await requireAuth(["ADMIN"]);

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const h48 = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const h72 = new Date(now.getTime() - 72 * 60 * 60 * 1000);

    // All queries in a single Promise.all for max efficiency
    const [
      // Nithin — unverified inwards
      nithinStats,
      // Ranjitha — pending deliveries
      ranjithaStats,
      // Abhi Gowda — POs awaiting tracking
      abhiStats,
      // Sravan — expenses today
      sravanExpensesToday,
      // Today's summary
      inwardsVerified,
      inwardsPending,
      deliveriesClosed,
      deliveriesPending,
      expensesRecorded,
      posWithoutTracking,
    ] = await Promise.all([
      // --- Nithin: unverified inwards with age buckets ---
      prisma.$queryRaw<[{ pending: number; overdue24h: number; overdue48h: number; overdue72h: number }]>`
        SELECT
          COUNT(*)::int AS pending,
          COUNT(*) FILTER (WHERE "createdAt" < ${h24})::int AS "overdue24h",
          COUNT(*) FILTER (WHERE "createdAt" < ${h48})::int AS "overdue48h",
          COUNT(*) FILTER (WHERE "createdAt" < ${h72})::int AS "overdue72h"
        FROM "InventoryTransaction"
        WHERE type = 'INWARD' AND notes LIKE '%[UNVERIFIED]%'
      `,

      // --- Ranjitha: pending deliveries with age buckets ---
      prisma.$queryRaw<[{ pending: number; overdue24h: number; overdue48h: number; overdue72h: number }]>`
        SELECT
          COUNT(*)::int AS pending,
          COUNT(*) FILTER (WHERE "invoiceDate" < ${h24})::int AS "overdue24h",
          COUNT(*) FILTER (WHERE "invoiceDate" < ${h48})::int AS "overdue48h",
          COUNT(*) FILTER (WHERE "invoiceDate" < ${h72})::int AS "overdue72h"
        FROM "Delivery"
        WHERE status IN ('PENDING', 'VERIFIED', 'SCHEDULED')
      `,

      // --- Abhi Gowda: POs awaiting tracking (uses 48h threshold) ---
      prisma.$queryRaw<[{ pending: number; overdue48h: number; overdue72h: number }]>`
        SELECT
          COUNT(*)::int AS pending,
          COUNT(*) FILTER (WHERE "orderDate" < ${h48})::int AS "overdue48h",
          COUNT(*) FILTER (WHERE "orderDate" < ${h72})::int AS "overdue72h"
        FROM "PurchaseOrder"
        WHERE status IN ('SENT_TO_VENDOR', 'PARTIALLY_RECEIVED')
      `,

      // --- Sravan: expenses recorded today ---
      prisma.expense.count({
        where: { date: { gte: todayStart } },
      }),

      // --- Today's summary queries ---
      // Verified inwards today (INWARD type, created today, notes NOT containing [UNVERIFIED])
      prisma.$queryRaw<[{ count: number }]>`
        SELECT COUNT(*)::int AS count
        FROM "InventoryTransaction"
        WHERE type = 'INWARD'
          AND "createdAt" >= ${todayStart}
          AND (notes IS NULL OR notes NOT LIKE '%[UNVERIFIED]%')
      `,

      // Pending inwards (unverified, any date)
      prisma.$queryRaw<[{ count: number }]>`
        SELECT COUNT(*)::int AS count
        FROM "InventoryTransaction"
        WHERE type = 'INWARD' AND notes LIKE '%[UNVERIFIED]%'
      `,

      // Deliveries closed today
      prisma.delivery.count({
        where: { status: "DELIVERED", deliveredAt: { gte: todayStart } },
      }),

      // Deliveries pending
      prisma.delivery.count({
        where: { status: { in: ["PENDING", "VERIFIED", "SCHEDULED"] } },
      }),

      // Expenses recorded today
      prisma.expense.count({
        where: { date: { gte: todayStart } },
      }),

      // POs without tracking (sent > 48h ago)
      prisma.$queryRaw<[{ count: number }]>`
        SELECT COUNT(*)::int AS count
        FROM "PurchaseOrder"
        WHERE status = 'SENT_TO_VENDOR' AND "orderDate" < ${h48}
      `,

    ]);

    const nithin = nithinStats[0];
    const ranjitha = ranjithaStats[0];
    const abhi = abhiStats[0];

    // Build people array
    const people: PersonStats[] = [
      {
        name: "Nithin",
        role: "Inventory & Receiving Lead",
        pending: nithin.pending,
        overdue24h: nithin.overdue24h,
        overdue48h: nithin.overdue48h,
        overdue72h: nithin.overdue72h,
      },
      {
        name: "Ranjitha",
        role: "Sales & Dispatch Lead",
        pending: ranjitha.pending,
        overdue24h: ranjitha.overdue24h,
        overdue48h: ranjitha.overdue48h,
        overdue72h: ranjitha.overdue72h,
      },
      {
        name: "Abhi Gowda",
        role: "Purchase Manager",
        pending: abhi.pending,
        overdue24h: 0, // POs use 48h threshold, not 24h
        overdue48h: abhi.overdue48h,
        overdue72h: abhi.overdue72h,
      },
      {
        name: "Sravan",
        role: "Accounts Manager",
        pending: sravanExpensesToday,
        overdue24h: 0,
        overdue48h: 0,
        overdue72h: 0,
      },
    ];

    // Build today summary
    const today = {
      inwardsVerified: inwardsVerified[0]?.count || 0,
      inwardsPending: inwardsPending[0]?.count || 0,
      deliveriesClosed,
      deliveriesPending,
      expensesRecorded,
      posWithoutTracking: posWithoutTracking[0]?.count || 0,
    };

    // Build critical alerts (items > 72h needing Syed's attention)
    const criticalAlerts: CriticalAlert[] = [];

    if (nithin.overdue72h > 0) {
      criticalAlerts.push({
        type: "inward",
        message: `${nithin.overdue72h} inwards unverified for 72+ hours`,
        owner: "Nithin",
        count: nithin.overdue72h,
      });
    }

    if (ranjitha.overdue72h > 0) {
      criticalAlerts.push({
        type: "delivery",
        message: `${ranjitha.overdue72h} delivery pending for 72+ hours`,
        owner: "Ranjitha",
        count: ranjitha.overdue72h,
      });
    }

    if (abhi.overdue72h > 0) {
      criticalAlerts.push({
        type: "purchase_order",
        message: `${abhi.overdue72h} PO without tracking for 72+ hours`,
        owner: "Abhi Gowda",
        count: abhi.overdue72h,
      });
    }

    return successResponse({ people, today, criticalAlerts });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(
      error instanceof Error ? error.message : "Failed to fetch health summary",
      500
    );
  }
}
