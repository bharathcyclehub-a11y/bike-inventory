export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse, paginatedResponse, parseSearchParams } from "@/lib/api-utils";
import { stockCountSchema } from "@/lib/validations";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  try {
    await requireAuth(["ADMIN", "SUPERVISOR", "MANAGER", "INWARDS_CLERK", "OUTWARDS_CLERK"]);
    const { page, limit, skip, searchParams } = parseSearchParams(req.url);
    const status = searchParams.get("status") || undefined;

    const where = {
      ...(status && { status }),
    };

    const [counts, total] = await Promise.all([
      prisma.stockCount.findMany({
        where,
        include: {
          assignedTo: { select: { name: true } },
          _count: { select: { items: true } },
          items: { select: { countedQty: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.stockCount.count({ where }),
    ]);

    const data = counts.map((c) => {
      const countedItems = c.items.filter((i) => i.countedQty !== null).length;
      return {
        id: c.id,
        title: c.title,
        assignedTo: c.assignedTo,
        status: c.status,
        dueDate: c.dueDate,
        completedAt: c.completedAt,
        notes: c.notes,
        createdAt: c.createdAt,
        totalItems: c._count.items,
        countedItems,
      };
    });

    return paginatedResponse(data, total, page, limit);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch stock counts", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(["ADMIN", "SUPERVISOR", "MANAGER", "INWARDS_CLERK", "OUTWARDS_CLERK"]);
    const body = await req.json();
    const data = stockCountSchema.parse(body);

    let productIds = data.productIds;
    if (!productIds || productIds.length === 0) {
      // If binId provided, only include products in that bin
      const binId = body.binId as string | undefined;
      const allProducts = await prisma.product.findMany({
        where: {
          status: "ACTIVE",
          ...(binId && { binId }),
        },
        select: { id: true },
      });
      productIds = allProducts.map((p) => p.id);
    }

    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, currentStock: true },
    });

    const stockCount = await prisma.stockCount.create({
      data: {
        title: data.title,
        assignedToId: data.assignedToId || user.id,
        dueDate: new Date(data.dueDate),
        notes: data.notes,
        items: {
          create: products.map((p) => ({
            productId: p.id,
            systemQty: p.currentStock,
          })),
        },
      },
      include: {
        assignedTo: { select: { name: true } },
        _count: { select: { items: true } },
      },
    });

    return successResponse(stockCount, 201);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to create stock count", 400);
  }
}
