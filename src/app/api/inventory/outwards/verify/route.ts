export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

// POST: Verify a Zoho-pulled outward transaction
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(["ADMIN", "SUPERVISOR", "PURCHASE_MANAGER", "ACCOUNTS_MANAGER", "OUTWARDS_CLERK"]);
    const body = await req.json();
    const { transactionId } = body;

    if (!transactionId) return errorResponse("Transaction ID required", 400);

    const transaction = await prisma.inventoryTransaction.findUnique({
      where: { id: transactionId },
      include: { product: true },
    });

    if (!transaction) return errorResponse("Transaction not found", 404);
    if (transaction.type !== "OUTWARD") return errorResponse("Not an outward transaction", 400);
    if (!transaction.notes?.includes("[ZOHO]")) return errorResponse("Not a Zoho transaction", 400);
    if (transaction.notes?.includes("[VERIFIED]")) return errorResponse("Already verified", 400);

    // Deduct stock inside transaction to prevent race condition
    await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUniqueOrThrow({
        where: { id: transaction.productId },
      });

      if (product.currentStock < transaction.quantity) {
        throw new Error("Insufficient stock for verification");
      }

      const newStock = product.currentStock - transaction.quantity;

      await tx.product.update({
        where: { id: product.id },
        data: { currentStock: newStock },
      });

      await tx.inventoryTransaction.update({
        where: { id: transactionId },
        data: {
          previousStock: product.currentStock,
          newStock,
          notes: transaction.notes!
            .replace("[UNVERIFIED]", "[VERIFIED]")
            + ` | Verified by: ${user.name} at ${new Date().toISOString()}`,
        },
      });

      // Mark serial items as SOLD if serials are in the notes
      const serialMatch = transaction.notes?.match(/Serials: (.+?)(?:\s*\||$)/);
      if (serialMatch) {
        const serials = serialMatch[1].split(",").map((s) => s.trim());
        await tx.serialItem.updateMany({
          where: {
            productId: product.id,
            serialCode: { in: serials },
            status: "IN_STOCK",
          },
          data: {
            status: "SOLD",
            soldAt: new Date(),
            saleInvoiceNo: transaction.referenceNo || null,
          },
        });
      }
    });

    return successResponse({ message: "Outward verified, stock deducted", id: transactionId });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Verification failed", 400);
  }
}
