export const dynamic = "force-dynamic";
export const maxDuration = 30; // Allow up to 30s for Zoho API calls

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ZohoClient } from "@/lib/zoho";
import { ZakyaClient } from "@/lib/zakya";
import { ZohoInventoryClient } from "@/lib/zoho-inventory";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

/*
 * 3-SOURCE MANUAL PULL (step-by-step):
 * ─────────────────────────
 * Items:     Zoho Inventory (fallback Books)
 * Contacts:  Zoho Books
 * Bills:     Zoho Inventory + line items (fallback Zakya → Books)
 * Invoices:  Zakya POS (fallback Books)
 */

const MAX_DETAIL_CALLS_PER_ENTITY = 50;

export async function POST(req: NextRequest) {
  try {
    await requireAuth(["ADMIN", "SUPERVISOR", "INWARDS_CLERK", "OUTWARDS_CLERK", "ACCOUNTS_MANAGER"]);
    const body = await req.json();
    const { step, pullId: existingPullId, fullImport, fromDate } = body as { step: string; pullId?: string; fullImport?: boolean; fromDate?: string };

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

      // Check at least one source is connected
      const zoho = new ZohoClient();
      const booksReady = await zoho.init();
      const zakya = new ZakyaClient();
      const posReady = await zakya.init();
      const inventory = new ZohoInventoryClient();
      const inventoryReady = await inventory.init();

      if (!booksReady && !posReady && !inventoryReady) {
        return errorResponse("No Zoho sources connected", 400);
      }

      const pullId = `pull-${Date.now()}`;
      return successResponse({
        pullId, step: "init", message: "Ready",
        sources: {
          books: booksReady ? "connected" : "skipped",
          pos: posReady ? "connected" : "skipped",
          inventory: inventoryReady ? "connected" : "skipped",
        },
      });
    }

    if (!existingPullId) return errorResponse("pullId required", 400);

    // Default last sync — 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const defaultLastSync = thirtyDaysAgo.toISOString().slice(0, 10);
    const todayStr = new Date().toISOString().slice(0, 10);

    // ─── ITEMS: via Zoho Inventory (fallback Books) ───
    if (step === "items") {
      let itemsNew = 0;
      let apiCalls = 0;
      const errors: string[] = [];
      let source = "none";

      try {
        // Try Inventory first
        const inventory = new ZohoInventoryClient();
        const inventoryReady = await inventory.init();

        if (inventoryReady) {
          source = "inventory";
          const invConfig = await prisma.zohoInventoryConfig.findUnique({ where: { id: "singleton" } });
          const lastSync = invConfig?.lastSyncAt?.toISOString().slice(0, 10) || defaultLastSync;
          const items = await inventory.listAllItems("active", fullImport ? undefined : lastSync);
          apiCalls += Math.ceil(items.length / 200) || 1;

          for (const item of items) {
            if (item.sku) {
              const existing = await prisma.product.findFirst({ where: { sku: item.sku } });
              if (existing) continue; // skip existing (active or inactive)
            }
            if (item.item_id) {
              const existing = await prisma.product.findFirst({ where: { zohoItemId: item.item_id } });
              if (existing) continue; // skip existing (active or inactive)
            }

            await prisma.zohoPullPreview.create({
              data: {
                pullId: existingPullId,
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
        } else {
          // Fallback to Books
          const zoho = new ZohoClient();
          const booksReady = await zoho.init();
          if (booksReady) {
            source = "books";
            const booksConfig = await prisma.zohoConfig.findUnique({ where: { id: "singleton" } });
            const lastSync = booksConfig?.lastSyncAt?.toISOString().slice(0, 10) || defaultLastSync;
            const items = await zoho.listAllItems("active", fullImport ? undefined : lastSync);
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
          } else {
            errors.push("Items: no source connected");
          }
        }
      } catch (e) {
        errors.push(`Items: ${e instanceof Error ? e.message : "Unknown"}`);
      }

      return successResponse({ step: "items", source, itemsNew, apiCalls, errors });
    }

    // ─── CONTACTS: via Zoho Books ───
    if (step === "contacts") {
      let contactsNew = 0;
      let apiCalls = 0;
      const errors: string[] = [];

      try {
        const zoho = new ZohoClient();
        const booksReady = await zoho.init();
        if (!booksReady) {
          return successResponse({ step: "contacts", source: "skipped", contactsNew: 0, apiCalls: 0, errors: ["Books not connected"] });
        }

        const booksConfig = await prisma.zohoConfig.findUnique({ where: { id: "singleton" } });
        const lastSync = booksConfig?.lastSyncAt?.toISOString().slice(0, 10) || defaultLastSync;
        const contacts = await zoho.listAllContacts(lastSync);
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

      return successResponse({ step: "contacts", source: "books", contactsNew, apiCalls, errors });
    }

    // ─── BILLS: via Zoho Inventory (fallback Zakya → Books) ───
    if (step === "bills") {
      let billsNew = 0;
      let apiCalls = 0;
      let detailCalls = 0;
      const errors: string[] = [];
      let source = "none";

      try {
        const billsFromDate = fromDate || todayStr;

        // Try Zoho Inventory first, fall back to Zakya/Books if bills scope not authorized
        let usedInventory = false;
        const inventory = new ZohoInventoryClient();
        const inventoryReady = await inventory.init();

        if (inventoryReady) {
          try {
            source = "inventory";
            const bills = await inventory.listAllBills(billsFromDate, todayStr);
            apiCalls += Math.ceil(bills.length / 200) || 1;
            usedInventory = true;

            const totalFromApi = bills.length;
            const billNumbers = bills.map((b) => b.bill_number);
            const existingBills = billNumbers.length > 0
              ? await prisma.vendorBill.findMany({
                  where: { billNo: { in: billNumbers } },
                  select: { billNo: true },
                })
              : [];
            const existingSet = new Set(existingBills.map((b) => b.billNo));
            const newBills = bills.filter((b) => !existingSet.has(b.bill_number));

            if (newBills.length === 0 && totalFromApi === 0) {
              errors.push(`Zoho Inventory returned 0 bills for ${billsFromDate} to ${todayStr}`);
            } else if (newBills.length === 0 && totalFromApi > 0) {
              errors.push(`${totalFromApi} bills from API but all already imported (${existingSet.size} in DB). Sample: ${billNumbers.slice(0, 3).join(", ")}`);
            }

            if (newBills.length > 0) {
              const details = await inventory.getBillDetails(newBills.map((b) => b.bill_id));
              detailCalls = newBills.length;
              apiCalls += detailCalls;
              const detailMap = new Map(details.map((d) => [d.bill_id, d.line_items]));

              await prisma.$transaction(
                newBills.map((bill) =>
                  prisma.zohoPullPreview.create({
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
                        lineItems: (detailMap.get(bill.bill_id) || []).map((li) => ({
                          name: li.name,
                          sku: li.sku,
                          quantity: li.quantity,
                          rate: li.rate,
                          itemTotal: li.item_total,
                        })),
                      },
                    },
                  })
                )
              );
              billsNew = newBills.length;
            }
          } catch (invErr) {
            // Inventory bills not authorized — fall back to Zakya/Books
            usedInventory = false;
            source = "none";
          }
        }

        // Fallback: Zakya POS → Books (if Inventory not available or bills scope missing)
        if (!usedInventory) {
          const zakya = new ZakyaClient();
          const posReady = await zakya.init();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let client: any = null;
          if (posReady) { client = zakya; source = "pos"; }
          else {
            const zoho = new ZohoClient();
            if (await zoho.init()) { client = zoho; source = "books"; }
          }

          if (!client) {
            return successResponse({ step: "bills", source: "skipped", billsNew: 0, apiCalls: 0, errors: ["No source connected for bills"] });
          }

          const bills = await client.listAllBills(billsFromDate, todayStr);
          apiCalls += Math.ceil(bills.length / 200) || 1;

          const billNumbers = bills.map((b: { bill_number: string }) => b.bill_number);
          const existingBills = await prisma.vendorBill.findMany({
            where: { billNo: { in: billNumbers } },
            select: { billNo: true },
          });
          const existingSet = new Set(existingBills.map((b) => b.billNo));
          const newBills = bills.filter((b: { bill_number: string }) => !existingSet.has(b.bill_number));

          if (newBills.length > 0) {
            await prisma.$transaction(
              newBills.map((bill: { bill_id: string; bill_number: string; vendor_name: string; date: string; due_date: string; total: number; balance: number; status: string }) =>
                prisma.zohoPullPreview.create({
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
                      lineItems: [],
                    },
                  },
                })
              )
            );
            billsNew = newBills.length;
          }
        }
      } catch (e) {
        errors.push(`Bills: ${e instanceof Error ? e.message : "Unknown"}`);
      }

      return successResponse({ step: "bills", source, billsNew, apiCalls, detailCalls, errors });
    }

    // ─── INVOICES: via Zakya POS (fallback Books) ───
    if (step === "invoices") {
      let invoicesNew = 0;
      let apiCalls = 0;
      let detailCalls = 0;
      const errors: string[] = [];
      let source = "none";

      try {
        // Try Zakya POS first
        const zakya = new ZakyaClient();
        const posReady = await zakya.init();

        // Determine which client and source to use
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let client: any = null;
        if (posReady) {
          client = zakya;
          source = "pos";
        } else {
          const zoho = new ZohoClient();
          const booksReady = await zoho.init();
          if (booksReady) {
            client = zoho;
            source = "books";
          }
        }

        if (!client) {
          return successResponse({ step: "invoices", source: "skipped", invoicesNew: 0, apiCalls: 0, errors: ["No source connected"] });
        }

        const invoicesFromDate = fromDate || todayStr;
        const invoices = await client.listAllInvoices(invoicesFromDate, todayStr);
        apiCalls += Math.ceil(invoices.length / 200) || 1;

        // Batch check existing invoices in one query
        const invoiceNumbers = invoices
          .filter((inv: { status: string }) => inv.status !== "void")
          .map((inv: { invoice_number: string }) => inv.invoice_number);
        const existingInvoices = await prisma.delivery.findMany({
          where: { invoiceNo: { in: invoiceNumbers } },
          select: { invoiceNo: true },
        });
        const existingInvSet = new Set(existingInvoices.map((d) => d.invoiceNo));
        const newInvoices = invoices.filter(
          (inv: { status: string; invoice_number: string }) => inv.status !== "void" && !existingInvSet.has(inv.invoice_number)
        );

        // Batch create all previews in one transaction
        if (newInvoices.length > 0) {
          await prisma.$transaction(
            newInvoices.map((invoice: { invoice_id: string; invoice_number: string; customer_name: string; phone?: string; date: string; total: number; balance: number; status: string }) =>
              prisma.zohoPullPreview.create({
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
                    salesPerson: "",
                    lineItems: [],
                  },
                },
              })
            )
          );
          invoicesNew = newInvoices.length;
        }
      } catch (e) {
        errors.push(`Invoices: ${e instanceof Error ? e.message : "Unknown"}`);
      }

      return successResponse({ step: "invoices", source, invoicesNew, apiCalls, errors });
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

      // Update lastSyncAt for all connected sources
      await prisma.zohoConfig.update({ where: { id: "singleton" }, data: { lastSyncAt: new Date() } }).catch(() => {});
      await prisma.zakyaConfig.update({ where: { id: "singleton" }, data: { lastSyncAt: new Date() } }).catch(() => {});
      await prisma.zohoInventoryConfig.update({ where: { id: "singleton" }, data: { lastSyncAt: new Date() } }).catch(() => {});

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
