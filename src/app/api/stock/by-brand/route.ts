export const revalidate = 60; // cache brand stock 1 minute

import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

export async function GET() {
  try {
    await requireAuth();

    // Fetch brand summaries using groupBy — no need to load all 2765 products
    const [brands, brandStats] = await Promise.all([
      prisma.brand.findMany({
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          contactPhone: true,
          whatsappNumber: true,
          _count: { select: { products: { where: { status: "ACTIVE" } } } },
        },
      }),
      // Aggregate stock metrics per brand in a single query
      prisma.$queryRaw<Array<{
        brandId: string;
        total_stock: number;
        low_stock: number;
        out_of_stock: number;
        total_value: number;
      }>>`
        SELECT
          "brandId",
          COALESCE(SUM("currentStock"), 0)::int as total_stock,
          COUNT(*) FILTER (WHERE "reorderLevel" > 0 AND "currentStock" <= "reorderLevel")::int as low_stock,
          COUNT(*) FILTER (WHERE "currentStock" <= 0)::int as out_of_stock,
          COALESCE(SUM("currentStock" * "sellingPrice"), 0)::float as total_value
        FROM "Product"
        WHERE status = 'ACTIVE' AND "brandId" IS NOT NULL
        GROUP BY "brandId"
      `,
    ]);

    const statsMap = new Map(brandStats.map((s) => [s.brandId, s]));

    const data = brands
      .filter((b) => b._count.products > 0)
      .map((b) => {
        const stats = statsMap.get(b.id);
        return {
          id: b.id,
          name: b.name,
          contactPhone: b.contactPhone,
          whatsappNumber: b.whatsappNumber,
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
      error instanceof Error ? error.message : "Failed to fetch brand stock",
      500
    );
  }
}
