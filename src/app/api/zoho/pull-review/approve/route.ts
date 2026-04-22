export const dynamic = "force-dynamic";
export const maxDuration = 60; // Approve step now fetches bill details from Zoho

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

// POST — approve or reject a pull
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(["ADMIN", "SUPERVISOR", "INWARDS_CLERK", "OUTWARDS_CLERK", "ACCOUNTS_MANAGER", "PURCHASE_MANAGER"]);
    const body = await req.json();
    const { pullId, action, entityType, previewIds, source } = body as {
      pullId: string; action: "approve" | "reject"; entityType?: string; previewIds?: string[]; source?: string;
    };

    if (!pullId || !["approve", "reject"].includes(action)) {
      return errorResponse("pullId and action (approve/reject) required", 400);
    }

    // Find or auto-create pullLog (handles case where finalize step failed)
    let pullLog = await prisma.zohoPullLog.findUnique({ where: { pullId } });
    if (!pullLog) {
      // Check that previews exist for this pullId before creating log
      const previewCount = await prisma.zohoPullPreview.count({ where: { pullId } });
      if (previewCount === 0) return errorResponse("Pull not found", 404);
      pullLog = await prisma.zohoPullLog.create({
        data: { pullId, billsNew: previewCount, apiCallsUsed: 0 },
      });
    }
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

    // Mirror Zoho categories — use exact category_name from Zoho, fallback to "Uncategorized"
    const categoryCache: Record<string, string> = {};
    async function resolveCategory(zohoCategoryName?: string): Promise<string> {
      const catName = (zohoCategoryName || "").trim() || "Uncategorized";
      if (!categoryCache[catName]) {
        let cat = await prisma.category.findFirst({ where: { name: catName } });
        if (!cat) cat = await prisma.category.create({ data: { name: catName, description: `Zoho category: ${catName}` } });
        categoryCache[catName] = cat.id;
      }
      return categoryCache[catName];
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

          // Resolve brand from Zoho data (free — comes from list API)
          let itemBrandId = defaultBrand.id;
          const zohoBrand = String(d.brand || "").trim();
          if (zohoBrand) {
            let brand = await prisma.brand.findFirst({ where: { name: { equals: zohoBrand, mode: "insensitive" } } });
            if (!brand) {
              brand = await prisma.brand.create({ data: { name: zohoBrand } });
            }
            itemBrandId = brand.id;
          }

          // Auto-classify product type from name
          const pName = String(d.name).toLowerCase();
          const autoType = /\bcycl|bicycl|bike\b/.test(pName) ? "BICYCLE"
            : /\btube|tyre|tire|brake|chain|spoke|pedal|gear|rim|handle|seat|mudguard|bell|lock|pump|light|carrier|stand|fork|derailleur|shifter|cassette|crank\b/.test(pName) ? "SPARE_PART"
            : "ACCESSORY";

          const itemCategoryId = await resolveCategory(String(d.categoryName || ""));

          await prisma.product.create({
            data: {
              sku,
              name: String(d.name),
              categoryId: itemCategoryId,
              brandId: itemBrandId,
              type: autoType,
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
          // Fetch line items from Zoho if not in preview data
          let lineItems = (d.lineItems as Array<{ name: string; sku: string; quantity: number; rate: number; itemTotal: number }>) || [];
          if (lineItems.length === 0 && preview.zohoId) {
            try {
              const { ZohoClient } = await import("@/lib/zoho");
              const zoho = new ZohoClient();
              if (await zoho.init()) {
                const detail = await zoho.getBill(preview.zohoId);
                lineItems = (detail.bill?.line_items || []).map((li) => ({
                  name: li.name, sku: li.sku || "", quantity: li.quantity, rate: li.rate, itemTotal: li.item_total,
                }));
              }
            } catch (e) {
              results.errors.push(`Bill ${d.billNumber}: failed to fetch details — ${e instanceof Error ? e.message : "Unknown"}`);
            }
          }

          // Find vendor — auto-create if not found
          let vendor = await prisma.vendor.findFirst({
            where: { name: { equals: String(d.vendorName), mode: "insensitive" } },
          });
          if (!vendor) {
            const code = String(d.vendorName || "")
              .replace(/[^a-zA-Z0-9]/g, "")
              .substring(0, 6)
              .toUpperCase() + String(Date.now()).slice(-4);
            vendor = await prisma.vendor.create({
              data: { name: String(d.vendorName), code },
            });
          }

          // Dedup
          const exists = await prisma.vendorBill.findFirst({ where: { billNo: String(d.billNumber) } });
          if (exists) continue;

          const total = Number(d.total || 0);
          const balance = Number(d.balance || 0);

          // Match products for line items, skipping any missing ones
          const matchedProducts: Array<{ li: typeof lineItems[0]; product: { id: string; currentStock: number } }> = [];

          for (const li of lineItems) {
            const product = await prisma.product.findFirst({
              where: li.sku ? { sku: li.sku } : { name: { contains: li.name, mode: "insensitive" } },
              select: { id: true, currentStock: true },
            });
            if (!product) {
              // Skip missing product — admin must create it manually via Items import
              const ref = li.sku || li.name;
              console.warn(`Product not found: ${ref} — skipping`);
              results.errors.push(`Bill ${d.billNumber}: product not found "${li.name}"${li.sku ? ` (${li.sku})` : ""} — skipped. Import the item first.`);
              continue;
            }
            matchedProducts.push({ li, product });
          }

          // Calculate due date: use Zoho's dueDate unless it equals billDate (missing), then use vendor's payment terms
          const billDate = new Date(String(d.date));
          let dueDate = new Date(String(d.dueDate));
          if (dueDate.toISOString().slice(0, 10) === billDate.toISOString().slice(0, 10)) {
            dueDate = new Date(billDate);
            dueDate.setDate(dueDate.getDate() + (vendor.paymentTermDays || 30));
          }

          const vendorBill = await prisma.vendorBill.create({
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

          // ─── Create InboundShipment (only from inventory/inbound flow, not accounting) ───
          if (source === "accounting") {
            results.bills++;
            await prisma.zohoPullPreview.update({
              where: { id: preview.id },
              data: { status: "APPROVED", reviewedAt: new Date(), reviewedById: user.id },
            });
            continue;
          }

          // Resolve brand from vendor (find most-used brand for this vendor, or create from vendor name)
          let shipmentBrandId: string;
          const vendorShipments = await prisma.inboundShipment.findMany({
            where: { lineItems: { some: { product: { is: { NOT: undefined } } } } },
            select: { brandId: true },
            orderBy: { createdAt: "desc" },
            take: 1,
          });
          if (vendorShipments.length > 0) {
            shipmentBrandId = vendorShipments[0].brandId;
          } else {
            // Find or create brand from vendor name
            const vendorName = String(d.vendorName).trim();
            let brand = await prisma.brand.findFirst({ where: { name: { equals: vendorName, mode: "insensitive" } } });
            if (!brand) {
              brand = await prisma.brand.create({ data: { name: vendorName } });
            }
            shipmentBrandId = brand.id;
          }

          // Look up brand lead time for expected delivery date
          const brandLeadTime = await prisma.brandLeadTime.findUnique({ where: { brandId: shipmentBrandId } });
          const leadDays = brandLeadTime?.leadDays || 7;
          const expectedDeliveryDate = new Date(billDate);
          expectedDeliveryDate.setDate(expectedDeliveryDate.getDate() + leadDays);

          // Generate shipment number: IB-YYYYMM-0001
          const now = new Date();
          const prefix = `IB-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
          const lastShipment = await prisma.inboundShipment.findFirst({
            where: { shipmentNo: { startsWith: prefix } },
            orderBy: { shipmentNo: "desc" },
            select: { shipmentNo: true },
          });
          const seq = lastShipment
            ? parseInt(lastShipment.shipmentNo.split("-").pop() || "0") + 1
            : 1;
          const shipmentNo = `${prefix}-${String(seq).padStart(4, "0")}`;

          const totalAmount = matchedProducts.reduce((s, { li }) => s + (li.itemTotal || li.rate * li.quantity), 0);

          // Auto-match pre-booked customers
          const waitingPreBookings = await prisma.preBooking.findMany({
            where: { status: "WAITING" },
          });

          const shipment = await prisma.inboundShipment.create({
            data: {
              shipmentNo,
              brandId: shipmentBrandId,
              billNo: String(d.billNumber),
              billDate,
              expectedDeliveryDate,
              totalAmount,
              totalItems: matchedProducts.length,
              createdById: systemUserId,
              vendorBillId: vendorBill.id,
              zohoBillId: preview.zohoId || null,
              lineItems: {
                create: matchedProducts.map(({ li, product }) => {
                  const preBookMatch = waitingPreBookings.find((pb) =>
                    li.name.toLowerCase().includes(pb.productName.toLowerCase().substring(0, 15))
                    || pb.productName.toLowerCase().includes(li.name.toLowerCase().substring(0, 15))
                  );
                  return {
                    productName: li.name,
                    productId: product.id,
                    sku: li.sku || null,
                    quantity: li.quantity,
                    rate: li.rate,
                    amount: li.itemTotal || li.rate * li.quantity,
                    preBookedCustomerName: preBookMatch?.customerName || null,
                    preBookedCustomerPhone: preBookMatch?.customerPhone || null,
                    preBookedInvoiceNo: preBookMatch?.zohoInvoiceNo || null,
                  };
                }),
              },
            },
            include: { lineItems: true },
          });

          // Update matched pre-bookings to MATCHED
          for (const sli of shipment.lineItems) {
            if (sli.preBookedInvoiceNo) {
              const pb = waitingPreBookings.find((p) => p.zohoInvoiceNo === sli.preBookedInvoiceNo);
              if (pb) {
                await prisma.preBooking.update({
                  where: { id: pb.id },
                  data: {
                    status: "MATCHED",
                    matchedShipmentId: shipment.id,
                    matchedLineItemId: sli.id,
                    expectedDate: expectedDeliveryDate,
                  },
                });
              }
            }
          }

          results.bills++;
        } else if (preview.entityType === "invoice") {
          let lineItems = (d.lineItems as Array<{ name: string; sku: string; quantity: number; rate: number; itemTotal: number }>) || [];
          let salesPerson = String(d.salesPerson || "");

          // Fetch invoice detail from Zoho for line items + salesperson
          if ((lineItems.length === 0 || !salesPerson) && preview.zohoId) {
            try {
              const { ZohoClient } = await import("@/lib/zoho");
              const zoho = new ZohoClient();
              if (await zoho.init()) {
                const detail = await zoho.getInvoice(preview.zohoId);
                const inv = detail.invoice;
                if (inv) {
                  if (lineItems.length === 0 && inv.line_items?.length) {
                    lineItems = inv.line_items.map((li) => ({
                      name: li.name, sku: li.sku || "", quantity: li.quantity, rate: li.rate, itemTotal: li.item_total,
                    }));
                  }
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  if (!salesPerson) salesPerson = (inv as any).salesperson_name || "";
                }
              }
            } catch (e) {
              results.errors.push(`Invoice ${d.invoiceNumber}: failed to fetch details — ${e instanceof Error ? e.message : "Unknown"}`);
            }
          }

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
              salesPerson: salesPerson || null,
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
