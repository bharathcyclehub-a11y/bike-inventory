export const revalidate = 60; // cache brand stock 1 minute

import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

export async function GET() {
  try {
    const user = await requireAuth();
    const isAdmin = user.role === "ADMIN";

    const brands = await prisma.brand.findMany({
      orderBy: { name: "asc" },
      include: {
        products: {
          where: { status: "ACTIVE" },
          select: {
            id: true,
            name: true,
            sku: true,
            type: true,
            currentStock: true,
            reorderLevel: true,
            sellingPrice: true,
            costPrice: isAdmin,
            mrp: true,
            category: { select: { name: true } },
            bin: { select: { code: true, name: true, location: true } },
          },
          orderBy: { name: "asc" },
        },
      },
    });

    const data = brands
      .filter((b) => b.products.length > 0)
      .map((b) => {
        const totalStock = b.products.reduce((s, p) => s + p.currentStock, 0);
        const lowStockCount = b.products.filter(
          (p) => p.reorderLevel > 0 && p.currentStock <= p.reorderLevel
        ).length;
        const outOfStockCount = b.products.filter((p) => p.currentStock <= 0).length;
        const totalValue = b.products.reduce(
          (s, p) => s + p.currentStock * p.sellingPrice,
          0
        );

        return {
          id: b.id,
          name: b.name,
          contactPhone: b.contactPhone,
          whatsappNumber: b.whatsappNumber,
          productCount: b.products.length,
          totalStock,
          lowStockCount,
          outOfStockCount,
          totalValue,
          products: b.products,
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
