export const revalidate = 60; // cache bin stock 1 minute

import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

export async function GET() {
  try {
    await requireAuth();

    const [bins, binStats] = await Promise.all([
      prisma.bin.findMany({
        where: { isActive: true },
        orderBy: { code: "asc" },
        select: {
          id: true,
          code: true,
          name: true,
          location: true,
          zone: true,
          _count: { select: { products: { where: { status: "ACTIVE" } } } },
        },
      }),
      prisma.$queryRaw<Array<{
        binId: string;
        total_stock: number;
        low_stock: number;
        out_of_stock: number;
        total_value: number;
      }>>`
        SELECT
          "binId",
          COALESCE(SUM("currentStock"), 0)::int as total_stock,
          COUNT(*) FILTER (WHERE "reorderLevel" > 0 AND "currentStock" <= "reorderLevel")::int as low_stock,
          COUNT(*) FILTER (WHERE "currentStock" <= 0)::int as out_of_stock,
          COALESCE(SUM("currentStock" * "sellingPrice"), 0)::float as total_value
        FROM "Product"
        WHERE status = 'ACTIVE' AND "binId" IS NOT NULL
        GROUP BY "binId"
      `,
    ]);

    const statsMap = new Map(binStats.map((s) => [s.binId, s]));

    const data = bins.map((b) => {
      const stats = statsMap.get(b.id);
      return {
        id: b.id,
        code: b.code,
        name: b.name,
        location: b.location,
        zone: b.zone,
        productCount: b._count.products,
        totalStock: stats?.total_stock || 0,
        lowStockCount: stats?.low_stock || 0,
        outOfStockCount: stats?.out_of_stock || 0,
        totalValue: stats?.total_value || 0,
      };
    });

    return successResponse(data);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(
      error instanceof Error ? error.message : "Failed to fetch bin stock",
      500
    );
  }
}
