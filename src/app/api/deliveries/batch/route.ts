export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

export async function PUT(req: NextRequest) {
  try {
    const user = await requireAuth(["ADMIN", "OUTWARDS_CLERK"]);
    const body = await req.json();
    const { deliveryIds, action } = body as { deliveryIds: string[]; action: string };

    if (!deliveryIds || deliveryIds.length === 0) {
      return errorResponse("No deliveries selected", 400);
    }

    if (!["OUT_FOR_DELIVERY", "DELIVERED"].includes(action)) {
      return errorResponse("Invalid action", 400);
    }

    const expectedStatus = action === "OUT_FOR_DELIVERY" ? "SCHEDULED" : "OUT_FOR_DELIVERY";
    const deliveries = await prisma.delivery.findMany({
      where: { id: { in: deliveryIds }, status: expectedStatus },
    });

    if (deliveries.length === 0) {
      return errorResponse(`No deliveries in ${expectedStatus} status`, 400);
    }

    const result = await prisma.$transaction(async (tx) => {
      let updated = 0;

      for (const delivery of deliveries) {
        const updateData: Record<string, unknown> = { status: action };

        if (action === "OUT_FOR_DELIVERY") {
          updateData.dispatchedAt = new Date();
        }

        if (action === "DELIVERED") {
          updateData.deliveredAt = new Date();

          // Idempotency: skip if already deducted
          const alreadyDeducted = await tx.inventoryTransaction.findFirst({
            where: { referenceNo: delivery.invoiceNo, type: "OUTWARD" },
          });
          if (alreadyDeducted) {
            await tx.delivery.update({ where: { id: delivery.id }, data: updateData });
            updated++;
            continue;
          }

          // Stock deduction — prefer BCH location
          const items = (delivery.lineItems as Array<{ name: string; sku: string; quantity: number; rate: number }>) || [];
          for (const item of items) {
            if (!item.sku) continue;
            const product = await tx.product.findFirst({
              where: { sku: item.sku, bin: { location: { startsWith: "Bharath Cycle Hub" } } },
              select: { id: true, currentStock: true },
            }) || await tx.product.findFirst({
              where: { sku: item.sku },
              select: { id: true, currentStock: true },
            });
            if (!product) continue;

            const newStock = product.currentStock - item.quantity;
            await tx.product.update({
              where: { id: product.id },
              data: { currentStock: newStock },
            });
            await tx.inventoryTransaction.create({
              data: {
                type: "OUTWARD",
                productId: product.id,
                quantity: item.quantity,
                previousStock: product.currentStock,
                newStock,
                referenceNo: delivery.invoiceNo,
                notes: `[ZOHO][VERIFIED] Customer: ${delivery.customerName} | Invoice: ${delivery.invoiceNo} | ${item.name} x${item.quantity}`,
                userId: user.id,
              },
            });
          }
        }

        await tx.delivery.update({ where: { id: delivery.id }, data: updateData });
        updated++;
      }

      return { updated };
    });

    return successResponse(result);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to batch update", 400);
  }
}
