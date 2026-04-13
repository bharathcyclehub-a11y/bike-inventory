export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  try {
    await requireAuth(["ADMIN", "SUPERVISOR", "MANAGER", "INWARDS_CLERK", "OUTWARDS_CLERK"]);
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");

    if (!code || code.length < 2) {
      return errorResponse("Search code must be at least 2 characters", 400);
    }

    const serials = await prisma.serialItem.findMany({
      where: {
        OR: [
          { serialCode: { contains: code, mode: "insensitive" } },
          { barcodeData: { contains: code, mode: "insensitive" } },
        ],
      },
      include: {
        product: { select: { name: true, sku: true, type: true, sellingPrice: true, mrp: true } },
        bin: { select: { code: true, location: true } },
      },
      take: 20,
      orderBy: { serialCode: "asc" },
    });

    return successResponse(serials);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to search serials", 500);
  }
}
