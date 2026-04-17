export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

// GET: Pre-booking detail
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const preBooking = await prisma.preBooking.findUnique({
      where: { id },
      include: {
        brand: { select: { name: true } },
        createdBy: { select: { name: true } },
        matchedShipment: {
          select: { shipmentNo: true, expectedDeliveryDate: true, status: true, brand: { select: { name: true } } },
        },
        matchedLineItem: {
          select: { productName: true, quantity: true, isDelivered: true },
        },
      },
    });

    if (!preBooking) return errorResponse("Not found", 404);
    return successResponse(preBooking);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed", 500);
  }
}

// PUT: Update pre-booking status
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(["ADMIN", "SUPERVISOR", "OUTWARDS_CLERK"]);
    const { id } = await params;
    const body = await req.json();

    const existing = await prisma.preBooking.findUnique({ where: { id } });
    if (!existing) return errorResponse("Not found", 404);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {};

    if (body.status) {
      updateData.status = body.status;
      if (body.status === "FULFILLED") updateData.fulfilledAt = new Date();
      if (body.status === "CANCELLED") {
        updateData.matchedShipmentId = null;
        updateData.matchedLineItemId = null;
        updateData.expectedDate = null;
      }
    }

    const updated = await prisma.preBooking.update({
      where: { id },
      data: updateData,
      include: {
        brand: { select: { name: true } },
        matchedShipment: { select: { shipmentNo: true } },
      },
    });

    return successResponse(updated);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed", 400);
  }
}
