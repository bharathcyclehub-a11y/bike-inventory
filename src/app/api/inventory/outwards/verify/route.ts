export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

// POST: Verify a Zoho-pulled outward transaction
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(["ADMIN", "SUPERVISOR", "MANAGER", "OUTWARDS_CLERK"]);
    const body = await req.json();
    const { transactionId } = body;

    if (!transactionId) return errorResponse("Transaction ID required", 400);

    const transaction = await prisma.inventoryTransaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) return errorResponse("Transaction not found", 404);
    if (transaction.type !== "OUTWARD") return errorResponse("Not an outward transaction", 400);
    if (!transaction.notes?.includes("[ZOHO]")) return errorResponse("Not a Zoho transaction", 400);
    if (transaction.notes?.includes("[VERIFIED]")) return errorResponse("Already verified", 400);

    await prisma.inventoryTransaction.update({
      where: { id: transactionId },
      data: {
        notes: transaction.notes!
          .replace("[UNVERIFIED]", "[VERIFIED]")
          + ` | Verified by: ${user.name} at ${new Date().toLocaleString("en-IN")}`,
      },
    });

    return successResponse({ message: "Transaction verified", id: transactionId });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Verification failed", 400);
  }
}
