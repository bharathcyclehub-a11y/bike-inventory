export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

const reclassifySchema = z
  .object({
    brandId: z.string().optional(),
    categoryId: z.string().optional(),
  })
  .refine((d) => d.brandId || d.categoryId, {
    message: "Either brandId or categoryId must be provided",
  });

// Separate endpoint so warehouse roles can correct brand/category
// without getting full product-edit access (prices, stock, etc.)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth([
      "ADMIN",
      "PURCHASE_MANAGER",
      "STORE_MANAGER",
      "INWARDS_EXECUTIVE",
      "OUTWARDS_EXECUTIVE",
    ]);
    const { id } = await params;
    const body = await req.json();
    const data = reclassifySchema.parse(body);

    const update: Record<string, string> = {};
    if (data.brandId) update.brandId = data.brandId;
    if (data.categoryId) update.categoryId = data.categoryId;

    const product = await prisma.product.update({
      where: { id },
      data: update,
      include: { category: true, brand: true },
    });

    return successResponse(product);
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse(error.message, error.status);
    }
    return errorResponse(
      error instanceof Error ? error.message : "Failed to reclassify product",
      400
    );
  }
}
