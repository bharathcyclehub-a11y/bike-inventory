export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

// DELETE — remove all Zoho-imported inward/outward transactions
// Keeps stock count entries (referenceNo starting with "BCH-" or from stock count approve)
export async function DELETE() {
  try {
    await requireAuth(["ADMIN"]);

    // Delete inward/outward transactions that came from Zoho (have [ZOHO] in notes)
    const zohoTransactions = await prisma.inventoryTransaction.deleteMany({
      where: {
        notes: { contains: "[ZOHO]" },
      },
    });

    // Also delete vendor bills that were imported from Zoho pulls
    const zohoBills = await prisma.vendorBill.deleteMany({
      where: {
        billNo: { not: "" }, // all bills (they all came from Zoho)
      },
    });

    // Clean up pull previews and logs
    const previews = await prisma.zohoPullPreview.deleteMany({});
    const pullLogs = await prisma.zohoPullLog.deleteMany({});

    return successResponse({
      deleted: {
        transactions: zohoTransactions.count,
        vendorBills: zohoBills.count,
        previews: previews.count,
        pullLogs: pullLogs.count,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Cleanup failed", 500);
  }
}

// GET — preview what would be deleted (dry run)
export async function GET() {
  try {
    await requireAuth(["ADMIN"]);

    const zohoTransactions = await prisma.inventoryTransaction.count({
      where: { notes: { contains: "[ZOHO]" } },
    });

    const vendorBills = await prisma.vendorBill.count();

    const previews = await prisma.zohoPullPreview.count();

    return successResponse({
      wouldDelete: {
        transactions: zohoTransactions,
        vendorBills,
        previews,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Preview failed", 500);
  }
}
