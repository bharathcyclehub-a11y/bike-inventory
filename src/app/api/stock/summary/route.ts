export const revalidate = 120; // cache stock summary 2 minutes

import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

export async function GET() {
  try {
    await requireAuth();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalProducts,
      todayInwards,
      todayOutwards,
      products,
    ] = await Promise.all([
      prisma.product.count({ where: { status: "ACTIVE" } }),
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
        select: { currentStock: true, costPrice: true, reorderLevel: true, categoryId: true },
      }),
    ]);

    // Filter low stock in JS (Prisma can't compare two fields)
    const lowStockCount = products.filter(
      (p) => p.reorderLevel > 0 && p.currentStock <= p.reorderLevel
    ).length;

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
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(
      error instanceof Error ? error.message : "Failed to fetch summary",
      500
    );
  }
}
