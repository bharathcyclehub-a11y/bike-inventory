export const revalidate = 30; // cache product list 30 seconds

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  successResponse,
  errorResponse,
  paginatedResponse,
  parseSearchParams,
} from "@/lib/api-utils";
import { productSchema } from "@/lib/validations";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { page, limit, skip, sortBy, sortOrder, search, searchParams } =
      parseSearchParams(req.url);

    const isAdmin = user.role === "ADMIN";

    const categoryId = searchParams.get("categoryId") || undefined;
    const brandId = searchParams.get("brandId") || undefined;
    const type = searchParams.get("type") || undefined;
    const status = searchParams.get("status") || "ACTIVE";
    const size = searchParams.get("size") || undefined;
    const binId = searchParams.get("binId") || undefined;

    const where = {
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { sku: { contains: search, mode: "insensitive" as const } },
        ],
      }),
      ...(categoryId && { categoryId }),
      ...(brandId && { brandId }),
      ...(binId && { binId }),
      ...(type && { type: type as never }),
      ...(status && { status: status as never }),
      ...(size && { size }),
    };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        select: {
          id: true, sku: true, name: true, type: true, status: true, size: true,
          costPrice: isAdmin, sellingPrice: true, mrp: true, gstRate: true, hsnCode: true,
          currentStock: true, minStock: true, reorderLevel: true,
          category: { select: { id: true, name: true } },
          brand: { select: { id: true, name: true } },
          bin: { select: { id: true, code: true, location: true } },
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    return paginatedResponse(products, total, page, limit);
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse(error.message, error.status);
    }
    return errorResponse(
      error instanceof Error ? error.message : "Failed to fetch products",
      500
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(["ADMIN", "MANAGER"]);
    const body = await req.json();
    const data = productSchema.parse(body);

    const product = await prisma.product.create({
      data: {
        ...data,
        imageUrls: data.imageUrls || [],
        tags: data.tags || [],
      },
      include: { category: true, brand: true, bin: true },
    });

    return successResponse(product, 201);
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse(error.message, error.status);
    }
    return errorResponse(
      error instanceof Error ? error.message : "Failed to create product",
      400
    );
  }
}
