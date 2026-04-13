export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";

export async function GET() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalProducts,
      lowStockCount,
      todayInwards,
      todayOutwards,
      products,
    ] = await Promise.all([
      prisma.product.count({ where: { status: "ACTIVE" } }),
      prisma.product.count({
        where: {
          status: "ACTIVE",
          currentStock: { lte: prisma.product.fields.reorderLevel },
        },
      }),
      prisma.inventoryTransaction.aggregate({
        where: { type: "INWARD", createdAt: { gte: today } },
        _sum: { quantity: true },
        _count: true,
      }),
      prisma.inventoryTransaction.aggregate({
        where: { type: "OUTWARD", createdAt: { gte: today } },
        _sum: { quantity: true },
        _count: true,
      }),
      prisma.product.findMany({
        where: { status: "ACTIVE" },
        select: { currentStock: true, costPrice: true, categoryId: true },
      }),
    ]);

    const totalStockValue = products.reduce(
      (sum, p) => sum + p.currentStock * p.costPrice,
      0
    );

    const categoryBreakdown: Record<string, number> = {};
    for (const p of products) {
      categoryBreakdown[p.categoryId] =
        (categoryBreakdown[p.categoryId] || 0) + 1;
    }

    return successResponse({
      totalProducts,
      totalStockValue,
      lowStockCount,
      todayInwards: {
        count: todayInwards._count,
        quantity: todayInwards._sum.quantity || 0,
      },
      todayOutwards: {
        count: todayOutwards._count,
        quantity: todayOutwards._sum.quantity || 0,
      },
      categoryBreakdown,
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Failed to fetch summary",
      500
    );
  }
}
