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

    const existing = await prisma.delivery.findUnique({ where: { id } });
    if (!existing) return errorResponse("Delivery not found", 404);

    // Status transition guards
    if (data.status) {
      const VALID: Record<string, string[]> = {
        PENDING: ["VERIFIED", "FLAGGED"],
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
        return errorResponse(`Cannot change from ${existing.status} to ${data.status}`, 400);
      }
    }

    const result = await prisma.$transaction(async (tx) => {
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
      if (data.freeAccessories !== undefined) updateData.freeAccessories = data.freeAccessories;

      // WhatsApp tracking flags
      if (data.whatsAppScheduledSent !== undefined) updateData.whatsAppScheduledSent = data.whatsAppScheduledSent;
      if (data.whatsAppDispatchedSent !== undefined) updateData.whatsAppDispatchedSent = data.whatsAppDispatchedSent;
      if (data.whatsAppDeliveredSent !== undefined) updateData.whatsAppDeliveredSent = data.whatsAppDeliveredSent;

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

          // Parse line items and deduct stock
          const items = (existing.lineItems as Array<{ name: string; sku: string; quantity: number; rate: number }>) || [];
          for (const item of items) {
            if (!item.sku) continue;
            const product = await tx.product.findFirst({
              where: { sku: item.sku },
              select: { id: true, currentStock: true },
            });
            if (!product) continue;

            const newStock = Math.max(0, product.currentStock - item.quantity);
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

    if (!["PENDING", "FLAGGED", "PREBOOKED"].includes(delivery.status)) {
      return errorResponse("Can only delete PENDING, FLAGGED, or PREBOOKED deliveries", 400);
    }

    await prisma.delivery.delete({ where: { id } });
    return successResponse({ deleted: true });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to delete delivery", 400);
  }
}
