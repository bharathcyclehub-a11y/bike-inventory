export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";

// GET — public: fetch delivery info by self-fill token (no auth)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;

    const delivery = await prisma.delivery.findUnique({
      where: { selfFillToken: token },
      select: {
        invoiceNo: true,
        customerName: true,
        customerPhone: true,
        customerAddress: true,
        customerArea: true,
        customerPincode: true,
        lineItems: true,
        selfFillTokenExpiry: true,
        selfFillCompletedAt: true,
      },
    });

    if (!delivery) {
      return errorResponse("Invalid link. Please contact the store.", 404);
    }

    if (delivery.selfFillTokenExpiry && new Date() > delivery.selfFillTokenExpiry) {
      return errorResponse("This link has expired. Please contact the store for a new link.", 410);
    }

    return successResponse({
      invoiceNo: delivery.invoiceNo,
      customerName: delivery.customerName,
      customerPhone: delivery.customerPhone,
      customerAddress: delivery.customerAddress,
      customerArea: delivery.customerArea,
      customerPincode: delivery.customerPincode,
      lineItems: delivery.lineItems,
      selfFillCompletedAt: delivery.selfFillCompletedAt,
    });
  } catch {
    return errorResponse("Something went wrong. Please try again.", 500);
  }
}

// PUT — public: customer fills delivery address (no auth)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const body = await req.json();

    const delivery = await prisma.delivery.findUnique({
      where: { selfFillToken: token },
      select: { id: true, selfFillTokenExpiry: true, selfFillCompletedAt: true },
    });

    if (!delivery) {
      return errorResponse("Invalid link. Please contact the store.", 404);
    }

    if (delivery.selfFillTokenExpiry && new Date() > delivery.selfFillTokenExpiry) {
      return errorResponse("This link has expired. Please contact the store for a new link.", 410);
    }

    // Validate required field
    if (!body.customerAddress || typeof body.customerAddress !== "string" || body.customerAddress.trim().length < 5) {
      return errorResponse("Please enter a valid address (at least 5 characters).", 400);
    }

    // Only allow safe fields
    const updateData: Record<string, unknown> = {
      customerAddress: body.customerAddress.trim().slice(0, 500),
      selfFillCompletedAt: new Date(),
    };

    if (body.customerArea && typeof body.customerArea === "string") {
      updateData.customerArea = body.customerArea.trim().slice(0, 100);
    }
    if (body.customerPincode && typeof body.customerPincode === "string") {
      const pin = body.customerPincode.trim();
      if (/^\d{6}$/.test(pin)) updateData.customerPincode = pin;
    }
    if (body.customerPhone && typeof body.customerPhone === "string") {
      const ph = body.customerPhone.trim();
      if (/^\d{10}$/.test(ph)) updateData.customerPhone = ph;
    }
    if (body.alternatePhone && typeof body.alternatePhone === "string") {
      const alt = body.alternatePhone.trim();
      if (/^\d{10}$/.test(alt)) updateData.alternatePhone = alt;
    }
    if (body.deliveryNotes && typeof body.deliveryNotes === "string") {
      updateData.deliveryNotes = body.deliveryNotes.trim().slice(0, 500);
    }
    if (typeof body.isOutstation === "boolean") {
      updateData.isOutstation = body.isOutstation;
    }
    if (body.mapsLink && typeof body.mapsLink === "string") {
      updateData.mapsLink = body.mapsLink.trim().slice(0, 500);
    }

    // Delivery slot: validate requested date and slot availability
    if (body.requestedDate && typeof body.requestedDate === "string") {
      const dateStr = body.requestedDate.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        // Re-check slot count (race-condition guard)
        const slotStart = new Date(dateStr + "T00:00:00+05:30");
        const slotEnd = new Date(dateStr + "T23:59:59+05:30");
        const booked = await prisma.delivery.count({
          where: {
            scheduledDate: { gte: slotStart, lte: slotEnd },
            status: { notIn: ["PREBOOKED", "WALK_OUT"] },
            id: { not: delivery.id }, // exclude self
          },
        });
        if (booked >= 10) {
          return errorResponse("This delivery slot is now full. Please choose another date.", 409);
        }
        updateData.scheduledDate = slotStart;
      }
    }

    await prisma.delivery.update({
      where: { id: delivery.id },
      data: updateData,
    });

    return successResponse({ saved: true });
  } catch {
    return errorResponse("Something went wrong. Please try again.", 500);
  }
}
