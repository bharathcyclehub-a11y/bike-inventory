export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ZohoClient } from "@/lib/zoho";
import { successResponse, errorResponse } from "@/lib/api-utils";

// Vercel Cron Job: Daily pull from Zoho Books at 8 PM IST
// Pulls: contacts (vendors), items (products), bills
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

    const zoho = new ZohoClient();
    const ready = await zoho.init();
    if (!ready) {
      return errorResponse("Zoho not connected", 400);
    }

    const results: Record<string, { imported: number; skipped: number; failed: number }> = {};

    // --- Pull Contacts (Vendors) ---
    try {
      const allContacts = await zoho.listAllContacts();
      const vendors = allContacts.filter((c) => c.contact_type === "vendor");
      let imported = 0, skipped = 0, failed = 0;

      for (const contact of vendors) {
        try {
          const existing = await prisma.vendor.findFirst({
            where: { name: { equals: contact.contact_name, mode: "insensitive" } },
          });
          if (existing) { skipped++; continue; }

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
        } catch { failed++; }
      }
      results.contacts = { imported, skipped, failed };
    } catch {
      results.contacts = { imported: 0, skipped: 0, failed: -1 };
    }

    // --- Pull Items (Products) ---
    try {
      const items = await zoho.listAllItems();
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
          if (item.sku) {
            const existing = await prisma.product.findFirst({ where: { sku: item.sku } });
            if (existing) { skipped++; continue; }
          }
          const zohoItem = item as Record<string, unknown>;
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
            },
          });
          imported++;
        } catch { failed++; }
      }
      results.items = { imported, skipped, failed };
    } catch {
      results.items = { imported: 0, skipped: 0, failed: -1 };
    }

    // --- Pull Bills + Create Inward Transactions ---
    try {
      // Pull bills from April 2026 onwards (new financial year)
      const bills = await zoho.listAllBills("2026-04-01");
      let imported = 0, skipped = 0, failed = 0;

      const adminUser = await prisma.user.findFirst({ where: { role: "ADMIN" } });
      if (!adminUser) return errorResponse("No admin user found for sync", 500);
      const userId = adminUser.id;

      for (const bill of bills) {
        try {
          // Skip bills already imported
          const existingBill = await prisma.vendorBill.findFirst({
            where: { billNo: bill.bill_number },
          });

          const vendor = await prisma.vendor.findFirst({
            where: { name: { equals: bill.vendor_name, mode: "insensitive" } },
          });
          if (!vendor) { skipped++; continue; }

          // Create VendorBill if not exists
          if (!existingBill) {
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
          }

          // Check if inward transactions already exist for this bill
          const existingInward = await prisma.inventoryTransaction.findFirst({
            where: {
              type: "INWARD",
              referenceNo: bill.bill_number,
              notes: { contains: "[ZOHO]" },
            },
          });
          if (existingInward) { skipped++; continue; }

          // Fetch bill details with line items
          try {
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
              // Don't add stock yet — staff must verify first
              await prisma.inventoryTransaction.create({
                data: {
                  type: "INWARD",
                  productId: product.id,
                  quantity: item.quantity,
                  previousStock,
                  newStock: previousStock, // Stock NOT added until verified
                  referenceNo: bill.bill_number,
                  notes: `[ZOHO][UNVERIFIED] Vendor: ${bill.vendor_name} | ${item.name} x${item.quantity} @ ₹${item.rate}`,
                  userId,
                },
              });
            }
          } catch {
            // If can't fetch bill details, skip line items
          }

          imported++;
        } catch { failed++; }
      }
      results.bills = { imported, skipped, failed };
    } catch {
      results.bills = { imported: 0, skipped: 0, failed: -1 };
    }

    // --- Sales Invoices → Outward Transactions ---
    // DISABLED: Outward pull paused until stock count baseline is complete.
    // Stock must exist in the app before outward deductions make sense.
    // Will be re-enabled after physical inventory count is done.
    results.invoices = { imported: 0, skipped: 0, failed: 0 };

    // Log the sync
    await prisma.syncLog.create({
      data: {
        syncType: "cron-pull",
        status: "success",
        totalItems: Object.values(results).reduce((s, r) => s + r.imported + r.skipped, 0),
        synced: Object.values(results).reduce((s, r) => s + r.imported, 0),
        failed: Object.values(results).reduce((s, r) => s + Math.max(0, r.failed), 0),
        completedAt: new Date(),
      },
    });

    // Update last sync time
    await prisma.zohoConfig.update({
      where: { id: "singleton" },
      data: { lastSyncAt: new Date() },
    }).catch(() => {}); // ignore if not connected

    return successResponse({
      syncType: "cron-pull",
      time: new Date().toISOString(),
      results,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Cron pull failed", 500);
  }
}
