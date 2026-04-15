export const revalidate = 120; // cache insights 2 minutes

import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";
import { formatINR } from "@/lib/ai-calculations";

export async function GET() {
  try {
    await requireAuth(["ADMIN", "SUPERVISOR", "PURCHASE_MANAGER", "ACCOUNTS_MANAGER"]);

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
    const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    // Use raw SQL aggregations instead of loading all 2765 products into memory
    const [
      stockMetrics,
      todaySales,
      yesterdaySales,
      topSellerWeek,
      deadStockCount,
    ] = await Promise.all([
      prisma.$queryRaw<[{ reorder_count: number; overstock_count: number; stock_value: number }]>`
        SELECT
          COUNT(*) FILTER (WHERE "reorderLevel" > 0 AND "currentStock" <= "reorderLevel")::int as reorder_count,
          COUNT(*) FILTER (WHERE "maxStock" > 0 AND "currentStock" > "maxStock")::int as overstock_count,
          COALESCE(SUM("currentStock" * "costPrice"), 0)::float as stock_value
        FROM "Product" WHERE status = 'ACTIVE'
      `,
      prisma.inventoryTransaction.aggregate({
        where: { type: "OUTWARD", createdAt: { gte: todayStart } },
        _sum: { quantity: true },
        _count: true,
      }),
      prisma.inventoryTransaction.aggregate({
        where: { type: "OUTWARD", createdAt: { gte: yesterdayStart, lt: todayStart } },
        _sum: { quantity: true },
        _count: true,
      }),
      prisma.inventoryTransaction.groupBy({
        by: ["productId"],
        where: { type: "OUTWARD", createdAt: { gte: weekStart } },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 1,
      }),
      // Count products with NO outward transactions in 90 days
      prisma.$queryRaw<[{ count: number }]>`
        SELECT COUNT(*)::int as count FROM "Product" p
        WHERE p.status = 'ACTIVE'
        AND NOT EXISTS (
          SELECT 1 FROM "InventoryTransaction" t
          WHERE t."productId" = p.id AND t.type = 'OUTWARD' AND t."createdAt" >= ${ninetyDaysAgo}
        )
      `,
    ]);

    const reorderNum = stockMetrics[0]?.reorder_count || 0;
    const overstockCount = stockMetrics[0]?.overstock_count || 0;
    const totalStockValue = stockMetrics[0]?.stock_value || 0;
    const deadStock = deadStockCount[0]?.count || 0;

    let topSellerName = "None this week";
    if (topSellerWeek.length > 0) {
      const topProduct = await prisma.product.findUnique({
        where: { id: topSellerWeek[0].productId },
        select: { name: true },
      });
      const qty = topSellerWeek[0]._sum.quantity || 0;
      topSellerName = `${topProduct?.name || "Unknown"} (${qty} sold)`;
    }

    const todayCount = todaySales._count || 0;
    const yesterdayCount = yesterdaySales._count || 0;

    const insights = [
      {
        type: "reorder",
        title: `${reorderNum} product${reorderNum !== 1 ? "s" : ""} need reorder`,
        severity: reorderNum > 5 ? "danger" : reorderNum > 0 ? "warning" : "success",
        value: reorderNum,
      },
      {
        type: "sales_today",
        title: `${todayCount} sale${todayCount !== 1 ? "s" : ""} today vs ${yesterdayCount} yesterday`,
        severity: todayCount >= yesterdayCount ? "success" : "warning",
        value: todayCount,
      },
      {
        type: "top_seller",
        title: `Top seller: ${topSellerName}`,
        severity: "info",
        value: topSellerWeek[0]?._sum.quantity || 0,
      },
      {
        type: "overstock",
        title: `${overstockCount} item${overstockCount !== 1 ? "s" : ""} above max stock`,
        severity: overstockCount > 0 ? "warning" : "success",
        value: overstockCount,
      },
      {
        type: "dead_stock",
        title: `${deadStock} product${deadStock !== 1 ? "s" : ""} with no sales in 90 days`,
        severity: deadStock > 10 ? "danger" : deadStock > 0 ? "warning" : "success",
        value: deadStock,
      },
      {
        type: "stock_value",
        title: `Total stock value: ${formatINR(totalStockValue)}`,
        severity: "info",
        value: totalStockValue,
      },
    ];

    return successResponse(insights);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to generate insights", 500);
  }
}
