export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ZohoClient } from "@/lib/zoho";
import { ZakyaClient } from "@/lib/zakya";
import { ZohoInventoryClient } from "@/lib/zoho-inventory";
import { successResponse, errorResponse } from "@/lib/api-utils";

/*
 * 3-SOURCE CRON PULL:
 * ─────────────────────────
 * Items:     Zoho Inventory  (zohoapis.in/inventory/v1) — 1000 calls/day
 * Contacts:  Zoho Books      (zohoapis.in/books/v3)     — 1000 calls/day
 * Bills:     Zoho Books      (zohoapis.in/books/v3)     — shared with contacts
 * Invoices:  Zakya POS       (api.zakya.in/inventory/v1) — 2500 calls/day
 *
 * Total: 4500 API calls/day across 3 sources
 * Each source initializes independently. If not connected, step is skipped.
 */

const MAX_DETAIL_CALLS_PER_ENTITY = 150; // Covers busy days; yesterday-only filter is the real limiter

// Vercel Cron Job: Daily at 1 PM IST (07:30 UTC)
// All data goes to ZohoPullPreview for admin approval. Nothing touches real tables.
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) return errorResponse("CRON_SECRET not configured", 500);
    if (authHeader !== `Bearer ${cronSecret}`) return errorResponse("Unauthorized", 401);

    // Auto-clear stuck syncs older than 2 minutes
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

    const syncLog = await prisma.syncLog.create({
      data: { syncType: "cron-pull", status: "running", triggeredBy: "cron" },
    });

    // ─── Initialize 3 sources independently ───
    const zoho = new ZohoClient();
    const booksReady = await zoho.init();

    const zakya = new ZakyaClient();
    const posReady = await zakya.init();

    const inventory = new ZohoInventoryClient();
    const inventoryReady = await inventory.init();

    // Need at least one source connected
    if (!booksReady && !posReady && !inventoryReady) {
      await prisma.syncLog.update({
        where: { id: syncLog.id },
        data: { status: "failed", completedAt: new Date(), errors: JSON.stringify(["No sources connected"]) },
      });
      return errorResponse("No Zoho sources connected", 400);
    }

    const sources = {
      books: booksReady ? "connected" : "skipped",
      pos: posReady ? "connected" : "skipped",
      inventory: inventoryReady ? "connected" : "skipped",
    };

    // Get last sync times per source
    const booksConfig = await prisma.zohoConfig.findUnique({ where: { id: "singleton" } });
    const inventoryConfig = await prisma.zohoInventoryConfig.findUnique({ where: { id: "singleton" } });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const defaultLastSync = thirtyDaysAgo.toISOString().slice(0, 10);

    const booksLastSync = booksConfig?.lastSyncAt?.toISOString().slice(0, 10) || defaultLastSync;
    const inventoryLastSync = inventoryConfig?.lastSyncAt?.toISOString().slice(0, 10) || defaultLastSync;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);
    const todayStr = new Date().toISOString().slice(0, 10);

    const pullId = `pull-${Date.now()}`;
    const allErrors: string[] = [];
    let apiCalls = 0;
    let contactsNew = 0, itemsNew = 0, billsNew = 0, invoicesNew = 0;

    // ─── STEP 1: Items via Zoho Inventory (or fallback to Books) ───
    try {
      if (inventoryReady) {
        const items = await inventory.listAllItems("active", inventoryLastSync);
        apiCalls += Math.ceil(items.length / 200) || 1;

        for (const item of items) {
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
                costPrice: Number(item.purchase_rate || 0),
                sellingPrice: Number(item.rate || 0),
                gstRate: Number(item.tax_percentage || 18),
                hsnCode: String(item.hsn_or_sac || ""),
                stockOnHand: Number(item.stock_on_hand || 0),
                productType: String(item.product_type || item.item_type || ""),
              },
            },
          });
          itemsNew++;
        }
      } else if (booksReady) {
        // Fallback to Books if Inventory not connected
        const items = await zoho.listAllItems("active", booksLastSync);
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
      } else {
        allErrors.push("Items: skipped — no source connected");
      }
    } catch (e) {
      allErrors.push(`Items: ${e instanceof Error ? e.message : "Unknown"}`);
    }

    // ─── STEP 2: Contacts via Zoho Books ───
    if (booksReady) {
      try {
        const contacts = await zoho.listAllContacts(booksLastSync);
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
    } else {
      allErrors.push("Contacts: skipped — Books not connected");
    }

    // ─── STEP 3: Bills via Zoho Books ───
    if (booksReady) {
      try {
        const bills = await zoho.listAllBills(yesterdayStr, todayStr);
        apiCalls += Math.ceil(bills.length / 200) || 1;
        let detailCalls = 0;

        const newBills: typeof bills = [];
        for (const bill of bills) {
          const existing = await prisma.vendorBill.findFirst({
            where: { billNo: bill.bill_number },
          });
          if (!existing) newBills.push(bill);
        }

        for (const bill of newBills) {
          let lineItems: Array<{ name: string; sku: string; quantity: number; rate: number; itemTotal: number }> = [];

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
              allErrors.push(`Bill ${bill.bill_number}: detail fetch skipped`);
            }
          } else {
            allErrors.push(`Bill ${bill.bill_number}: line items skipped (API budget cap)`);
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
    } else {
      allErrors.push("Bills: skipped — Books not connected");
    }

    // ─── STEP 4: Invoices via Zakya POS (or fallback to Books) ───
    try {
      if (posReady) {
        const invoices = await zakya.listAllInvoices(yesterdayStr, todayStr);
        apiCalls += Math.ceil(invoices.length / 200) || 1;
        let detailCalls = 0;

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
              await zakya.delay(300);
              const detail = await zakya.getInvoice(invoice.invoice_id);
              apiCalls++;
              detailCalls++;
              lineItems = (detail.invoice.line_items || []).map((li) => ({
                name: li.name, sku: li.sku, quantity: li.quantity, rate: li.rate, itemTotal: li.item_total,
              }));
              salesPerson = (detail.invoice as Record<string, unknown>).salesperson_name as string || "";
            } catch {
              allErrors.push(`Invoice ${invoice.invoice_number}: detail fetch failed`);
            }
          } else {
            allErrors.push(`Invoice ${invoice.invoice_number}: line items skipped (API budget cap)`);
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
      } else if (booksReady) {
        // Fallback to Books if POS not connected
        const invoices = await zoho.listAllInvoices(yesterdayStr, todayStr);
        apiCalls += Math.ceil(invoices.length / 200) || 1;
        let detailCalls = 0;

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
              allErrors.push(`Invoice ${invoice.invoice_number}: detail fetch failed`);
            }
          } else {
            allErrors.push(`Invoice ${invoice.invoice_number}: line items skipped (API budget cap)`);
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
      } else {
        allErrors.push("Invoices: skipped — no source connected");
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

    // Update sync log
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

    // Update lastSyncAt for each connected source
    if (booksReady) {
      await prisma.zohoConfig.update({ where: { id: "singleton" }, data: { lastSyncAt: new Date() } }).catch(() => {});
    }
    if (posReady) {
      await prisma.zakyaConfig.update({ where: { id: "singleton" }, data: { lastSyncAt: new Date() } }).catch(() => {});
    }
    if (inventoryReady) {
      await prisma.zohoInventoryConfig.update({ where: { id: "singleton" }, data: { lastSyncAt: new Date() } }).catch(() => {});
    }

    return successResponse({
      syncType: "cron-pull",
      pullId,
      sources,
      status: totalNew > 0 ? "PENDING_REVIEW" : "NO_NEW_DATA",
      contactsNew,
      itemsNew,
      billsNew,
      invoicesNew,
      apiCallsUsed: apiCalls,
      errors: allErrors.slice(0, 10),
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Cron pull failed", 500);
  }
}
