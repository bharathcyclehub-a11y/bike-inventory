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
      include: { lineItems: true, brand: { select: { name: true } } },
    });

    if (!existing) return errorResponse("Not found", 404);
    if (existing.status === "DELIVERED") return errorResponse("Already delivered", 400);

    const updated = await prisma.$transaction(async (tx) => {
      // Mark all line items as delivered if full delivery
      if (status === "DELIVERED") {
        await tx.inboundLineItem.updateMany({
          where: { shipmentId: id },
          data: { isDelivered: true },
        });

        // Set deliveredQty = quantity for items not yet marked
        for (const li of existing.lineItems) {
          if (!li.isDelivered) {
            await tx.inboundLineItem.update({
              where: { id: li.id },
              data: { deliveredQty: li.quantity },
            });
          }
        }
      }

      // Add stock for delivered line items
      const deliveredItems = status === "DELIVERED"
        ? existing.lineItems
        : existing.lineItems.filter((li) => li.isDelivered);

      for (const li of deliveredItems) {
        const qty = li.deliveredQty ?? li.quantity;
        if (qty <= 0) continue;

        // Find product by name (fuzzy match using first 20 chars)
        const searchName = li.productName.substring(0, 20);
        const matchedProduct = li.productId
          ? await tx.product.findUnique({ where: { id: li.productId } })
          : await tx.product.findFirst({
              where: { name: { contains: searchName, mode: "insensitive" } },
            });

        if (matchedProduct) {
          const previousStock = matchedProduct.currentStock;
          const newStock = previousStock + qty;

          await tx.product.update({
            where: { id: matchedProduct.id },
            data: { currentStock: newStock },
          });

          await tx.inventoryTransaction.create({
            data: {
              type: "INWARD",
              productId: matchedProduct.id,
              quantity: qty,
              previousStock,
              newStock,
              referenceNo: existing.shipmentNo,
              notes: `[INBOUND] Brand: ${existing.brand.name} | Bill: ${existing.billNo} | ${li.productName} x${qty}`,
              userId: user.id,
            },
          });
        }
      }

      const result = await tx.inboundShipment.update({
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
        await tx.preBooking.updateMany({
          where: { matchedShipmentId: id, status: "MATCHED" },
          data: { status: "FULFILLED", fulfilledAt: new Date() },
        });
      }

      return result;
    });

    // Push purchase bill to Zoho Books on full delivery (best effort)
    if (status === "DELIVERED") {
      try {
        const { ZohoClient } = await import("@/lib/zoho");
        const zoho = new ZohoClient();
        const billDate = existing.billDate.toISOString().split("T")[0];
        const dueDate = new Date(existing.billDate);
        dueDate.setDate(dueDate.getDate() + 30);

        await zoho.createBill({
          vendorName: existing.brand.name,
          billNo: existing.billNo,
          billDate,
          dueDate: dueDate.toISOString().split("T")[0],
          amount: existing.totalAmount,
          lineItems: existing.lineItems.map((li) => ({
            name: li.productName,
            quantity: li.deliveredQty ?? li.quantity,
            rate: li.rate,
          })),
        });
      } catch (zohoErr) {
        console.warn("Zoho bill push failed (non-critical):", zohoErr);
      }
    }

    return successResponse(updated);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed", 400);
  }
}
