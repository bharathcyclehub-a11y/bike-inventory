export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

// POST: Approve or reject a transfer order
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(["ADMIN", "SUPERVISOR", "ACCOUNTS_MANAGER"]);
    const { id } = await params;
    const body = await req.json();
    const { action, rejectionNote } = body; // "approve" or "reject"

    if (!["approve", "reject"].includes(action)) {
      return errorResponse("Action must be 'approve' or 'reject'", 400);
    }

    const order = await prisma.transferOrder.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: { select: { id: true, currentStock: true, name: true } },
            fromBin: { select: { id: true, code: true } },
            toBin: { select: { id: true, code: true } },
          },
        },
      },
    });

    if (!order) return errorResponse("Transfer order not found", 404);
    if (order.status !== "PENDING") return errorResponse("Order is not pending", 400);

    if (action === "approve") {
      // Verify stock is still available
      for (const item of order.items) {
        if (item.product.currentStock < item.quantity) {
          return errorResponse(
            `Insufficient stock for ${item.product.name}. Available: ${item.product.currentStock}, Requested: ${item.quantity}`,
            400
          );
        }
      }

      await prisma.$transaction(async (tx) => {
        // Update order status
        await tx.transferOrder.update({
          where: { id },
          data: { status: "APPROVED", reviewedById: user.id, reviewedAt: new Date() },
        });

        // Execute each item transfer
        for (const item of order.items) {
          // Update product bin
          await tx.product.update({
            where: { id: item.productId },
            data: { binId: item.toBinId },
          });

          // Move serial items
          await tx.serialItem.updateMany({
            where: { productId: item.productId, binId: item.fromBinId, status: "IN_STOCK" },
            data: { binId: item.toBinId },
          });

          // Create inventory transaction
          await tx.inventoryTransaction.create({
            data: {
              type: "TRANSFER",
              productId: item.productId,
              quantity: item.quantity,
              previousStock: item.product.currentStock,
              newStock: item.product.currentStock,
              referenceNo: order.orderNo,
              notes: `[APPROVED] From: ${item.fromBin.code} → To: ${item.toBin.code} | Transfer Order: ${order.orderNo}`,
              userId: user.id,
            },
          });
        }
      });

      return successResponse({ message: "Transfer order approved", status: "APPROVED" });
    } else {
      // Reject
      await prisma.transferOrder.update({
        where: { id },
        data: {
          status: "REJECTED",
          reviewedById: user.id,
          reviewedAt: new Date(),
          rejectionNote: rejectionNote || null,
        },
      });

      return successResponse({ message: "Transfer order rejected", status: "REJECTED" });
    }
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to process transfer order", 400);
  }
}
