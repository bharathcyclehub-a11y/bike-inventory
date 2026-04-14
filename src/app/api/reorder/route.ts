export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  try {
    await requireAuth(["ADMIN", "MANAGER"]);
    const { searchParams } = new URL(req.url);
    const groupBy = searchParams.get("groupBy") || "brand"; // brand | category
    const filter = searchParams.get("filter") || "all"; // all | low | zero
    const brandId = searchParams.get("brandId") || undefined;
    const categoryId = searchParams.get("categoryId") || undefined;
    const search = searchParams.get("search") || "";

    const where = {
      status: "ACTIVE" as const,
      ...(brandId && { brandId }),
      ...(categoryId && { categoryId }),
      ...(filter === "zero" && { currentStock: 0 }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { sku: { contains: search, mode: "insensitive" as const } },
        ],
      }),
    };

    let products = await prisma.product.findMany({
      where,
      select: {
        id: true, sku: true, name: true, type: true,
        currentStock: true, reorderLevel: true, reorderQty: true,
        costPrice: true,
        category: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
      },
      orderBy: groupBy === "brand"
        ? [{ brand: { name: "asc" } }, { name: "asc" }]
        : [{ category: { name: "asc" } }, { name: "asc" }],
      take: 500,
    });

    // For "low" filter: currentStock <= reorderLevel (can't compare two fields in Prisma)
    if (filter === "low") {
      products = products.filter((p) => p.reorderLevel > 0 && p.currentStock <= p.reorderLevel);
    }

    // Group products
    const groups: Record<string, { id: string; name: string; products: typeof products }> = {};
    for (const p of products) {
      const key = groupBy === "brand" ? p.brand.id : p.category.id;
      const name = groupBy === "brand" ? p.brand.name : p.category.name;
      if (!groups[key]) groups[key] = { id: key, name, products: [] };
      groups[key].products.push(p);
    }

    const data = Object.values(groups).sort((a, b) => a.name.localeCompare(b.name));

    // Summary counts
    const totalProducts = products.length;
    const lowStockCount = products.filter((p) => p.reorderLevel > 0 && p.currentStock <= p.reorderLevel).length;
    const zeroStockCount = products.filter((p) => p.currentStock === 0).length;

    return successResponse({
      groups: data,
      summary: { totalProducts, lowStockCount, zeroStockCount },
    });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch reorder data", 500);
  }
}
