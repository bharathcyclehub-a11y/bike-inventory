export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse, parseSearchParams } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";
import { inboundShipmentSchema } from "@/lib/validations";

// GET: List shipments
export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { limit, skip, searchParams } = parseSearchParams(req.url);
    const status = searchParams.get("status") || undefined;
    const search = searchParams.get("search") || undefined;

    // "arriving_this_week" is a special filter
    const isArrivingThisWeek = status === "arriving_this_week";

    const now = new Date();
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() + (7 - weekEnd.getDay()));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (isArrivingThisWeek) {
      where.status = "IN_TRANSIT";
      where.expectedDeliveryDate = { lte: weekEnd };
    } else if (status && status !== "ALL") {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { billNo: { contains: search, mode: "insensitive" } },
        { shipmentNo: { contains: search, mode: "insensitive" } },
        { brand: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [shipments, total] = await Promise.all([
      prisma.inboundShipment.findMany({
        where,
        include: {
          brand: { select: { name: true } },
          createdBy: { select: { name: true } },
          _count: { select: { lineItems: true, preBookings: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.inboundShipment.count({ where }),
    ]);

    return successResponse({ shipments, total });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed", 500);
  }
}

// POST: Create shipment from verified bill data
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(["ADMIN", "PURCHASE_MANAGER"]);
    const body = await req.json();
    const data = inboundShipmentSchema.parse(body);

    // Get brand lead time
    const leadTime = await prisma.brandLeadTime.findUnique({
      where: { brandId: data.brandId },
    });
    const leadDays = leadTime?.leadDays ?? 7;

    const billDate = new Date(data.billDate);
    const expectedDeliveryDate = new Date(billDate);
    expectedDeliveryDate.setDate(expectedDeliveryDate.getDate() + leadDays);

    // Auto-generate shipment number: IB-YYYYMM-0001
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

    const totalAmount = data.lineItems.reduce((s, li) => s + li.amount, 0);

    // Fuzzy match product names to existing products
    const matchedItems = await Promise.all(
      data.lineItems.map(async (li) => {
        if (li.productId) return li; // already matched by user
        // Try exact SKU match first
        if (li.sku) {
          const bysku = await prisma.product.findUnique({
            where: { sku: li.sku },
            select: { id: true, sku: true },
          });
          if (bysku) return { ...li, productId: bysku.id, sku: bysku.sku };
        }
        // Try name search
        const matches = await prisma.product.findMany({
          where: { name: { contains: li.productName.substring(0, 20), mode: "insensitive" } },
          select: { id: true, sku: true, name: true },
          take: 1,
        });
        if (matches.length > 0) {
          return { ...li, productId: matches[0].id, sku: matches[0].sku };
        }
        return li;
      })
    );

    // Auto-match pre-booked customers
    const waitingPreBookings = await prisma.preBooking.findMany({
      where: { status: "WAITING" },
    });

    const shipment = await prisma.inboundShipment.create({
      data: {
        shipmentNo,
        brandId: data.brandId,
        billNo: data.billNo,
        billImageUrl: data.billImageUrl,
        billDate,
        expectedDeliveryDate,
        totalAmount,
        totalItems: data.lineItems.length,
        notes: data.notes,
        createdById: user.id,
        lineItems: {
          create: matchedItems.map((li) => {
            // Check for pre-booking match
            const preBookMatch = waitingPreBookings.find((pb) =>
              li.productName.toLowerCase().includes(pb.productName.toLowerCase().substring(0, 15))
              || pb.productName.toLowerCase().includes(li.productName.toLowerCase().substring(0, 15))
            );

            return {
              productName: li.productName,
              productId: li.productId || null,
              sku: li.sku || null,
              quantity: li.quantity,
              rate: li.rate,
              amount: li.amount,
              hsn: li.hsn || null,
              preBookedCustomerName: preBookMatch?.customerName || null,
              preBookedCustomerPhone: preBookMatch?.customerPhone || null,
              preBookedInvoiceNo: preBookMatch?.zohoInvoiceNo || null,
            };
          }),
        },
      },
      include: {
        brand: { select: { name: true } },
        lineItems: true,
        createdBy: { select: { name: true } },
      },
    });

    // Update matched pre-bookings
    for (const li of shipment.lineItems) {
      if (li.preBookedInvoiceNo) {
        const pb = waitingPreBookings.find((p) => p.zohoInvoiceNo === li.preBookedInvoiceNo);
        if (pb) {
          await prisma.preBooking.update({
            where: { id: pb.id },
            data: {
              status: "MATCHED",
              matchedShipmentId: shipment.id,
              matchedLineItemId: li.id,
              expectedDate: expectedDeliveryDate,
            },
          });
        }
      }
    }

    // Push draft bill to Zoho (best effort)
    try {
      const { ZohoInventoryClient } = await import("@/lib/zoho-inventory");
      const zohoInv = new ZohoInventoryClient();

      const brand = await prisma.brand.findUnique({ where: { id: data.brandId }, select: { name: true } });
      await zohoInv.createItem({
        name: `Inbound: ${brand?.name || "Unknown"} - ${data.billNo}`,
        sku: shipmentNo,
        purchase_rate: totalAmount,
        item_type: "inventory",
        product_type: "goods",
      });
    } catch (zohoErr) {
      console.warn("Zoho draft push failed (non-critical):", zohoErr);
    }

    return successResponse(shipment, 201);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed", 400);
  }
}
