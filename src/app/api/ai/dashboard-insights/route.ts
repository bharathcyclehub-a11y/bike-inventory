export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";
import { formatINR } from "@/lib/ai-calculations";

export async function GET() {
  try {
    await requireAuth(["ADMIN", "SUPERVISOR", "MANAGER"]);

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
    const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    // Single product query instead of 3 separate ones (PERF: saves 2 DB round-trips)
    const [
      allProducts,
      todaySales,
      yesterdaySales,
      topSellerWeek,
      deadStockTxns,
    ] = await Promise.all([
      prisma.product.findMany({
        where: { status: "ACTIVE" },
        select: { id: true, currentStock: true, costPrice: true, reorderLevel: true, maxStock: true },
      }),
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
      prisma.inventoryTransaction.groupBy({
        by: ["productId"],
        where: { type: "OUTWARD", createdAt: { gte: ninetyDaysAgo } },
        _sum: { quantity: true },
      }),
    ]);

    // Derive all metrics from single product array
    const reorderNum = allProducts.filter((p) => p.currentStock <= p.reorderLevel).length;
    const overstockCount = allProducts.filter((p) => p.maxStock > 0 && p.currentStock > p.maxStock).length;
    const totalStockValue = allProducts.reduce((sum, p) => sum + (p.currentStock * p.costPrice), 0);
    const productsWithSales = new Set(deadStockTxns.map((t) => t.productId));
    const deadStockCount = allProducts.filter((p) => !productsWithSales.has(p.id)).length;

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
        title: `${deadStockCount} product${deadStockCount !== 1 ? "s" : ""} with no sales in 90 days`,
        severity: deadStockCount > 10 ? "danger" : deadStockCount > 0 ? "warning" : "success",
        value: deadStockCount,
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
