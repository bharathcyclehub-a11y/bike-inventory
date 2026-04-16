export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(["ADMIN", "SUPERVISOR", "MECHANIC"]);
    const { id } = await params;

    const customer = await prisma.serviceCustomer.findUnique({ where: { id }, select: { id: true } });
    if (!customer) return errorResponse("Customer not found", 404);

    const bikes = await prisma.customerBike.findMany({
      where: { customerId: id },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { jobs: true } },
      },
    });

    return successResponse(bikes);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch bikes", 500);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(["ADMIN", "SUPERVISOR", "MECHANIC"]);
    const { id } = await params;
    const body = await req.json();

    const customer = await prisma.serviceCustomer.findUnique({ where: { id }, select: { id: true } });
    if (!customer) return errorResponse("Customer not found", 404);

    const { brand, model, size, color, serialNo, purchaseDate, purchaseInvoiceNo, notes } = body;

    if (!brand?.trim() || !model?.trim()) {
      return errorResponse("Brand and model are required", 400);
    }

    const bike = await prisma.customerBike.create({
      data: {
        customerId: id,
        brand: brand.trim(),
        model: model.trim(),
        size: size?.trim() || null,
        color: color?.trim() || null,
        serialNo: serialNo?.trim() || null,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
        purchaseInvoiceNo: purchaseInvoiceNo?.trim() || null,
        notes: notes?.trim() || null,
      },
      include: {
        _count: { select: { jobs: true } },
      },
    });

    return successResponse(bike, 201);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to add bike", 400);
  }
}
