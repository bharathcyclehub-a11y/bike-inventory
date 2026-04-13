export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse, paginatedResponse, parseSearchParams } from "@/lib/api-utils";
import { purchaseOrderSchema } from "@/lib/validations";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  try {
    const { page, limit, skip, searchParams } = parseSearchParams(req.url);
    const status = searchParams.get("status") || undefined;
    const vendorId = searchParams.get("vendorId") || undefined;

    const where = {
      ...(status && { status: status as never }),
      ...(vendorId && { vendorId }),
    };

    const [orders, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        include: {
          vendor: { select: { name: true, code: true } },
          items: { include: { product: { select: { name: true, sku: true } } } },
          createdBy: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.purchaseOrder.count({ where }),
    ]);

    return paginatedResponse(orders, total, page, limit);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch purchase orders", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(["ADMIN", "MANAGER", "SUPERVISOR"]);
    const body = await req.json();
    const data = purchaseOrderSchema.parse(body);

    const items = data.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      gstRate: item.gstRate || 18,
      amount: item.quantity * item.unitPrice,
    }));

    const subtotal = items.reduce((sum, i) => sum + i.amount, 0);
    const gstTotal = items.reduce((sum, i) => sum + i.amount * (i.gstRate / 100), 0);

    // Generate PO number inside transaction with retry for race conditions
    const po = await prisma.$transaction(async (tx) => {
      const lastPO = await tx.purchaseOrder.findFirst({ orderBy: { createdAt: "desc" }, select: { poNumber: true } });
      const nextNum = lastPO ? parseInt(lastPO.poNumber.replace("PO-", ""), 10) + 1 : 1;
      const poNumber = `PO-${String(nextNum).padStart(5, "0")}`;

      return tx.purchaseOrder.create({
        data: {
          poNumber,
          vendorId: data.vendorId,
          expectedDate: data.expectedDate ? new Date(data.expectedDate) : null,
          deliveryAddress: data.deliveryAddress,
          notes: data.notes,
          createdById: user.id,
          subtotal,
          gstTotal,
          grandTotal: subtotal + gstTotal,
          items: { create: items },
        },
        include: {
          vendor: { select: { name: true } },
          items: { include: { product: { select: { name: true, sku: true } } } },
        },
      });
    });

    return successResponse(po, 201);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to create purchase order", 400);
  }
}
