export const revalidate = 60; // cache 1 minute

import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";
import { BIN_TRACKING_ENABLED } from "@/lib/inventory-config";

export async function GET() {
  try {
    await requireAuth();

    // ── Location mode (bins dormant): Store vs Warehouse summary ──
    if (!BIN_TRACKING_ENABLED) {
      const [grandRows, whRows] = await Promise.all([
        prisma.$queryRaw<Array<{ total_stock: number; total_value: number; in_stock: number; low_stock: number; out_of_stock: number }>>`
          SELECT
            COALESCE(SUM("currentStock"), 0)::int as total_stock,
            COALESCE(SUM("currentStock" * "sellingPrice"), 0)::float as total_value,
            COUNT(*) FILTER (WHERE "currentStock" > 0)::int as in_stock,
            COUNT(*) FILTER (WHERE "reorderLevel" > 0 AND "currentStock" <= "reorderLevel")::int as low_stock,
            COUNT(*) FILTER (WHERE "currentStock" <= 0)::int as out_of_stock
          FROM "Product" WHERE status = 'ACTIVE'
        `,
        // Warehouse quantity is clamped into [0, currentStock] so Store is never negative.
        prisma.$queryRaw<Array<{ total_stock: number; total_value: number; product_count: number }>>`
          SELECT
            COALESCE(SUM(GREATEST(0, LEAST(sl.quantity, GREATEST(p."currentStock", 0)))), 0)::int as total_stock,
            COALESCE(SUM(GREATEST(0, LEAST(sl.quantity, GREATEST(p."currentStock", 0))) * p."sellingPrice"), 0)::float as total_value,
            COUNT(*) FILTER (WHERE GREATEST(0, LEAST(sl.quantity, GREATEST(p."currentStock", 0))) > 0)::int as product_count
          FROM "StockLevel" sl
          JOIN "Product" p ON p.id = sl."productId"
          WHERE sl.location = 'WAREHOUSE' AND p.status = 'ACTIVE'
        `,
      ]);

      const grand = grandRows[0] || { total_stock: 0, total_value: 0, in_stock: 0, low_stock: 0, out_of_stock: 0 };
      const wh = whRows[0] || { total_stock: 0, total_value: 0, product_count: 0 };
      const storeStock = grand.total_stock - wh.total_stock;
      const storeValue = grand.total_value - wh.total_value;

      const data = [
        {
          key: "STORE",
          label: "Store",
          totalStock: storeStock,
          totalValue: storeValue,
          // Most products live only at the store; show the in-stock count here.
          productCount: grand.in_stock - wh.product_count,
          lowStockCount: grand.low_stock,
          outOfStockCount: grand.out_of_stock,
        },
        {
          key: "WAREHOUSE",
          label: "Warehouse",
          totalStock: wh.total_stock,
          totalValue: wh.total_value,
          productCount: wh.product_count,
          lowStockCount: 0,
          outOfStockCount: 0,
        },
      ];

      return successResponse({ mode: "location", locations: data });
    }

    // ── Bin mode (dormant) ──
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

    return successResponse({ mode: "bin", bins: data });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(
      error instanceof Error ? error.message : "Failed to fetch stock by location",
      500
    );
  }
}
