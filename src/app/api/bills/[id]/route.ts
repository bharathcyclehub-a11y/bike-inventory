export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const bill = await prisma.vendorBill.findUnique({
      where: { id },
      include: {
        vendor: true,
        purchaseOrder: { include: { items: { include: { product: { select: { name: true, sku: true } } } } } },
        payments: { orderBy: { paymentDate: "desc" } },
      },
    });

    if (!bill) return errorResponse("Bill not found", 404);
    return successResponse(bill);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch bill", 500);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(["ADMIN", "MANAGER"]);
    const { id } = await params;
    const body = await req.json();

    const bill = await prisma.vendorBill.update({
      where: { id },
      data: {
        ...(body.status && { status: body.status }),
        ...(body.notes !== undefined && { notes: body.notes }),
      },
      include: { vendor: { select: { name: true } } },
    });

    return successResponse(bill);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to update bill", 400);
  }
}
