export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse, paginatedResponse, parseSearchParams } from "@/lib/api-utils";
import { inwardSchema } from "@/lib/validations";
import { requireAuth, AuthError } from "@/lib/auth-helpers";
import { generateSerialCode, getNextSerialSequence } from "@/lib/barcode";

export async function GET(req: NextRequest) {
  try {
    await requireAuth(["ADMIN", "SUPERVISOR", "MANAGER", "INWARDS_CLERK"]);
    const { page, limit, skip, searchParams } = parseSearchParams(req.url);
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    const where = {
      type: "INWARD" as const,
      ...((dateFrom || dateTo) && {
        createdAt: {
          ...(dateFrom && { gte: new Date(dateFrom) }),
          ...(dateTo && { lte: new Date(dateTo) }),
        },
      }),
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
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch inwards", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(["ADMIN", "MANAGER", "SUPERVISOR", "INWARDS_CLERK"]);
    const body = await req.json();
    const data = inwardSchema.parse(body);

    const result = await prisma.$transaction(async (tx) => {
      // Read product inside transaction to prevent race conditions
      const product = await tx.product.findUnique({
        where: { id: data.productId },
      });

      if (!product) throw new Error("Product not found");

      const previousStock = product.currentStock;
      const newStock = previousStock + data.quantity;

      // Update product stock and bin location if provided
      await tx.product.update({
        where: { id: data.productId },
        data: {
          currentStock: newStock,
          ...(body.binId && { binId: body.binId }),
        },
      });

      // Create transaction record
      const transaction = await tx.inventoryTransaction.create({
        data: {
          type: "INWARD",
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

      // Create serial items if serial tracking is enabled
      if (body.serialTracking) {
        const existingSerials = await tx.serialItem.findMany({
          where: { productId: data.productId },
          select: { serialCode: true },
        });

        const startSeq = getNextSerialSequence(
          existingSerials.map((s) => s.serialCode),
          product.sku
        );

        const serialItems = [];
        for (let i = 0; i < data.quantity; i++) {
          serialItems.push({
            serialCode: generateSerialCode(product.sku, startSeq + i),
            productId: data.productId,
            batchNo: data.referenceNo,
            invoiceNo: data.referenceNo,
            barcodeData: generateSerialCode(product.sku, startSeq + i),
            binId: body.binId || null,
          });
        }

        await tx.serialItem.createMany({ data: serialItems });
      }

      return transaction;
    });

    return successResponse(result, 201);
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse(error.message, error.status);
    }
    return errorResponse(error instanceof Error ? error.message : "Failed to record inward", 400);
  }
}
