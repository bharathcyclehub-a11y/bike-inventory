export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { ZohoClient } from "@/lib/zoho";
import { errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

// POST — manually trigger a Zoho pull with SSE progress streaming
export async function POST() {
  try {
    await requireAuth(["ADMIN", "SUPERVISOR"]);

    // Sync lock — prevent double-run (auto-clear if stuck >5 min)
    const runningSync = await prisma.syncLog.findFirst({
      where: { status: "running", syncType: "cron-pull" },
      orderBy: { startedAt: "desc" },
    });
    if (runningSync) {
      const stuckMinutes = (Date.now() - new Date(runningSync.startedAt).getTime()) / 60000;
      if (stuckMinutes < 5) return errorResponse("Sync already in progress", 409);
      await prisma.syncLog.update({
        where: { id: runningSync.id },
        data: { status: "failed", completedAt: new Date(), errors: JSON.stringify(["Timed out"]) },
      });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        function send(data: Record<string, unknown>) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        }

        try {
          send({ step: "init", message: "Starting sync...", progress: 0 });

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
            send({ step: "error", message: "Zoho not connected", progress: 0 });
            controller.close();
            return;
          }

          send({ step: "connected", message: "Connected to Zoho", progress: 5 });

          const config = await prisma.zohoConfig.findUnique({ where: { id: "singleton" } });
          const lastSyncAt = config?.lastSyncAt?.toISOString().slice(0, 10) || undefined;

          const pullId = `pull-${Date.now()}`;
          const allErrors: string[] = [];
          let apiCalls = 0;
          let contactsNew = 0, itemsNew = 0, billsNew = 0, invoicesNew = 0;

          // ─── STEP 1: Items (5% → 30%) ───
          send({ step: "items", message: "Fetching items from Zoho...", progress: 10 });
          try {
            const items = await zoho.listAllItems(undefined, lastSyncAt);
            apiCalls += Math.ceil(items.length / 200) || 1;
            send({ step: "items", message: `Found ${items.length} items, checking for new...`, progress: 15 });

            for (let i = 0; i < items.length; i++) {
              const item = items[i];
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
          send({ step: "items-done", message: `Items: ${itemsNew} new`, progress: 30, itemsNew });

          // ─── STEP 2: Contacts (30% → 50%) ───
          send({ step: "contacts", message: "Fetching vendors from Zoho...", progress: 35 });
          try {
            const contacts = await zoho.listAllContacts(lastSyncAt);
            apiCalls += Math.ceil(contacts.length / 200) || 1;
            const vendors = contacts.filter((c) => c.contact_type === "vendor");
            send({ step: "contacts", message: `Found ${vendors.length} vendors, checking for new...`, progress: 40 });

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
          send({ step: "contacts-done", message: `Vendors: ${contactsNew} new`, progress: 50, contactsNew });

          // ─── STEP 3: Bills (50% → 75%) ───
          send({ step: "bills", message: "Fetching bills from Zoho...", progress: 55 });
          try {
            const bills = await zoho.listAllBills(lastSyncAt);
            apiCalls += Math.ceil(bills.length / 200) || 1;

            const newBills: typeof bills = [];
            for (const bill of bills) {
              const existingBill = await prisma.vendorBill.findFirst({
                where: { billNo: bill.bill_number },
              });
              if (!existingBill) newBills.push(bill);
            }

            send({ step: "bills", message: `${newBills.length} new bills, fetching details...`, progress: 60 });

            for (let i = 0; i < newBills.length; i++) {
              const bill = newBills[i];
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

              if (newBills.length > 1) {
                const billProgress = 60 + Math.round(((i + 1) / newBills.length) * 15);
                send({ step: "bills", message: `Bills: ${i + 1}/${newBills.length} processed...`, progress: billProgress });
              }
            }
          } catch (e) {
            allErrors.push(`Bills: ${e instanceof Error ? e.message : "Unknown"}`);
          }
          send({ step: "bills-done", message: `Bills: ${billsNew} new`, progress: 75, billsNew });

          // ─── STEP 4: Invoices (75% → 95%) ───
          send({ step: "invoices", message: "Fetching invoices from Zoho...", progress: 78 });
          try {
            const invoices = await zoho.listAllInvoices(lastSyncAt);
            apiCalls += Math.ceil(invoices.length / 200) || 1;

            const newInvoices: typeof invoices = [];
            for (const invoice of invoices) {
              if (invoice.status === "void") continue;
              const existing = await prisma.delivery.findFirst({
                where: { invoiceNo: invoice.invoice_number },
              });
              if (!existing) newInvoices.push(invoice);
            }

            send({ step: "invoices", message: `${newInvoices.length} new invoices, fetching details...`, progress: 82 });

            for (let i = 0; i < newInvoices.length; i++) {
              const invoice = newInvoices[i];
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

              if (newInvoices.length > 1) {
                const invProgress = 82 + Math.round(((i + 1) / newInvoices.length) * 13);
                send({ step: "invoices", message: `Invoices: ${i + 1}/${newInvoices.length} processed...`, progress: invProgress });
              }
            }
          } catch (e) {
            allErrors.push(`Invoices: ${e instanceof Error ? e.message : "Unknown"}`);
          }
          send({ step: "invoices-done", message: `Invoices: ${invoicesNew} new`, progress: 95, invoicesNew });

          // ─── Finalize ───
          send({ step: "saving", message: "Saving pull log...", progress: 97 });

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

          send({
            step: "done",
            message: totalNew > 0
              ? `Done! ${itemsNew} items, ${contactsNew} vendors, ${billsNew} bills, ${invoicesNew} invoices ready for review.`
              : "Done! No new data — everything is already synced.",
            progress: 100,
            itemsNew,
            contactsNew,
            billsNew,
            invoicesNew,
            apiCalls,
            errors: allErrors.slice(0, 5),
          });
        } catch (e) {
          send({ step: "error", message: e instanceof Error ? e.message : "Pull failed", progress: 0 });
        }

        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Manual pull failed", 500);
  }
}
