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

    const [
      reorderCount,
      todaySales,
      yesterdaySales,
      topSellerWeek,
      overstockProducts,
      allProducts,
      deadStockTxns,
    ] = await Promise.all([
      // 1. Products needing reorder (fetched as array, counted in JS — Prisma can't compare fields)
      prisma.product.findMany({
        where: { status: "ACTIVE" },
        select: { currentStock: true, reorderLevel: true },
      }),
      // 2. Today's outward transactions
      prisma.inventoryTransaction.aggregate({
        where: { type: "OUTWARD", createdAt: { gte: todayStart } },
        _sum: { quantity: true },
        _count: true,
      }),
      // 3. Yesterday's outward transactions
      prisma.inventoryTransaction.aggregate({
        where: { type: "OUTWARD", createdAt: { gte: yesterdayStart, lt: todayStart } },
        _sum: { quantity: true },
        _count: true,
      }),
      // 4. Top seller this week
      prisma.inventoryTransaction.groupBy({
        by: ["productId"],
        where: { type: "OUTWARD", createdAt: { gte: weekStart } },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 1,
      }),
      // 5. Overstock count
      prisma.product.findMany({
        where: { status: "ACTIVE", maxStock: { gt: 0 } },
        select: { currentStock: true, maxStock: true },
      }),
      // 6. All active products for stock value
      prisma.product.findMany({
        where: { status: "ACTIVE" },
        select: { id: true, currentStock: true, costPrice: true },
      }),
      // 7. Products with sales in last 90 days (to find dead stock)
      prisma.inventoryTransaction.groupBy({
        by: ["productId"],
        where: { type: "OUTWARD", createdAt: { gte: ninetyDaysAgo } },
        _sum: { quantity: true },
      }),
    ]);

    // Calculate overstock
    const overstockCount = overstockProducts.filter((p) => p.currentStock > p.maxStock).length;

    // Calculate dead stock
    const productsWithSales = new Set(deadStockTxns.map((t) => t.productId));
    const deadStockCount = allProducts.filter((p) => !productsWithSales.has(p.id)).length;

    // Calculate total stock value
    const totalStockValue = allProducts.reduce((sum, p) => sum + (p.currentStock * p.costPrice), 0);

    // Get top seller product name
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

    // Filter in JS since Prisma can't compare two columns
    const reorderNum = reorderCount.filter((p) => p.currentStock <= p.reorderLevel).length;

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
