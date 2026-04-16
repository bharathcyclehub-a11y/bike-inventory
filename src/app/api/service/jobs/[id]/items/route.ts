export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const job = await prisma.serviceJob.findUnique({ where: { id }, select: { id: true } });
    if (!job) return errorResponse("Job not found", 404);

    const items = await prisma.serviceJobItem.findMany({
      where: { jobId: id },
      include: { product: { select: { id: true, name: true, sku: true, sellingPrice: true } } },
      orderBy: { createdAt: "asc" },
    });

    return successResponse(items);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch items", 500);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(["ADMIN", "SUPERVISOR", "MECHANIC"]);
    const { id } = await params;
    const body = await req.json();

    const { type, productId, description, quantity, unitPrice } = body;

    if (!type || !description || quantity == null || unitPrice == null) {
      return errorResponse("type, description, quantity, and unitPrice are required", 400);
    }

    const job = await prisma.serviceJob.findUnique({ where: { id }, select: { id: true } });
    if (!job) return errorResponse("Job not found", 404);

    const total = quantity * unitPrice;

    const item = await prisma.serviceJobItem.create({
      data: {
        jobId: id,
        type,
        productId: productId || null,
        description,
        quantity,
        unitPrice,
        total,
      },
      include: { product: { select: { id: true, name: true, sku: true } } },
    });

    const agg = await prisma.serviceJobItem.aggregate({
      where: { jobId: id },
      _sum: { total: true },
    });
    await prisma.serviceJob.update({
      where: { id },
      data: { actualCost: agg._sum.total || 0 },
    });

    return successResponse(item, 201);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to add item", 500);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(["ADMIN", "SUPERVISOR", "MECHANIC"]);
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const itemId = searchParams.get("itemId");

    if (!itemId) return errorResponse("itemId query param is required", 400);

    const item = await prisma.serviceJobItem.findUnique({ where: { id: itemId } });
    if (!item || item.jobId !== id) return errorResponse("Item not found", 404);

    await prisma.serviceJobItem.delete({ where: { id: itemId } });

    const agg = await prisma.serviceJobItem.aggregate({
      where: { jobId: id },
      _sum: { total: true },
    });
    await prisma.serviceJob.update({
      where: { id },
      data: { actualCost: agg._sum.total || 0 },
    });

    return successResponse({ message: "Item removed" });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to remove item", 500);
  }
}
