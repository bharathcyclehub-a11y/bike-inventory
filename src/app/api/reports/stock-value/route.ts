export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  try {
    await requireAuth(["ADMIN", "SUPERVISOR", "MANAGER"]);
    const { searchParams } = new URL(req.url);
    const groupBy = searchParams.get("groupBy") || "category";

    const products = await prisma.product.findMany({
      where: { status: "ACTIVE" },
      include: { category: true, brand: true },
    });

    let totalItems = 0;
    let totalCostValue = 0;
    let totalSellingValue = 0;
    let totalMrpValue = 0;

    const groups = new Map<string, { name: string; count: number; qty: number; costValue: number; sellingValue: number; mrpValue: number }>();

    for (const p of products) {
      totalItems += p.currentStock;
      totalCostValue += p.currentStock * p.costPrice;
      totalSellingValue += p.currentStock * p.sellingPrice;
      totalMrpValue += p.currentStock * p.mrp;

      let key: string;
      let name: string;
      if (groupBy === "brand") {
        key = p.brandId;
        name = p.brand?.name || "Unknown";
      } else if (groupBy === "type") {
        key = p.type;
        name = p.type.replace(/_/g, " ");
      } else {
        key = p.categoryId;
        name = p.category?.name || "Unknown";
      }

      const existing = groups.get(key) || { name, count: 0, qty: 0, costValue: 0, sellingValue: 0, mrpValue: 0 };
      existing.count += 1;
      existing.qty += p.currentStock;
      existing.costValue += p.currentStock * p.costPrice;
      existing.sellingValue += p.currentStock * p.sellingPrice;
      existing.mrpValue += p.currentStock * p.mrp;
      groups.set(key, existing);
    }

    const breakdown = Array.from(groups.values()).sort((a, b) => b.costValue - a.costValue);

    return successResponse({
      totalItems,
      totalProducts: products.length,
      totalCostValue,
      totalSellingValue,
      totalMrpValue,
      breakdown,
    });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch stock value", 500);
  }
}
