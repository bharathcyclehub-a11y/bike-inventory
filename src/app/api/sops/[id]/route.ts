export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { sopUpdateSchema } from "@/lib/validations";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(["ADMIN", "SUPERVISOR"]);
    const { id } = await params;

    const sop = await prisma.sOP.findUnique({
      where: { id },
      include: {
        assignees: {
          include: { user: { select: { id: true, name: true } } },
        },
        checkOffs: {
          include: { user: { select: { id: true, name: true } } },
        },
        violations: {
          include: {
            user: { select: { id: true, name: true } },
            createdBy: { select: { name: true } },
          },
        },
      },
    });

    if (!sop) return errorResponse("SOP not found", 404);

    return successResponse(sop);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch SOP", 500);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(["ADMIN", "SUPERVISOR"]);
    const { id } = await params;
    const body = await req.json();
    const data = sopUpdateSchema.parse(body);

    const { assigneeIds, ...updateData } = data;

    const sop = await prisma.sOP.update({
      where: { id },
      data: {
        ...updateData,
        ...(assigneeIds !== undefined && {
          assignees: {
            deleteMany: {},
            create: assigneeIds.map((uid: string) => ({ userId: uid })),
          },
        }),
      },
      include: {
        assignees: {
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });

    return successResponse(sop);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to update SOP", 400);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(["ADMIN", "SUPERVISOR"]);
    const { id } = await params;

    await prisma.sOP.delete({ where: { id } });

    return successResponse({ deleted: true });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to delete SOP", 400);
  }
}
