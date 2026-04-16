export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(["ADMIN", "SUPERVISOR"]);
    const { id } = await params;

    const job = await prisma.serviceJob.findUnique({
      where: { id },
      include: { items: true, invoice: true },
    });

    if (!job) return errorResponse("Job not found", 404);
    if (job.status !== "COMPLETED") {
      return errorResponse("Invoice can only be generated for COMPLETED jobs", 400);
    }
    if (job.invoice) return errorResponse("Invoice already exists for this job", 400);

    const amount = job.items.reduce((sum, item) => sum + item.total, 0);
    const discount = job.discount;
    const netAmount = Math.max(0, amount - discount);

    const lastInvoice = await prisma.serviceJobInvoice.findFirst({
      where: { invoiceNo: { startsWith: "BCH-SVC-INV-" } },
      orderBy: { invoiceNo: "desc" },
      select: { invoiceNo: true },
    });
    const nextNum = lastInvoice
      ? parseInt(lastInvoice.invoiceNo.replace("BCH-SVC-INV-", ""), 10) + 1
      : 1;
    const invoiceNo = `BCH-SVC-INV-${String(nextNum).padStart(4, "0")}`;

    const [invoice] = await prisma.$transaction([
      prisma.serviceJobInvoice.create({
        data: { jobId: id, invoiceNo, amount, discount, netAmount },
      }),
      prisma.serviceJob.update({
        where: { id },
        data: { status: "INVOICED" },
      }),
    ]);

    return successResponse(invoice, 201);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to generate invoice", 500);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(["ADMIN", "SUPERVISOR"]);
    const { id } = await params;
    const body = await req.json();

    const { amount, paymentMode } = body;

    if (amount == null || !paymentMode) {
      return errorResponse("amount and paymentMode are required", 400);
    }
    if (amount <= 0) return errorResponse("Payment amount must be positive", 400);

    const invoice = await prisma.serviceJobInvoice.findUnique({ where: { jobId: id } });
    if (!invoice) return errorResponse("Invoice not found for this job", 404);

    const newPaidAmount = invoice.paidAmount + amount;
    const fullyPaid = newPaidAmount >= invoice.netAmount;

    const updatedInvoice = await prisma.serviceJobInvoice.update({
      where: { id: invoice.id },
      data: {
        paidAmount: newPaidAmount,
        paymentMode,
        status: fullyPaid ? "PAID" : "PARTIALLY_PAID",
        paidAt: fullyPaid ? new Date() : null,
      },
    });

    if (fullyPaid) {
      await prisma.serviceJob.update({
        where: { id },
        data: { status: "DELIVERED", deliveredAt: new Date() },
      });
    }

    return successResponse(updatedInvoice);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to record payment", 500);
  }
}
