export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { deliveryUpdateSchema } from "@/lib/validations";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(["ADMIN", "SUPERVISOR", "OUTWARDS_CLERK"]);
    const { id } = await params;

    const delivery = await prisma.delivery.findUnique({
      where: { id },
      include: { verifiedBy: { select: { name: true } } },
    });

    if (!delivery) return errorResponse("Delivery not found", 404);

    // Check payment status from receivables
    let paymentStatus: { hasPending: boolean; balance: number; paidAmount: number; totalAmount: number } | null = null;
    try {
      const invoice = await prisma.customerInvoice.findFirst({
        where: { invoiceNo: delivery.invoiceNo },
        select: { amount: true, paidAmount: true, status: true },
      });
      if (invoice) {
        const balance = invoice.amount - invoice.paidAmount;
        paymentStatus = {
          hasPending: balance > 0,
          balance,
          paidAmount: invoice.paidAmount,
          totalAmount: invoice.amount,
        };
      }
    } catch { /* CustomerInvoice table might not exist yet */ }

    return successResponse({ ...delivery, paymentStatus });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch delivery", 500);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(["ADMIN", "SUPERVISOR", "OUTWARDS_CLERK"]);
    const { id } = await params;
    const body = await req.json();
    const data = deliveryUpdateSchema.parse(body);

    const preCheck = await prisma.delivery.findUnique({ where: { id } });
    if (!preCheck) return errorResponse("Delivery not found", 404);

    const result = await prisma.$transaction(async (tx) => {
      // Re-read inside transaction to prevent race conditions
      const existing = await tx.delivery.findUnique({ where: { id } });
      if (!existing) throw new Error("Delivery not found");

      // Status transition guards (inside transaction for atomicity)
      if (data.status) {
        const VALID: Record<string, string[]> = {
          PENDING: ["VERIFIED", "WALK_OUT", "SCHEDULED", "FLAGGED"],
          VERIFIED: ["WALK_OUT", "SCHEDULED", "PACKED"],
          SCHEDULED: ["OUT_FOR_DELIVERY", "VERIFIED", "PACKED"],
          PACKED: ["SHIPPED"],
          SHIPPED: ["IN_TRANSIT"],
          IN_TRANSIT: ["DELIVERED"],
          OUT_FOR_DELIVERY: ["DELIVERED"],
          FLAGGED: ["PENDING"],
          PREBOOKED: ["VERIFIED"],
          DELIVERED: [],
          WALK_OUT: [],
        };
        const allowed = VALID[existing.status] || [];
        if (!allowed.includes(data.status)) {
          throw new Error(`Cannot change from ${existing.status} to ${data.status}`);
        }
      }
      const updateData: Record<string, unknown> = {};

      // Copy simple fields
      if (data.customerAddress !== undefined) updateData.customerAddress = data.customerAddress;
      if (data.customerArea !== undefined) updateData.customerArea = data.customerArea;
      if (data.customerPincode !== undefined) updateData.customerPincode = data.customerPincode;
      if (data.customerPhone !== undefined) updateData.customerPhone = data.customerPhone;
      if (data.deliveryNotes !== undefined) updateData.deliveryNotes = data.deliveryNotes;
      if (data.notes !== undefined) updateData.notes = data.notes;
      if (data.scheduledDate) updateData.scheduledDate = new Date(data.scheduledDate);

      // Outstation & courier fields
      if (data.isOutstation !== undefined) updateData.isOutstation = data.isOutstation;
      if (data.courierName !== undefined) updateData.courierName = data.courierName;
      if (data.courierTrackingNo !== undefined) updateData.courierTrackingNo = data.courierTrackingNo;
      if (data.courierCost !== undefined) updateData.courierCost = data.courierCost;
      if (data.vehicleNo !== undefined) updateData.vehicleNo = data.vehicleNo;
      if (data.freeAccessories !== undefined) updateData.freeAccessories = data.freeAccessories;

      // WhatsApp tracking flags
      if (data.whatsAppScheduledSent !== undefined) updateData.whatsAppScheduledSent = data.whatsAppScheduledSent;
      if (data.whatsAppDispatchedSent !== undefined) updateData.whatsAppDispatchedSent = data.whatsAppDispatchedSent;
      if (data.whatsAppDeliveredSent !== undefined) updateData.whatsAppDeliveredSent = data.whatsAppDeliveredSent;

      // Invoice type tagging (Sales vs Service)
      if (data.invoiceType !== undefined) {
        updateData.invoiceType = data.invoiceType;
        // Service invoices exit the delivery pipeline — mark as DELIVERED (revenue only)
        if (data.invoiceType === "SERVICE" && existing.status === "PENDING") {
          updateData.status = "DELIVERED";
          updateData.deliveredAt = new Date();
          updateData.notes = (existing.notes || "") + " [SERVICE - no delivery needed]";
        }
      }

      if (data.status) {
        updateData.status = data.status;

        if (data.status === "VERIFIED") {
          updateData.verifiedAt = new Date();
          updateData.verifiedById = user.id;
        }

        if (data.status === "OUT_FOR_DELIVERY" || data.status === "SHIPPED") {
          updateData.dispatchedAt = new Date();
        }

        if (data.status === "FLAGGED") {
          updateData.flagReason = data.flagReason || "No reason provided";
          updateData.flaggedAt = new Date();
        }

        // Resolve flag
        if (data.status === "PENDING" && existing.status === "FLAGGED") {
          updateData.flagResolvedAt = new Date();
          updateData.flagResolvedBy = user.id;
        }

        // Stock deduction on WALK_OUT or DELIVERED
        if (data.status === "WALK_OUT" || data.status === "DELIVERED") {
          if (data.status === "DELIVERED") {
            updateData.deliveredAt = new Date();
          }

          // Parse line items and check stock availability at Bharath Cycle Hub only
          const items = (existing.lineItems as Array<{ name: string; sku: string; quantity: number; rate: number }>) || [];
          const outOfStockItems: string[] = [];

          for (const item of items) {
            if (!item.sku) continue;
            // Only match products in BCH store (not warehouse)
            const product = await tx.product.findFirst({
              where: {
                sku: item.sku,
                bin: { location: { startsWith: "Bharath Cycle Hub" } },
              },
              select: { id: true, name: true, currentStock: true },
            });
            if (!product) {
              // Product exists but not at BCH — treat as out of stock at store
              const anyProduct = await tx.product.findFirst({
                where: { sku: item.sku },
                select: { name: true },
              });
              if (anyProduct) {
                outOfStockItems.push(
                  `${anyProduct.name || item.name} — not available at Bharath Cycle Hub (check warehouse)`
                );
              }
              continue;
            }
            if (product.currentStock < item.quantity) {
              outOfStockItems.push(
                `${product.name || item.name} (need ${item.quantity}, have ${product.currentStock} at BCH)`
              );
            }
          }

          if (outOfStockItems.length > 0) {
            throw new Error(
              `Insufficient stock at Bharath Cycle Hub for: ${outOfStockItems.join(", ")}. Transfer stock from warehouse or update inventory before processing this ${data.status === "WALK_OUT" ? "walk-out" : "delivery"}.`
            );
          }

          // Deduct stock only from BCH location
          for (const item of items) {
            if (!item.sku) continue;
            const product = await tx.product.findFirst({
              where: {
                sku: item.sku,
                bin: { location: { startsWith: "Bharath Cycle Hub" } },
              },
              select: { id: true, currentStock: true },
            });
            if (!product) continue;

            const newStock = product.currentStock - item.quantity;
            await tx.product.update({
              where: { id: product.id },
              data: { currentStock: newStock },
            });
            await tx.inventoryTransaction.create({
              data: {
                type: "OUTWARD",
                productId: product.id,
                quantity: item.quantity,
                previousStock: product.currentStock,
                newStock,
                referenceNo: existing.invoiceNo,
                notes: `[ZOHO][VERIFIED] Customer: ${existing.customerName} | Invoice: ${existing.invoiceNo} | ${item.name} x${item.quantity}`,
                userId: user.id,
              },
            });
          }
        }
      }

      return tx.delivery.update({
        where: { id },
        data: updateData,
        include: { verifiedBy: { select: { name: true } } },
      });
    });

    return successResponse(result);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to update delivery", 400);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(["ADMIN"]);
    const { id } = await params;

    const delivery = await prisma.delivery.findUnique({ where: { id } });
    if (!delivery) return errorResponse("Delivery not found", 404);

    // Admin can delete deliveries in any status

    await prisma.delivery.delete({ where: { id } });
    return successResponse({ deleted: true });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to delete delivery", 400);
  }
}
