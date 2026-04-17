export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

// GET: Shipment detail
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const shipment = await prisma.inboundShipment.findUnique({
      where: { id },
      include: {
        brand: { select: { name: true } },
        createdBy: { select: { name: true } },
        deliveredBy: { select: { name: true } },
        lineItems: {
          include: {
            product: { select: { name: true, sku: true } },
            preBooking: { select: { id: true, customerName: true, status: true } },
          },
        },
        preBookings: {
          select: { id: true, customerName: true, customerPhone: true, status: true, productName: true },
        },
      },
    });

    if (!shipment) return errorResponse("Not found", 404);
    return successResponse(shipment);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed", 500);
  }
}

// PUT: Update shipment (mark line items delivered, update notes)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(["ADMIN", "SUPERVISOR", "INWARDS_CLERK", "PURCHASE_MANAGER"]);
    const { id } = await params;
    const body = await req.json();

    const existing = await prisma.inboundShipment.findUnique({ where: { id } });
    if (!existing) return errorResponse("Not found", 404);

    // Update individual line item delivery
    if (body.lineItemId && body.deliveredQty !== undefined) {
      await prisma.inboundLineItem.update({
        where: { id: body.lineItemId },
        data: {
          isDelivered: body.deliveredQty > 0,
          deliveredQty: body.deliveredQty,
        },
      });

      return successResponse({ updated: true });
    }

    // Update notes
    if (body.notes !== undefined) {
      const updated = await prisma.inboundShipment.update({
        where: { id },
        data: { notes: body.notes },
      });
      return successResponse(updated);
    }

    // Mark WhatsApp sent for a line item
    if (body.lineItemId && body.whatsAppSent) {
      await prisma.inboundLineItem.update({
        where: { id: body.lineItemId },
        data: { whatsAppSent: true },
      });
      return successResponse({ updated: true });
    }

    return errorResponse("No valid update fields", 400);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed", 400);
  }
}
