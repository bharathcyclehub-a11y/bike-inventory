export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { sopViolationSchema } from "@/lib/validations";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  try {
    await requireAuth(["ADMIN", "SUPERVISOR"]);
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId") || undefined;
    const sopId = searchParams.get("sopId") || undefined;

    const where = {
      ...(userId && { userId }),
      ...(sopId && { sopId }),
    };

    const violations = await prisma.sOPViolation.findMany({
      where,
      include: {
        sop: { select: { title: true } },
        user: { select: { id: true, name: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return successResponse(violations);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch violations", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(["ADMIN", "SUPERVISOR"]);
    const body = await req.json();
    const data = sopViolationSchema.parse(body);

    const violation = await prisma.sOPViolation.create({
      data: {
        sopId: data.sopId,
        userId: data.userId,
        notes: data.notes,
        createdById: user.id,
      },
      include: {
        sop: { select: { title: true } },
        user: { select: { id: true, name: true } },
        createdBy: { select: { name: true } },
      },
    });

    return successResponse(violation, 201);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to record violation", 400);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireAuth(["ADMIN"]);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) return errorResponse("Violation ID is required", 400);

    await prisma.sOPViolation.delete({ where: { id } });

    return successResponse({ deleted: true });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to delete violation", 400);
  }
}
