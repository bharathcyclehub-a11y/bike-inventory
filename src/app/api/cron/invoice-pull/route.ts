export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";

export async function GET(req: NextRequest) {
  // Verify cron secret (Vercel sends this header)
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return errorResponse("Unauthorized", 401);
  }

  try {
    // Get last pull timestamp
    const lastPull = await prisma.syncLog.findFirst({
      where: { syncType: "invoice-pull", status: "completed" },
      orderBy: { completedAt: "desc" },
      select: { completedAt: true },
    });

    const since = lastPull?.completedAt || new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Import ZohoClient
    let zohoClient;
    try {
      const { ZohoClient } = await import("@/lib/zoho");
      zohoClient = new ZohoClient();
      const initialized = await zohoClient.init();
      if (!initialized) {
        return successResponse({ message: "Zoho not connected", imported: 0 });
      }
    } catch {
      return successResponse({ message: "Zoho not configured", imported: 0 });
    }

    // Fetch recent invoices from Zoho
    let invoices: Array<{
      invoice_id: string; invoice_number: string; customer_name: string;
      phone?: string; date: string; total: number; status: string;
    }> = [];
    try {
      const result = await zohoClient.listInvoices(
        1,
        since.toISOString().slice(0, 10),
        new Date().toISOString().slice(0, 10),
      );
      invoices = result.invoices || [];
    } catch {
      // Log and continue — Zoho might not be connected
      await prisma.syncLog.create({
        data: {
          syncType: "invoice-pull",
          status: "failed",
          totalItems: 0,
          synced: 0,
          failed: 0,
          startedAt: new Date(),
          completedAt: new Date(),
          errors: JSON.stringify(["Zoho API call failed"]),
          triggeredBy: "cron",
        },
      });
      return successResponse({ message: "Zoho API call failed", imported: 0 });
    }

    let imported = 0;
    const errors: string[] = [];

    for (const inv of invoices) {
      const invoiceNo = inv.invoice_number || "";
      if (!invoiceNo) continue;

      // Skip if delivery already exists
      const exists = await prisma.delivery.findFirst({
        where: { invoiceNo },
      });
      if (exists) continue;

      try {
        // Get line items + salesperson from invoice detail
        let lineItems: Array<{ name: string; sku: string; quantity: number; rate: number; itemTotal: number }> = [];
        let salesPerson: string | null = null;
        try {
          const detail = await zohoClient.getInvoice(inv.invoice_id);
          lineItems = (detail.invoice?.line_items || []).map((li) => ({
            name: li.name || "",
            sku: li.sku || li.item_id || "",
            quantity: li.quantity || 1,
            rate: li.rate || 0,
            itemTotal: li.item_total || 0,
          }));
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          salesPerson = (detail.invoice as any)?.salesperson_name || null;
        } catch { /* use empty line items */ }

        await prisma.delivery.create({
          data: {
            invoiceNo,
            zohoInvoiceId: inv.invoice_id || null,
            invoiceDate: new Date(inv.date || new Date().toISOString()),
            invoiceAmount: inv.total || 0,
            customerName: inv.customer_name || "Unknown",
            customerPhone: inv.phone || null,
            salesPerson,
            status: "PENDING",
            lineItems: lineItems.length > 0 ? lineItems : undefined,
          },
        });
        imported++;
      } catch (e) {
        errors.push(`${invoiceNo}: ${e instanceof Error ? e.message : "Failed"}`);
      }
    }

    // Log the sync
    await prisma.syncLog.create({
      data: {
        syncType: "invoice-pull",
        status: "completed",
        totalItems: invoices.length,
        synced: imported,
        failed: errors.length,
        startedAt: new Date(),
        completedAt: new Date(),
        errors: errors.length > 0 ? JSON.stringify(errors) : undefined,
        triggeredBy: "cron",
      },
    });

    return successResponse({ total: invoices.length, imported, errors });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Cron failed", 500);
  }
}
