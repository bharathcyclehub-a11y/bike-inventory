export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { ZohoClient } from "@/lib/zoho";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError, getCurrentUser } from "@/lib/auth-helpers";

export async function POST() {
  try {
    await requireAuth(["ADMIN", "SUPERVISOR"]);
    const currentUser = await getCurrentUser();

    const zoho = new ZohoClient();
    const ready = await zoho.init();
    if (!ready) return errorResponse("Zoho not connected. Connect in Settings first.", 400);

    // Create sync log
    const log = await prisma.syncLog.create({
      data: { syncType: "items", status: "running", triggeredBy: currentUser?.id },
    });

    const products = await prisma.product.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, sku: true, name: true, costPrice: true, sellingPrice: true, hsnCode: true, gstRate: true },
    });

    let synced = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const product of products) {
      try {
        await zoho.createItem({
          sku: product.sku,
          name: product.name,
          costPrice: product.costPrice,
          sellingPrice: product.sellingPrice,
          hsnCode: product.hsnCode,
          gstRate: product.gstRate,
        });
        synced++;
      } catch (err) {
        failed++;
        errors.push(`${product.sku}: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }

    const status = failed === 0 ? "success" : synced === 0 ? "failed" : "partial";

    await prisma.syncLog.update({
      where: { id: log.id },
      data: {
        status,
        totalItems: products.length,
        synced,
        failed,
        errors: errors.length > 0 ? JSON.stringify(errors) : null,
        completedAt: new Date(),
      },
    });

    if (status !== "failed") {
      await prisma.zohoConfig.update({
        where: { id: "singleton" },
        data: { lastSyncAt: new Date() },
      });
    }

    return successResponse({ syncType: "items", status, total: products.length, synced, failed, errors });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Sync failed", 500);
  }
}
