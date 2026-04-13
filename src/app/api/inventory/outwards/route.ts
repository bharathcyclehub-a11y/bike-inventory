export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse, paginatedResponse, parseSearchParams } from "@/lib/api-utils";
import { outwardSchema } from "@/lib/validations";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  try {
    const { page, limit, skip, searchParams } = parseSearchParams(req.url);
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    const where = {
      type: "OUTWARD" as const,
      ...(dateFrom && { createdAt: { gte: new Date(dateFrom) } }),
      ...(dateTo && { createdAt: { lte: new Date(dateTo) } }),
    };

    const [transactions, total] = await Promise.all([
      prisma.inventoryTransaction.findMany({
        where,
        include: {
          product: { select: { name: true, sku: true } },
          user: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.inventoryTransaction.count({ where }),
    ]);

    return paginatedResponse(transactions, total, page, limit);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch outwards", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(["ADMIN", "MANAGER", "SUPERVISOR", "OUTWARDS_CLERK"]);
    const body = await req.json();
    const data = outwardSchema.parse(body);

    const product = await prisma.product.findUnique({
      where: { id: data.productId },
    });

    if (!product) {
      return errorResponse("Product not found", 404);
    }

    if (product.currentStock < data.quantity) {
      return errorResponse(
        `Insufficient stock. Available: ${product.currentStock}, Requested: ${data.quantity}`,
        400
      );
    }

    const previousStock = product.currentStock;
    const newStock = previousStock - data.quantity;

    const result = await prisma.$transaction(async (tx) => {
      // Update product stock
      await tx.product.update({
        where: { id: data.productId },
        data: { currentStock: newStock },
      });

      // Create transaction record
      const transaction = await tx.inventoryTransaction.create({
        data: {
          type: "OUTWARD",
          productId: data.productId,
          quantity: data.quantity,
          previousStock,
          newStock,
          referenceNo: data.referenceNo,
          notes: data.notes,
          userId: user.id,
        },
        include: {
          product: { select: { name: true, sku: true } },
        },
      });

      // Update serial items if specific serials selected
      if (body.serialCodes && body.serialCodes.length > 0) {
        await tx.serialItem.updateMany({
          where: {
            serialCode: { in: body.serialCodes },
            productId: data.productId,
            status: "IN_STOCK",
          },
          data: {
            status: "SOLD",
            soldAt: new Date(),
            customerName: body.customerName || null,
            saleInvoiceNo: data.referenceNo || null,
          },
        });
      }

      return transaction;
    });

    return successResponse(result, 201);
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse(error.message, error.status);
    }
    return errorResponse(error instanceof Error ? error.message : "Failed to record outward", 400);
  }
}
