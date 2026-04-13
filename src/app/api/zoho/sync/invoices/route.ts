export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ZohoClient } from "@/lib/zoho";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError, getCurrentUser } from "@/lib/auth-helpers";

export async function POST(req: NextRequest) {
  try {
    await requireAuth(["ADMIN", "SUPERVISOR"]);
    const currentUser = await getCurrentUser();
    const body = await req.json().catch(() => ({}));

    const zoho = new ZohoClient();
    const ready = await zoho.init();
    if (!ready) return errorResponse("Zoho not connected", 400);

    const log = await prisma.syncLog.create({
      data: { syncType: "invoices", status: "running", triggeredBy: currentUser?.id },
    });

    // Get outward transactions from last 30 days (or custom range)
    const since = body.since ? new Date(body.since) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const transactions = await prisma.inventoryTransaction.findMany({
      where: { type: "OUTWARD", createdAt: { gte: since } },
      include: {
        product: { select: { name: true, sku: true, sellingPrice: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    let synced = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const tx of transactions) {
      try {
        await zoho.createInvoice({
          customerName: tx.notes || "Walk-in Customer",
          referenceNo: tx.referenceNo || undefined,
          date: tx.createdAt.toISOString().split("T")[0],
          lineItems: [{
            name: tx.product.name,
            sku: tx.product.sku,
            quantity: tx.quantity,
            rate: tx.product.sellingPrice,
          }],
        });
        synced++;
      } catch (err) {
        failed++;
        errors.push(`TX-${tx.id.slice(-6)}: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }

    const status = failed === 0 ? "success" : synced === 0 ? "failed" : "partial";

    await prisma.syncLog.update({
      where: { id: log.id },
      data: { status, totalItems: transactions.length, synced, failed, errors: errors.length > 0 ? JSON.stringify(errors) : null, completedAt: new Date() },
    });

    if (status !== "failed") {
      await prisma.zohoConfig.update({ where: { id: "singleton" }, data: { lastSyncAt: new Date() } });
    }

    return successResponse({ syncType: "invoices", status, total: transactions.length, synced, failed, errors });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Sync failed", 500);
  }
}
