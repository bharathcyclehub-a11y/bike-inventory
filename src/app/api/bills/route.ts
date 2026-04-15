export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse, paginatedResponse, parseSearchParams } from "@/lib/api-utils";
import { vendorBillSchema } from "@/lib/validations";
import { requireAuth, AuthError } from "@/lib/auth-helpers";
import type { BillStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    await requireAuth(["ADMIN", "SUPERVISOR", "PURCHASE_MANAGER", "ACCOUNTS_MANAGER"]);
    const { page, limit, skip, search, searchParams } = parseSearchParams(req.url);
    const status = searchParams.get("status") || undefined;
    const vendorId = searchParams.get("vendorId") || undefined;
    const overdue = searchParams.get("overdue") === "true";

    const where = {
      ...(search && {
        OR: [
          { billNo: { contains: search, mode: "insensitive" as const } },
          { vendor: { name: { contains: search, mode: "insensitive" as const } } },
        ],
      }),
      ...(status && { status: status as never }),
      ...(vendorId && { vendorId }),
      ...(overdue && { dueDate: { lt: new Date() }, status: { in: ["PENDING", "PARTIALLY_PAID"] as BillStatus[] } }),
    };

    const [bills, total] = await Promise.all([
      prisma.vendorBill.findMany({
        where,
        select: {
          id: true, billNo: true, amount: true, paidAmount: true,
          status: true, dueDate: true, billDate: true, createdAt: true,
          vendor: { select: { name: true, code: true } },
          _count: { select: { payments: true } },
        },
        orderBy: { dueDate: "asc" },
        skip,
        take: limit,
      }),
      prisma.vendorBill.count({ where }),
    ]);

    return paginatedResponse(bills, total, page, limit);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch bills", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth(["ADMIN", "ACCOUNTS_MANAGER", "SUPERVISOR"]);
    const body = await req.json();
    const data = vendorBillSchema.parse(body);

    const bill = await prisma.vendorBill.create({
      data: {
        vendorId: data.vendorId,
        purchaseOrderId: data.purchaseOrderId || null,
        billNo: data.billNo,
        billDate: new Date(data.billDate),
        dueDate: new Date(data.dueDate),
        amount: data.amount,
        notes: data.notes,
      },
      include: { vendor: { select: { name: true } } },
    });

    return successResponse(bill, 201);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to create bill", 400);
  }
}
