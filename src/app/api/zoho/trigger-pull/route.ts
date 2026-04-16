export const dynamic = "force-dynamic";
export const maxDuration = 60; // Allow up to 60s on Vercel Pro, 10s on Hobby

import { prisma } from "@/lib/db";
import { ZohoClient } from "@/lib/zoho";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

// POST — manually trigger a Zoho pull (admin only, uses session auth)
export async function POST() {
  try {
    await requireAuth(["ADMIN", "SUPERVISOR"]);

    // Clear ALL stuck "running" syncs (any older than 2 minutes)
    await prisma.syncLog.updateMany({
      where: {
        status: "running",
        syncType: "cron-pull",
        startedAt: { lt: new Date(Date.now() - 2 * 60 * 1000) },
      },
      data: { status: "failed", completedAt: new Date(), errors: JSON.stringify(["Auto-cleared: timed out"]) },
    });

    // Check for genuinely running sync (started < 2 min ago)
    const runningSync = await prisma.syncLog.findFirst({
      where: { status: "running", syncType: "cron-pull" },
    });
    if (runningSync) return errorResponse("Sync already in progress (started less than 2 min ago)", 409);

    const syncLog = await prisma.syncLog.create({
      data: { syncType: "cron-pull", status: "running", triggeredBy: "manual" },
    });

    const zoho = new ZohoClient();
    const ready = await zoho.init();
    if (!ready) {
      await prisma.syncLog.update({
        where: { id: syncLog.id },
        data: { status: "failed", completedAt: new Date(), errors: JSON.stringify(["Zoho not connected"]) },
      });
      return errorResponse("Zoho not connected", 400);
    }

    const config = await prisma.zohoConfig.findUnique({ where: { id: "singleton" } });
    const lastSyncAt = config?.lastSyncAt?.toISOString().slice(0, 10) || undefined;

    const pullId = `pull-${Date.now()}`;
    const allErrors: string[] = [];
    let apiCalls = 0;
    let contactsNew = 0, itemsNew = 0, billsNew = 0, invoicesNew = 0;

    // ─── STEP 1: Items ───
    try {
      const items = await zoho.listAllItems(undefined, lastSyncAt);
      apiCalls += Math.ceil(items.length / 200) || 1;

      for (const item of items) {
        const zohoItem = item as Record<string, unknown>;
        if (item.sku) {
          const existing = await prisma.product.findFirst({ where: { sku: item.sku } });
          if (existing) continue;
        }
        if (item.item_id) {
          const existing = await prisma.product.findFirst({ where: { zohoItemId: item.item_id } });
          if (existing) continue;
        }

        await prisma.zohoPullPreview.create({
          data: {
            pullId,
            entityType: "item",
            zohoId: item.item_id,
            data: {
              name: item.name,
              sku: item.sku || "",
              costPrice: Number(zohoItem.purchase_rate || 0),
              sellingPrice: Number(zohoItem.rate || 0),
              gstRate: Number(zohoItem.tax_percentage || 18),
              hsnCode: String(zohoItem.hsn_or_sac || ""),
              stockOnHand: Number(zohoItem.stock_on_hand || 0),
              productType: String(zohoItem.product_type || zohoItem.item_type || ""),
            },
          },
        });
        itemsNew++;
      }
    } catch (e) {
      allErrors.push(`Items: ${e instanceof Error ? e.message : "Unknown"}`);
    }

    // ─── STEP 2: Contacts ───
    try {
      const contacts = await zoho.listAllContacts(lastSyncAt);
      apiCalls += Math.ceil(contacts.length / 200) || 1;
      const vendors = contacts.filter((c) => c.contact_type === "vendor");

      for (const contact of vendors) {
        const existing = await prisma.vendor.findFirst({
          where: { name: { equals: contact.contact_name, mode: "insensitive" } },
        });
        if (existing) continue;

        await prisma.zohoPullPreview.create({
          data: {
            pullId,
            entityType: "contact",
            zohoId: contact.contact_id,
            data: {
              name: contact.contact_name,
              gstin: contact.gst_no || "",
              email: contact.email || "",
              phone: contact.phone || "",
              city: contact.billing_address?.city || "",
              state: contact.billing_address?.state || "",
            },
          },
        });
        contactsNew++;
      }
    } catch (e) {
      allErrors.push(`Contacts: ${e instanceof Error ? e.message : "Unknown"}`);
    }

    // ─── STEP 3: Bills ───
    try {
      const bills = await zoho.listAllBills(lastSyncAt);
      apiCalls += Math.ceil(bills.length / 200) || 1;

      for (const bill of bills) {
        const existingBill = await prisma.vendorBill.findFirst({
          where: { billNo: bill.bill_number },
        });
        if (existingBill) continue;

        let lineItems: Array<{ name: string; sku: string; quantity: number; rate: number; itemTotal: number }> = [];
        try {
          await zoho.delay(500);
          const detail = await zoho.getBill(bill.bill_id);
          apiCalls++;
          lineItems = (detail.bill.line_items || []).map((li) => ({
            name: li.name, sku: li.sku, quantity: li.quantity, rate: li.rate, itemTotal: li.item_total,
          }));
        } catch {
          allErrors.push(`Bill ${bill.bill_number}: failed to fetch line items`);
        }

        await prisma.zohoPullPreview.create({
          data: {
            pullId,
            entityType: "bill",
            zohoId: bill.bill_id,
            data: {
              billNumber: bill.bill_number,
              vendorName: bill.vendor_name,
              date: bill.date,
              dueDate: bill.due_date,
              total: bill.total,
              balance: bill.balance,
              status: bill.status,
              lineItems,
            },
          },
        });
        billsNew++;
      }
    } catch (e) {
      allErrors.push(`Bills: ${e instanceof Error ? e.message : "Unknown"}`);
    }

    // ─── STEP 4: Invoices ───
    try {
      const invoices = await zoho.listAllInvoices(lastSyncAt);
      apiCalls += Math.ceil(invoices.length / 200) || 1;

      for (const invoice of invoices) {
        if (invoice.status === "void") continue;

        const existing = await prisma.delivery.findFirst({
          where: { invoiceNo: invoice.invoice_number },
        });
        if (existing) continue;

        let lineItems: Array<{ name: string; sku: string; quantity: number; rate: number; itemTotal: number }> = [];
        let salesPerson = "";
        try {
          await zoho.delay(500);
          const detail = await zoho.getInvoice(invoice.invoice_id);
          apiCalls++;
          lineItems = (detail.invoice.line_items || []).map((li) => ({
            name: li.name, sku: li.sku, quantity: li.quantity, rate: li.rate, itemTotal: li.item_total,
          }));
          salesPerson = (detail.invoice as Record<string, unknown>).salesperson_name as string || "";
        } catch {
          allErrors.push(`Invoice ${invoice.invoice_number}: failed to fetch details`);
        }

        await prisma.zohoPullPreview.create({
          data: {
            pullId,
            entityType: "invoice",
            zohoId: invoice.invoice_id,
            data: {
              invoiceNumber: invoice.invoice_number,
              customerName: invoice.customer_name,
              phone: invoice.phone || "",
              date: invoice.date,
              total: invoice.total,
              balance: invoice.balance,
              status: invoice.status,
              salesPerson,
              lineItems,
            },
          },
        });
        invoicesNew++;
      }
    } catch (e) {
      allErrors.push(`Invoices: ${e instanceof Error ? e.message : "Unknown"}`);
    }

    // ─── Create pull log ───
    await prisma.zohoPullLog.create({
      data: {
        pullId,
        contactsNew,
        itemsNew,
        billsNew,
        invoicesNew,
        apiCallsUsed: apiCalls,
        errors: allErrors.length > 0 ? JSON.stringify(allErrors) : null,
      },
    });

    const totalNew = contactsNew + itemsNew + billsNew + invoicesNew;
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: allErrors.length > 0 ? "partial" : "success",
        totalItems: totalNew,
        synced: totalNew,
        failed: allErrors.length,
        errors: allErrors.length > 0 ? JSON.stringify(allErrors.slice(0, 20)) : null,
        completedAt: new Date(),
      },
    });

    await prisma.zohoConfig.update({
      where: { id: "singleton" },
      data: { lastSyncAt: new Date() },
    }).catch(() => {});

    return successResponse({
      pullId,
      status: totalNew > 0 ? "PENDING_REVIEW" : "NO_NEW_DATA",
      contactsNew,
      itemsNew,
      billsNew,
      invoicesNew,
      apiCallsUsed: apiCalls,
      errors: allErrors.slice(0, 10),
    });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Manual pull failed", 500);
  }
}
