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
      data: { syncType: "bills", status: "running", triggeredBy: currentUser?.id },
    });

    const since = body.since ? new Date(body.since) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const bills = await prisma.vendorBill.findMany({
      where: { createdAt: { gte: since } },
      include: {
        vendor: { select: { name: true } },
        purchaseOrder: {
          include: {
            items: { include: { product: { select: { name: true } } } },
          },
        },
      },
      orderBy: { billDate: "desc" },
    });

    let synced = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const bill of bills) {
      try {
        const lineItems = bill.purchaseOrder?.items.map((item) => ({
          name: item.product.name,
          quantity: item.quantity,
          rate: item.unitPrice,
        })) || [{ name: `Bill ${bill.billNo}`, quantity: 1, rate: bill.amount }];

        await zoho.createBill({
          vendorName: bill.vendor.name,
          billNo: bill.billNo,
          billDate: bill.billDate.toISOString().split("T")[0],
          dueDate: bill.dueDate.toISOString().split("T")[0],
          amount: bill.amount,
          lineItems,
        });
        synced++;
      } catch (err) {
        failed++;
        errors.push(`${bill.billNo}: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }

    const status = failed === 0 ? "success" : synced === 0 ? "failed" : "partial";

    await prisma.syncLog.update({
      where: { id: log.id },
      data: { status, totalItems: bills.length, synced, failed, errors: errors.length > 0 ? JSON.stringify(errors) : null, completedAt: new Date() },
    });

    if (status !== "failed") {
      await prisma.zohoConfig.update({ where: { id: "singleton" }, data: { lastSyncAt: new Date() } });
    }

    return successResponse({ syncType: "bills", status, total: bills.length, synced, failed, errors });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Sync failed", 500);
  }
}
