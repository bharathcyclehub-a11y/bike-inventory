export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

// POST — approve or reject a pull
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(["ADMIN", "SUPERVISOR", "INWARDS_CLERK", "OUTWARDS_CLERK", "ACCOUNTS_MANAGER"]);
    const body = await req.json();
    const { pullId, action, entityType, previewIds } = body as {
      pullId: string; action: "approve" | "reject"; entityType?: string; previewIds?: string[];
    };

    if (!pullId || !["approve", "reject"].includes(action)) {
      return errorResponse("pullId and action (approve/reject) required", 400);
    }

    const pullLog = await prisma.zohoPullLog.findUnique({ where: { pullId } });
    if (!pullLog) return errorResponse("Pull not found", 404);
    if (pullLog.status !== "PENDING_REVIEW" && pullLog.status !== "PARTIAL") {
      return errorResponse(`Pull already ${pullLog.status.toLowerCase()}`, 400);
    }

    // Filter: specific IDs > entity type > all pending
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let previewFilter: any = { pullId, status: "PENDING" };
    if (previewIds && previewIds.length > 0) {
      previewFilter = { pullId, status: "PENDING", id: { in: previewIds } };
    } else if (entityType) {
      previewFilter.entityType = entityType;
    }

    const previews = await prisma.zohoPullPreview.findMany({ where: previewFilter });

    if (action === "reject") {
      await prisma.zohoPullPreview.updateMany({
        where: previewFilter,
        data: { status: "REJECTED", reviewedAt: new Date(), reviewedById: user.id },
      });
      // Only mark pull as rejected if ALL previews are now rejected
      const remaining = await prisma.zohoPullPreview.count({ where: { pullId, status: "PENDING" } });
      if (remaining === 0) {
        await prisma.zohoPullLog.update({
          where: { pullId },
          data: { status: "REJECTED", approvedAt: new Date() },
        });
      }
      return successResponse({ action: "rejected", count: previews.length, entityType: entityType || "all" });
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

          // Pre-check: find all products for line items BEFORE creating bill
          const missingItems: string[] = [];
          const matchedProducts: Array<{ li: typeof lineItems[0]; product: { id: string; currentStock: number } }> = [];

          for (const li of lineItems) {
            const product = await prisma.product.findFirst({
              where: li.sku ? { sku: li.sku } : { name: { contains: li.name, mode: "insensitive" } },
              select: { id: true, currentStock: true },
            });
            if (!product) {
              missingItems.push(li.sku ? `${li.name} (SKU: ${li.sku})` : li.name);
            } else {
              matchedProducts.push({ li, product });
            }
          }

          // Block if any line items don't have matching products
          if (missingItems.length > 0) {
            results.errors.push(
              `Bill ${d.billNumber}: ${missingItems.length} item(s) not found — import them first: ${missingItems.slice(0, 5).join(", ")}${missingItems.length > 5 ? ` +${missingItems.length - 5} more` : ""}`
            );
            continue;
          }

          // Calculate due date: use Zoho's dueDate unless it equals billDate (missing), then use vendor's payment terms
          const billDate = new Date(String(d.date));
          let dueDate = new Date(String(d.dueDate));
          if (dueDate.toISOString().slice(0, 10) === billDate.toISOString().slice(0, 10)) {
            dueDate = new Date(billDate);
            dueDate.setDate(dueDate.getDate() + (vendor.paymentTermDays || 30));
          }

          await prisma.vendorBill.create({
            data: {
              billNo: String(d.billNumber),
              vendorId: vendor.id,
              billDate,
              dueDate,
              amount: total,
              paidAmount: total - balance,
              status: balance === 0 ? "PAID" : balance < total ? "PARTIALLY_PAID" : "PENDING",
            },
          });

          // Create UNVERIFIED inward transactions for line items (all products verified above)
          for (const { li, product } of matchedProducts) {
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

    // Check if any previews are still pending (partial approval by entity type)
    const remainingPending = await prisma.zohoPullPreview.count({ where: { pullId, status: "PENDING" } });
    const newStatus = remainingPending > 0 ? "PARTIAL" : (results.errors.length > 0 ? "PARTIAL" : "APPROVED");

    await prisma.zohoPullLog.update({
      where: { pullId },
      data: { status: newStatus, approvedAt: remainingPending === 0 ? new Date() : undefined },
    });

    return successResponse({
      action: "approved",
      entityType: entityType || "all",
      remainingPending,
      ...results,
    });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Approval failed", 500);
  }
}
