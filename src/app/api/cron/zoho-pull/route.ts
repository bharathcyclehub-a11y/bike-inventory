export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ZohoClient } from "@/lib/zoho";
import { successResponse, errorResponse } from "@/lib/api-utils";

// Vercel Cron Job: Daily at 1 PM IST (07:30 UTC)
// Incremental pull — only yesterday's data. ~10-20 API calls/day.
export async function GET(req: NextRequest) {
  try {
    // Verify cron secret (Vercel sends this header for cron jobs)
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      return errorResponse("CRON_SECRET not configured", 500);
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
      return errorResponse("Unauthorized", 401);
    }

    // --- Sync Lock: prevent double-run ---
    const runningSync = await prisma.syncLog.findFirst({
      where: { status: "running", syncType: "cron-pull" },
      orderBy: { startedAt: "desc" },
    });
    if (runningSync) {
      // If stuck for over 10 min, mark as failed and continue
      const stuckMinutes = (Date.now() - new Date(runningSync.startedAt).getTime()) / 60000;
      if (stuckMinutes < 10) {
        return errorResponse("Sync already in progress", 409);
      }
      await prisma.syncLog.update({
        where: { id: runningSync.id },
        data: { status: "failed", completedAt: new Date(), errors: JSON.stringify(["Timed out after 10 min"]) },
      });
    }

    // Create running log
    const syncLog = await prisma.syncLog.create({
      data: { syncType: "cron-pull", status: "running", triggeredBy: "cron" },
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

    // Calculate yesterday's date (IST = UTC+5:30)
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffset);
    const istYesterday = new Date(istNow);
    istYesterday.setDate(istYesterday.getDate() - 1);
    const yesterday = istYesterday.toISOString().slice(0, 10); // YYYY-MM-DD

    const results: Record<string, { imported: number; skipped: number; failed: number; errors?: string[] }> = {};
    const allErrors: string[] = [];

    // --- Step 1: Pull Contacts (Vendors) — ~1 API call ---
    try {
      const contacts = await zoho.listAllContacts(yesterday);
      const vendors = contacts.filter((c) => c.contact_type === "vendor");
      let imported = 0, skipped = 0, failed = 0;

      for (const contact of vendors) {
        try {
          const existing = await prisma.vendor.findFirst({
            where: { name: { equals: contact.contact_name, mode: "insensitive" } },
          });
          if (existing) {
            // Update existing vendor with latest info
            await prisma.vendor.update({
              where: { id: existing.id },
              data: {
                gstin: contact.gst_no || existing.gstin,
                email: contact.email || existing.email,
                phone: contact.phone || existing.phone,
                city: contact.billing_address?.city || existing.city,
                state: contact.billing_address?.state || existing.state,
              },
            });
            skipped++;
            continue;
          }

          const code = contact.contact_name
            .replace(/[^a-zA-Z0-9]/g, "")
            .substring(0, 6)
            .toUpperCase() + String(Date.now()).slice(-4);

          await prisma.vendor.create({
            data: {
              name: contact.contact_name,
              code,
              gstin: contact.gst_no || null,
              email: contact.email || null,
              phone: contact.phone || null,
              city: contact.billing_address?.city || null,
              state: contact.billing_address?.state || null,
            },
          });
          imported++;
        } catch (e) {
          failed++;
          allErrors.push(`Contact ${contact.contact_name}: ${e instanceof Error ? e.message : "Unknown"}`);
        }
      }
      results.contacts = { imported, skipped, failed };
    } catch (e) {
      results.contacts = { imported: 0, skipped: 0, failed: -1 };
      allErrors.push(`Contacts step failed: ${e instanceof Error ? e.message : "Unknown"}`);
    }

    // --- Step 2: Pull Items (Products) — ~1-2 API calls ---
    try {
      const items = await zoho.listAllItems(undefined, yesterday);
      let imported = 0, skipped = 0, failed = 0;

      let defaultCategory = await prisma.category.findFirst({ where: { name: "Imported" } });
      if (!defaultCategory) {
        defaultCategory = await prisma.category.create({
          data: { name: "Imported", description: "Items imported from Zoho" },
        });
      }
      let defaultBrand = await prisma.brand.findFirst({ where: { name: "Imported" } });
      if (!defaultBrand) {
        defaultBrand = await prisma.brand.create({ data: { name: "Imported" } });
      }

      for (const item of items) {
        try {
          const zohoItem = item as Record<string, unknown>;

          if (item.sku) {
            const existing = await prisma.product.findFirst({ where: { sku: item.sku } });
            if (existing) {
              // Update existing product with latest price/HSN/GST
              await prisma.product.update({
                where: { id: existing.id },
                data: {
                  costPrice: Number(zohoItem.purchase_rate || existing.costPrice),
                  sellingPrice: Number(zohoItem.rate || existing.sellingPrice),
                  mrp: Number(zohoItem.rate || existing.mrp),
                  gstRate: Number(zohoItem.tax_percentage || existing.gstRate),
                  hsnCode: String(zohoItem.hsn_or_sac || existing.hsnCode || ""),
                },
              });
              skipped++;
              continue;
            }
          }

          const sku = (item.sku || `ZOHO-${String(Date.now()).slice(-6)}`).substring(0, 50);
          await prisma.product.create({
            data: {
              sku,
              name: item.name,
              categoryId: defaultCategory.id,
              brandId: defaultBrand.id,
              type: "SPARE_PART",
              costPrice: Number(zohoItem.purchase_rate || 0),
              sellingPrice: Number(zohoItem.rate || 0),
              mrp: Number(zohoItem.rate || 0),
              gstRate: Number(zohoItem.tax_percentage || 18),
              hsnCode: String(zohoItem.hsn_or_sac || ""),
              zohoItemId: item.item_id || null,
            },
          });
          imported++;
        } catch (e) {
          failed++;
          allErrors.push(`Item ${item.name}: ${e instanceof Error ? e.message : "Unknown"}`);
        }
      }
      results.items = { imported, skipped, failed };
    } catch (e) {
      results.items = { imported: 0, skipped: 0, failed: -1 };
      allErrors.push(`Items step failed: ${e instanceof Error ? e.message : "Unknown"}`);
    }

    // --- Step 3: Pull Bills → Inward Transactions (UNVERIFIED) ---
    try {
      // Only yesterday's bills
      const bills = await zoho.listAllBills(yesterday, yesterday);
      let imported = 0, skipped = 0, failed = 0;

      const adminUser = await prisma.user.findFirst({ where: { role: "ADMIN" } });
      const userId = adminUser?.id || "system";

      for (const bill of bills) {
        try {
          // Deduplication: skip bills already in DB
          const existingBill = await prisma.vendorBill.findFirst({
            where: { billNo: bill.bill_number },
          });
          if (existingBill) {
            skipped++;
            continue;
          }

          const vendor = await prisma.vendor.findFirst({
            where: { name: { equals: bill.vendor_name, mode: "insensitive" } },
          });
          if (!vendor) {
            skipped++;
            allErrors.push(`Bill ${bill.bill_number}: vendor "${bill.vendor_name}" not found`);
            continue;
          }

          // Create VendorBill
          await prisma.vendorBill.create({
            data: {
              billNo: bill.bill_number,
              vendorId: vendor.id,
              billDate: new Date(bill.date),
              dueDate: new Date(bill.due_date),
              amount: bill.total,
              paidAmount: bill.total - bill.balance,
              status: bill.balance === 0 ? "PAID" : bill.balance < bill.total ? "PARTIALLY_PAID" : "PENDING",
            },
          });

          // Fetch bill detail for line items (~1 API call each)
          try {
            await zoho.delay(1000); // 1s gap before detail call
            const detail = await zoho.getBill(bill.bill_id);
            const lineItems = detail.bill.line_items || [];

            for (const item of lineItems) {
              const product = await prisma.product.findFirst({
                where: item.sku
                  ? { sku: item.sku }
                  : { name: { contains: item.name, mode: "insensitive" } },
              });
              if (!product) continue;

              const previousStock = product.currentStock;
              await prisma.inventoryTransaction.create({
                data: {
                  type: "INWARD",
                  productId: product.id,
                  quantity: item.quantity,
                  previousStock,
                  newStock: previousStock, // Stock NOT added until Nithin verifies
                  referenceNo: bill.bill_number,
                  notes: `[ZOHO][UNVERIFIED] Vendor: ${bill.vendor_name} | ${item.name} x${item.quantity} @ ₹${item.rate}`,
                  userId,
                },
              });
            }
          } catch {
            allErrors.push(`Bill ${bill.bill_number}: failed to fetch line items`);
          }

          imported++;
        } catch (e) {
          failed++;
          allErrors.push(`Bill ${bill.bill_number}: ${e instanceof Error ? e.message : "Unknown"}`);
        }
      }
      results.bills = { imported, skipped, failed };
    } catch (e) {
      results.bills = { imported: 0, skipped: 0, failed: -1 };
      allErrors.push(`Bills step failed: ${e instanceof Error ? e.message : "Unknown"}`);
    }

    // --- Step 4: Sales Invoices → Delivery Records ---
    try {
      const invoices = await zoho.listAllInvoices(yesterday);
      let imported = 0, skipped = 0, failed = 0;

      for (const invoice of invoices) {
        try {
          const existing = await prisma.delivery.findFirst({
            where: { invoiceNo: invoice.invoice_number },
          });
          if (existing) { skipped++; continue; }

          // Skip unpaid invoices
          if (invoice.balance > 0) { skipped++; continue; }

          // Fetch invoice detail for line items
          let lineItems: Array<{ name: string; sku: string; quantity: number; rate: number; itemTotal: number; serialNumbers: string[] }> = [];
          try {
            await zoho.delay(1000);
            const detail = await zoho.getInvoice(invoice.invoice_id);
            lineItems = (detail.invoice.line_items || []).map((item) => ({
              name: item.name,
              sku: item.sku,
              quantity: item.quantity,
              rate: item.rate,
              itemTotal: item.item_total,
              serialNumbers: item.serial_numbers || [],
            }));
          } catch {
            allErrors.push(`Invoice ${invoice.invoice_number}: failed to fetch line items`);
          }

          await prisma.delivery.create({
            data: {
              invoiceNo: invoice.invoice_number,
              zohoInvoiceId: invoice.invoice_id,
              invoiceDate: new Date(invoice.date),
              invoiceAmount: invoice.total,
              customerName: invoice.customer_name,
              customerPhone: invoice.phone || null,
              status: "PENDING",
              lineItems: lineItems.length > 0 ? lineItems : undefined,
            },
          });
          imported++;
        } catch (e) {
          failed++;
          allErrors.push(`Invoice ${invoice.invoice_number}: ${e instanceof Error ? e.message : "Unknown"}`);
        }
      }
      results.invoices = { imported, skipped, failed };
    } catch (e) {
      results.invoices = { imported: 0, skipped: 0, failed: -1 };
      allErrors.push(`Invoices step failed: ${e instanceof Error ? e.message : "Unknown"}`);
    }

    // --- Finalize sync log ---
    const totalImported = Object.values(results).reduce((s, r) => s + r.imported, 0);
    const totalFailed = Object.values(results).reduce((s, r) => s + Math.max(0, r.failed), 0);
    const totalItems = Object.values(results).reduce((s, r) => s + r.imported + r.skipped, 0);

    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: totalFailed > 0 ? "partial" : "success",
        totalItems,
        synced: totalImported,
        failed: totalFailed,
        errors: allErrors.length > 0 ? JSON.stringify(allErrors.slice(0, 20)) : null,
        completedAt: new Date(),
      },
    });

    // Update last sync time
    await prisma.zohoConfig.update({
      where: { id: "singleton" },
      data: { lastSyncAt: new Date() },
    }).catch(() => {});

    return successResponse({
      syncType: "cron-pull",
      date: yesterday,
      time: new Date().toISOString(),
      results,
      errors: allErrors.slice(0, 10),
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Cron pull failed", 500);
  }
}
