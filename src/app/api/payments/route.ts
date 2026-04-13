export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse, paginatedResponse, parseSearchParams } from "@/lib/api-utils";
import { vendorPaymentSchema } from "@/lib/validations";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  try {
    const { page, limit, skip, searchParams } = parseSearchParams(req.url);
    const vendorId = searchParams.get("vendorId") || undefined;

    const where = {
      ...(vendorId && { vendorId }),
    };

    const [payments, total] = await Promise.all([
      prisma.vendorPayment.findMany({
        where,
        include: {
          vendor: { select: { name: true, code: true } },
          bill: { select: { billNo: true, amount: true } },
          recordedBy: { select: { name: true } },
        },
        orderBy: { paymentDate: "desc" },
        skip,
        take: limit,
      }),
      prisma.vendorPayment.count({ where }),
    ]);

    return paginatedResponse(payments, total, page, limit);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch payments", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(["ADMIN", "MANAGER"]);
    const body = await req.json();
    const data = vendorPaymentSchema.parse(body);

    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.vendorPayment.create({
        data: {
          vendorId: data.vendorId,
          billId: data.billId || null,
          amount: data.amount,
          paymentMode: data.paymentMode,
          paymentDate: new Date(data.paymentDate),
          referenceNo: data.referenceNo,
          creditId: data.creditId || null,
          notes: data.notes,
          recordedById: user.id,
        },
        include: { vendor: { select: { name: true } }, bill: { select: { billNo: true } } },
      });

      if (data.billId) {
        const bill = await tx.vendorBill.findUnique({ where: { id: data.billId } });
        if (bill) {
          const newPaidAmount = bill.paidAmount + data.amount;
          const newStatus = newPaidAmount >= bill.amount ? "PAID" : "PARTIALLY_PAID";
          await tx.vendorBill.update({
            where: { id: data.billId },
            data: { paidAmount: newPaidAmount, status: newStatus },
          });
        }
      }

      if (data.creditId) {
        const credit = await tx.vendorCredit.findUnique({ where: { id: data.creditId } });
        if (credit) {
          await tx.vendorCredit.update({
            where: { id: data.creditId },
            data: { usedAmount: credit.usedAmount + data.amount },
          });
        }
      }

      return payment;
    });

    return successResponse(result, 201);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to record payment", 400);
  }
}
