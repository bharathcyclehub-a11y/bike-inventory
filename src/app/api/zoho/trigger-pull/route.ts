export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ZohoClient } from "@/lib/zoho";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

/*
 * API BUDGET OPTIMIZATION:
 * ─────────────────────────
 * Target: < 15 calls per daily pull
 *
 * Items:     1-2 calls (list pages since lastSync, skip if all exist)
 * Contacts:  1 call (list since lastSync, dedup locally)
 * Bills:     1 call (yesterday only) + 1 per NEW bill (detail, capped at 10)
 * Invoices:  1 call (yesterday only) + 1 per NEW invoice (detail, capped at 10)
 *
 * Bills & invoices use YESTERDAY only — daily pull only needs 1 day
 * Items & contacts use lastSyncAt (cheap, no detail calls)
 */

const MAX_DETAIL_CALLS_PER_ENTITY = 150; // Covers busy days; yesterday-only filter is the real limiter

export async function POST(req: NextRequest) {
  try {
    await requireAuth(["ADMIN", "SUPERVISOR"]);
    const body = await req.json();
    const { step, pullId: existingPullId } = body as { step: string; pullId?: string };

    // ─── INIT ───
    if (step === "init") {
      await prisma.syncLog.updateMany({
        where: {
          status: "running",
          syncType: "cron-pull",
          startedAt: { lt: new Date(Date.now() - 2 * 60 * 1000) },
        },
        data: { status: "failed", completedAt: new Date(), errors: JSON.stringify(["Auto-cleared"]) },
      });

      const runningSync = await prisma.syncLog.findFirst({
        where: { status: "running", syncType: "cron-pull" },
      });
      if (runningSync) return errorResponse("Sync already in progress", 409);

      await prisma.syncLog.create({
        data: { syncType: "cron-pull", status: "running", triggeredBy: "manual" },
      });

      // Validate Zoho connection (1 API call for token refresh if needed)
      const zoho = new ZohoClient();
      const ready = await zoho.init();
      if (!ready) return errorResponse("Zoho not connected", 400);

      const pullId = `pull-${Date.now()}`;
      return successResponse({ pullId, step: "init", message: "Ready" });
    }

    if (!existingPullId) return errorResponse("pullId required", 400);

    const config = await prisma.zohoConfig.findUnique({ where: { id: "singleton" } });

    // Default to last 30 days if never synced (prevents fetching ALL history)
    let lastSyncAt = config?.lastSyncAt?.toISOString().slice(0, 10);
    if (!lastSyncAt) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      lastSyncAt = thirtyDaysAgo.toISOString().slice(0, 10);
    }

    // Yesterday's date for bills & invoices (daily pull only needs 1 day)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);
    const todayStr = new Date().toISOString().slice(0, 10);

    const zoho = new ZohoClient();
    const ready = await zoho.init();
    if (!ready) return errorResponse("Zoho not connected", 400);

    // ─── ITEMS: list only, no detail calls ───
    if (step === "items") {
      let itemsNew = 0;
      let apiCalls = 0;
      const errors: string[] = [];

      try {
        // Use lastModifiedTime to only get recently changed items (1-2 API calls)
        const items = await zoho.listAllItems(undefined, lastSyncAt);
        apiCalls += Math.ceil(items.length / 200) || 1;

        for (const item of items) {
          const zohoItem = item as Record<string, unknown>;
          // Skip if already exists
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
              pullId: existingPullId,
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
        errors.push(`Items: ${e instanceof Error ? e.message : "Unknown"}`);
      }

      return successResponse({ step: "items", itemsNew, apiCalls, errors });
    }

    // ─── CONTACTS: list only, 1 call ───
    if (step === "contacts") {
      let contactsNew = 0;
      let apiCalls = 0;
      const errors: string[] = [];

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
              pullId: existingPullId,
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
        errors.push(`Contacts: ${e instanceof Error ? e.message : "Unknown"}`);
      }

      return successResponse({ step: "contacts", contactsNew, apiCalls, errors });
    }

    // ─── BILLS: yesterday only + capped detail calls ───
    if (step === "bills") {
      let billsNew = 0;
      let apiCalls = 0;
      let detailCalls = 0;
      const errors: string[] = [];

      try {
        const bills = await zoho.listAllBills(yesterdayStr, todayStr);
        apiCalls += Math.ceil(bills.length / 200) || 1;

        // Filter to only NEW bills first (before making any detail calls)
        const newBills: typeof bills = [];
        for (const bill of bills) {
          const existing = await prisma.vendorBill.findFirst({
            where: { billNo: bill.bill_number },
          });
          if (!existing) newBills.push(bill);
        }

        for (const bill of newBills) {
          let lineItems: Array<{ name: string; sku: string; quantity: number; rate: number; itemTotal: number }> = [];

          // Only fetch detail if under the cap
          if (detailCalls < MAX_DETAIL_CALLS_PER_ENTITY) {
            try {
              await zoho.delay(300);
              const detail = await zoho.getBill(bill.bill_id);
              apiCalls++;
              detailCalls++;
              lineItems = (detail.bill.line_items || []).map((li) => ({
                name: li.name, sku: li.sku, quantity: li.quantity, rate: li.rate, itemTotal: li.item_total,
              }));
            } catch {
              errors.push(`Bill ${bill.bill_number}: detail fetch skipped`);
            }
          } else {
            errors.push(`Bill ${bill.bill_number}: line items skipped (API budget cap)`);
          }

          await prisma.zohoPullPreview.create({
            data: {
              pullId: existingPullId,
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
        errors.push(`Bills: ${e instanceof Error ? e.message : "Unknown"}`);
      }

      return successResponse({ step: "bills", billsNew, apiCalls, errors });
    }

    // ─── INVOICES: yesterday only + detail calls for line items (essential for outward check) ───
    if (step === "invoices") {
      let invoicesNew = 0;
      let apiCalls = 0;
      let detailCalls = 0;
      const errors: string[] = [];

      try {
        const invoices = await zoho.listAllInvoices(yesterdayStr, todayStr);
        apiCalls += Math.ceil(invoices.length / 200) || 1;

        // Filter to only NEW invoices first
        const newInvoices: typeof invoices = [];
        for (const invoice of invoices) {
          if (invoice.status === "void") continue;
          const existing = await prisma.delivery.findFirst({
            where: { invoiceNo: invoice.invoice_number },
          });
          if (!existing) newInvoices.push(invoice);
        }

        for (const invoice of newInvoices) {
          let lineItems: Array<{ name: string; sku: string; quantity: number; rate: number; itemTotal: number }> = [];
          let salesPerson = "";

          if (detailCalls < MAX_DETAIL_CALLS_PER_ENTITY) {
            try {
              await zoho.delay(300);
              const detail = await zoho.getInvoice(invoice.invoice_id);
              apiCalls++;
              detailCalls++;
              lineItems = (detail.invoice.line_items || []).map((li) => ({
                name: li.name, sku: li.sku, quantity: li.quantity, rate: li.rate, itemTotal: li.item_total,
              }));
              salesPerson = (detail.invoice as Record<string, unknown>).salesperson_name as string || "";
            } catch {
              errors.push(`Invoice ${invoice.invoice_number}: detail fetch failed`);
            }
          } else {
            errors.push(`Invoice ${invoice.invoice_number}: line items skipped (API budget cap)`);
          }

          await prisma.zohoPullPreview.create({
            data: {
              pullId: existingPullId,
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
        errors.push(`Invoices: ${e instanceof Error ? e.message : "Unknown"}`);
      }

      return successResponse({ step: "invoices", invoicesNew, apiCalls, errors });
    }

    // ─── FINALIZE ───
    if (step === "finalize") {
      const { itemsNew = 0, contactsNew = 0, billsNew = 0, invoicesNew = 0, apiCalls = 0, allErrors = [] } = body as {
        itemsNew?: number; contactsNew?: number; billsNew?: number; invoicesNew?: number;
        apiCalls?: number; allErrors?: string[];
      };

      await prisma.zohoPullLog.create({
        data: {
          pullId: existingPullId,
          contactsNew,
          itemsNew,
          billsNew,
          invoicesNew,
          apiCallsUsed: apiCalls,
          errors: allErrors.length > 0 ? JSON.stringify(allErrors) : null,
        },
      });

      const totalNew = contactsNew + itemsNew + billsNew + invoicesNew;

      const syncLog = await prisma.syncLog.findFirst({
        where: { status: "running", syncType: "cron-pull" },
        orderBy: { startedAt: "desc" },
      });
      if (syncLog) {
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
      }

      await prisma.zohoConfig.update({
        where: { id: "singleton" },
        data: { lastSyncAt: new Date() },
      }).catch(() => {});

      return successResponse({
        pullId: existingPullId,
        status: totalNew > 0 ? "PENDING_REVIEW" : "NO_NEW_DATA",
        contactsNew,
        itemsNew,
        billsNew,
        invoicesNew,
        apiCallsUsed: apiCalls,
        errors: allErrors.slice(0, 10),
      });
    }

    return errorResponse("Invalid step", 400);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Pull failed", 500);
  }
}
