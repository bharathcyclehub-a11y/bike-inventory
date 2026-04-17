export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

// PUT: Update shipment status (IN_TRANSIT → DELIVERED / PARTIALLY_DELIVERED)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(["ADMIN", "SUPERVISOR", "INWARDS_CLERK"]);
    const { id } = await params;
    const body = await req.json();
    const { status } = body;

    if (!["DELIVERED", "PARTIALLY_DELIVERED"].includes(status)) {
      return errorResponse("Status must be DELIVERED or PARTIALLY_DELIVERED", 400);
    }

    const existing = await prisma.inboundShipment.findUnique({
      where: { id },
      include: { lineItems: true },
    });

    if (!existing) return errorResponse("Not found", 404);
    if (existing.status === "DELIVERED") return errorResponse("Already delivered", 400);

    // Mark all line items as delivered if full delivery
    if (status === "DELIVERED") {
      await prisma.inboundLineItem.updateMany({
        where: { shipmentId: id },
        data: { isDelivered: true },
      });

      // Set deliveredQty = quantity for items not yet marked
      for (const li of existing.lineItems) {
        if (!li.isDelivered) {
          await prisma.inboundLineItem.update({
            where: { id: li.id },
            data: { deliveredQty: li.quantity },
          });
        }
      }
    }

    const updated = await prisma.inboundShipment.update({
      where: { id },
      data: {
        status,
        deliveredAt: new Date(),
        deliveredById: user.id,
      },
      include: {
        brand: { select: { name: true } },
        lineItems: true,
      },
    });

    // Fulfill matched pre-bookings
    if (status === "DELIVERED") {
      await prisma.preBooking.updateMany({
        where: { matchedShipmentId: id, status: "MATCHED" },
        data: { status: "FULFILLED", fulfilledAt: new Date() },
      });
    }

    return successResponse(updated);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed", 400);
  }
}
