export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(["ADMIN", "SUPERVISOR", "MANAGER"]);
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const filter = searchParams.get("filter") || "all";

    const items = await prisma.stockCountItem.findMany({
      where: {
        stockCountId: id,
        ...(filter === "counted" && { countedQty: { not: null } }),
        ...(filter === "uncounted" && { countedQty: null }),
        ...(filter === "variance" && { variance: { not: null }, AND: { variance: { not: 0 } } }),
      },
      include: {
        product: {
          select: {
            name: true, sku: true, currentStock: true, type: true,
            category: { select: { name: true } },
            bin: { select: { code: true, location: true } },
          },
        },
      },
      orderBy: { product: { name: "asc" } },
    });

    return successResponse(items);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch items", 500);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(["ADMIN", "SUPERVISOR", "MANAGER"]);
    const { id } = await params;
    const body = await req.json();

    if (!body.items || !Array.isArray(body.items)) {
      return errorResponse("Items array is required", 400);
    }

    const results = await prisma.$transaction(async (tx) => {
      const updated = [];
      for (const item of body.items) {
        if (!item.id || item.countedQty === undefined) continue;

        const existing = await tx.stockCountItem.findUnique({
          where: { id: item.id },
        });
        if (!existing || existing.stockCountId !== id) continue;

        const result = await tx.stockCountItem.update({
          where: { id: item.id },
          data: {
            countedQty: item.countedQty,
            variance: item.countedQty - existing.systemQty,
            notes: item.notes ?? existing.notes,
            countedAt: new Date(),
          },
        });
        updated.push(result);
      }
      return updated;
    });

    return successResponse({ updated: results.length });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to update items", 400);
  }
}
