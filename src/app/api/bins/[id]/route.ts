export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(["ADMIN", "MANAGER"]);
    const { id } = await params;

    const bin = await prisma.bin.findUnique({
      where: { id },
      include: { _count: { select: { products: true, serialItems: true } } },
    });

    if (!bin) return errorResponse("Bin not found", 404);

    if (bin._count.products > 0 || bin._count.serialItems > 0) {
      return errorResponse(
        `Cannot delete bin "${bin.code}" — it has ${bin._count.products} products assigned. Reassign them first.`,
        400
      );
    }

    await prisma.bin.delete({ where: { id } });
    return successResponse({ deleted: true });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to delete bin", 400);
  }
}
