export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

const ALLOWED_ROLES = ["ADMIN", "SUPERVISOR", "INWARDS_CLERK", "ACCOUNTS_MANAGER"] as const;

// GET: Fetch all UNVERIFIED inward transactions for a given bill reference
export async function GET(req: NextRequest) {
  try {
    await requireAuth([...ALLOWED_ROLES]);
    const { searchParams } = new URL(req.url);
    const ref = searchParams.get("ref");

    if (!ref) return errorResponse("Bill reference (ref) is required", 400);

    // Support comma-separated bill numbers (e.g. "BILL-1,BILL-2")
    const refs = ref.split(",").map((r) => r.trim()).filter(Boolean);

    const transactions = await prisma.inventoryTransaction.findMany({
      where: {
        type: "INWARD",
        referenceNo: refs.length === 1 ? refs[0] : { in: refs },
        notes: { contains: "[ZOHO]" },
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            binId: true,
            brand: { select: { name: true } },
          },
        },
        user: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Split into unverified and verified so the UI knows what's pending
    const unverified = transactions.filter((t) => t.notes?.includes("[UNVERIFIED]"));
    const verified = transactions.filter((t) => t.notes?.includes("[VERIFIED]"));

    return successResponse({
      ref,
      unverified,
      verified,
      totalItems: transactions.length,
      pendingCount: unverified.length,
      verifiedCount: verified.length,
    });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch putaway items", 500);
  }
}

// POST: Bulk verify/putaway — verify multiple transactions and assign bin locations
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth([...ALLOWED_ROLES]);
    const body = await req.json();
    const { transactions: items } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return errorResponse("transactions array is required and must not be empty", 400);
    }

    const errors: { transactionId: string; error: string }[] = [];
    let verifiedCount = 0;

    for (const item of items) {
      const { transactionId, binId } = item;

      if (!transactionId) {
        errors.push({ transactionId: "unknown", error: "Missing transactionId" });
        continue;
      }

      try {
        const transaction = await prisma.inventoryTransaction.findUnique({
          where: { id: transactionId },
          include: { product: true },
        });

        if (!transaction) {
          errors.push({ transactionId, error: "Transaction not found" });
          continue;
        }
        if (transaction.type !== "INWARD") {
          errors.push({ transactionId, error: "Not an inward transaction" });
          continue;
        }
        if (!transaction.notes?.includes("[ZOHO]")) {
          errors.push({ transactionId, error: "Not a Zoho transaction" });
          continue;
        }
        if (transaction.notes?.includes("[VERIFIED]")) {
          errors.push({ transactionId, error: "Already verified" });
          continue;
        }

        // Add stock and update bin inside a transaction to prevent race conditions
        await prisma.$transaction(async (tx) => {
          const product = await tx.product.findUniqueOrThrow({
            where: { id: transaction.productId },
          });

          const newStock = product.currentStock + transaction.quantity;

          await tx.product.update({
            where: { id: product.id },
            data: {
              currentStock: newStock,
              ...(binId && { binId }),
            },
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
        });

        verifiedCount++;
      } catch (err) {
        errors.push({
          transactionId,
          error: err instanceof Error ? err.message : "Verification failed",
        });
      }
    }

    return successResponse({
      verified: verifiedCount,
      total: items.length,
      errors,
    });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Putaway failed", 400);
  }
}
