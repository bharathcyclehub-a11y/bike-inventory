export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

// POST — approve or reject a pull
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(["ADMIN", "SUPERVISOR"]);
    const body = await req.json();
    const { pullId, action } = body as { pullId: string; action: "approve" | "reject" };

    if (!pullId || !["approve", "reject"].includes(action)) {
      return errorResponse("pullId and action (approve/reject) required", 400);
    }

    const pullLog = await prisma.zohoPullLog.findUnique({ where: { pullId } });
    if (!pullLog) return errorResponse("Pull not found", 404);
    if (pullLog.status !== "PENDING_REVIEW") return errorResponse(`Pull already ${pullLog.status.toLowerCase()}`, 400);

    const previews = await prisma.zohoPullPreview.findMany({
      where: { pullId, status: "PENDING" },
    });

    if (action === "reject") {
      await prisma.zohoPullPreview.updateMany({
        where: { pullId },
        data: { status: "REJECTED", reviewedAt: new Date(), reviewedById: user.id },
      });
      await prisma.zohoPullLog.update({
        where: { pullId },
        data: { status: "REJECTED", approvedAt: new Date() },
      });
      return successResponse({ action: "rejected", count: previews.length });
    }

    // ─── APPROVE: write to real tables ───
    const results = { contacts: 0, items: 0, bills: 0, invoices: 0, errors: [] as string[] };

    // Default category/brand for new items
    let defaultCategory = await prisma.category.findFirst({ where: { name: "Imported" } });
    if (!defaultCategory) {
      defaultCategory = await prisma.category.create({ data: { name: "Imported", description: "Items imported from Zoho" } });
    }
    let defaultBrand = await prisma.brand.findFirst({ where: { name: "Imported" } });
    if (!defaultBrand) {
      defaultBrand = await prisma.brand.create({ data: { name: "Imported" } });
    }

    const adminUser = await prisma.user.findFirst({ where: { role: "ADMIN" } });
    const systemUserId = adminUser?.id || user.id;

    for (const preview of previews) {
      const d = preview.data as Record<string, unknown>;
      try {
        if (preview.entityType === "contact") {
          const code = String(d.name || "")
            .replace(/[^a-zA-Z0-9]/g, "")
            .substring(0, 6)
            .toUpperCase() + String(Date.now()).slice(-4);

          await prisma.vendor.create({
            data: {
              name: String(d.name),
              code,
              gstin: String(d.gstin || "") || null,
              email: String(d.email || "") || null,
              phone: String(d.phone || "") || null,
              city: String(d.city || "") || null,
              state: String(d.state || "") || null,
            },
          });
          results.contacts++;
        } else if (preview.entityType === "item") {
          const sku = (String(d.sku || "") || `ZOHO-${String(Date.now()).slice(-6)}`).substring(0, 50);

          // Double-check dedup
          const exists = await prisma.product.findFirst({ where: { sku } });
          if (exists) continue;

          await prisma.product.create({
            data: {
              sku,
              name: String(d.name),
              categoryId: defaultCategory.id,
              brandId: defaultBrand.id,
              type: "SPARE_PART",
              costPrice: Number(d.costPrice || 0),
              sellingPrice: Number(d.sellingPrice || 0),
              mrp: Number(d.sellingPrice || 0),
              gstRate: Number(d.gstRate || 18),
              hsnCode: String(d.hsnCode || ""),
              currentStock: 0, // App manages its own stock
              zohoItemId: preview.zohoId || null,
            },
          });
          results.items++;
        } else if (preview.entityType === "bill") {
          const lineItems = (d.lineItems as Array<{ name: string; sku: string; quantity: number; rate: number; itemTotal: number }>) || [];

          // Find vendor
          const vendor = await prisma.vendor.findFirst({
            where: { name: { equals: String(d.vendorName), mode: "insensitive" } },
          });
          if (!vendor) {
            results.errors.push(`Bill ${d.billNumber}: vendor "${d.vendorName}" not found`);
            continue;
          }

          // Dedup
          const exists = await prisma.vendorBill.findFirst({ where: { billNo: String(d.billNumber) } });
          if (exists) continue;

          const total = Number(d.total || 0);
          const balance = Number(d.balance || 0);

          await prisma.vendorBill.create({
            data: {
              billNo: String(d.billNumber),
              vendorId: vendor.id,
              billDate: new Date(String(d.date)),
              dueDate: new Date(String(d.dueDate)),
              amount: total,
              paidAmount: total - balance,
              status: balance === 0 ? "PAID" : balance < total ? "PARTIALLY_PAID" : "PENDING",
            },
          });

          // Create UNVERIFIED inward transactions for line items
          for (const li of lineItems) {
            const product = await prisma.product.findFirst({
              where: li.sku ? { sku: li.sku } : { name: { contains: li.name, mode: "insensitive" } },
            });
            if (!product) continue;

            await prisma.inventoryTransaction.create({
              data: {
                type: "INWARD",
                productId: product.id,
                quantity: li.quantity,
                previousStock: product.currentStock,
                newStock: product.currentStock, // Stock NOT added until verified
                referenceNo: String(d.billNumber),
                notes: `[ZOHO][UNVERIFIED] Vendor: ${d.vendorName} | ${li.name} x${li.quantity} @ ₹${li.rate}`,
                userId: systemUserId,
              },
            });
          }
          results.bills++;
        } else if (preview.entityType === "invoice") {
          const lineItems = (d.lineItems as Array<{ name: string; sku: string; quantity: number; rate: number; itemTotal: number }>) || [];

          // Dedup
          const exists = await prisma.delivery.findFirst({ where: { invoiceNo: String(d.invoiceNumber) } });
          if (exists) continue;

          await prisma.delivery.create({
            data: {
              invoiceNo: String(d.invoiceNumber),
              zohoInvoiceId: preview.zohoId,
              invoiceDate: new Date(String(d.date)),
              invoiceAmount: Number(d.total || 0),
              customerName: String(d.customerName),
              customerPhone: String(d.phone || "") || null,
              salesPerson: String(d.salesPerson || "") || null,
              status: "PENDING",
              lineItems: lineItems.length > 0 ? lineItems : undefined,
            },
          });
          results.invoices++;
        }

        await prisma.zohoPullPreview.update({
          where: { id: preview.id },
          data: { status: "APPROVED", reviewedAt: new Date(), reviewedById: user.id },
        });
      } catch (e) {
        results.errors.push(`${preview.entityType} ${preview.zohoId}: ${e instanceof Error ? e.message : "Unknown"}`);
      }
    }

    await prisma.zohoPullLog.update({
      where: { pullId },
      data: { status: results.errors.length > 0 ? "PARTIAL" : "APPROVED", approvedAt: new Date() },
    });

    return successResponse({
      action: "approved",
      ...results,
    });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Approval failed", 500);
  }
}
