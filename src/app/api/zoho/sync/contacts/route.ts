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
    if (!ready) return errorResponse("Zoho not connected", 400);

    const log = await prisma.syncLog.create({
      data: { syncType: "contacts", status: "running", triggeredBy: currentUser?.id },
    });

    const vendors = await prisma.vendor.findMany({
      where: { isActive: true },
      select: { id: true, name: true, gstin: true, email: true, phone: true, city: true, state: true },
    });

    let synced = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const vendor of vendors) {
      try {
        await zoho.createContact(vendor);
        synced++;
      } catch (err) {
        failed++;
        errors.push(`${vendor.name}: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }

    const status = failed === 0 ? "success" : synced === 0 ? "failed" : "partial";

    await prisma.syncLog.update({
      where: { id: log.id },
      data: { status, totalItems: vendors.length, synced, failed, errors: errors.length > 0 ? JSON.stringify(errors) : null, completedAt: new Date() },
    });

    if (status !== "failed") {
      await prisma.zohoConfig.update({
        where: { id: "singleton" },
        data: { lastSyncAt: new Date() },
      });
    }

    return successResponse({ syncType: "contacts", status, total: vendors.length, synced, failed, errors });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Sync failed", 500);
  }
}
