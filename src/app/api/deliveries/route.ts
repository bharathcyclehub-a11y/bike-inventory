export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse, paginatedResponse, parseSearchParams } from "@/lib/api-utils";
import { deliveryCreateSchema } from "@/lib/validations";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  try {
    await requireAuth(["ADMIN", "SUPERVISOR", "OUTWARDS_CLERK"]);
    const { page, limit, skip, searchParams } = parseSearchParams(req.url);
    const status = searchParams.get("status") || undefined;
    const area = searchParams.get("area") || undefined;
    const date = searchParams.get("date") || undefined;
    const search = searchParams.get("search") || undefined;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (area) where.customerArea = area;
    if (date) {
      const d = new Date(date);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      where.invoiceDate = { gte: d, lt: next };
    }
    if (search) {
      where.OR = [
        { invoiceNo: { contains: search, mode: "insensitive" } },
        { customerName: { contains: search, mode: "insensitive" } },
        { customerPhone: { contains: search } },
      ];
    }

    const [deliveries, total] = await Promise.all([
      prisma.delivery.findMany({
        where,
        include: { verifiedBy: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.delivery.count({ where }),
    ]);

    return paginatedResponse(deliveries, total, page, limit);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch deliveries", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(["ADMIN", "OUTWARDS_CLERK"]);
    const body = await req.json();
    const data = deliveryCreateSchema.parse(body);

    // Check duplicate invoice
    const existing = await prisma.delivery.findFirst({
      where: { invoiceNo: data.invoiceNo },
    });
    if (existing) return errorResponse("Invoice number already exists", 409);

    const delivery = await prisma.delivery.create({
      data: {
        invoiceNo: data.invoiceNo,
        invoiceDate: new Date(),
        invoiceAmount: data.invoiceAmount || 0,
        customerName: data.customerName,
        customerPhone: data.customerPhone || null,
        status: "PREBOOKED",
        expectedReadyDate: data.expectedReadyDate ? new Date(data.expectedReadyDate) : null,
        prebookNotes: data.prebookNotes || null,
        lineItems: data.lineItems ?? undefined,
        verifiedById: user.id,
      },
    });

    return successResponse(delivery, 201);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to create delivery", 400);
  }
}
