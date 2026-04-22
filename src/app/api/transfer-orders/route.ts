export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse, paginatedResponse, parseSearchParams } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";
import { z } from "zod";

const itemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1),
  fromBinId: z.string().min(1),
  toBinId: z.string().min(1),
});

const createSchema = z.object({
  items: z.array(itemSchema).min(1, "At least one item is required"),
  notes: z.string().optional(),
});

// GET: List transfer orders
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { page, limit, skip, searchParams } = parseSearchParams(req.url);
    const status = searchParams.get("status"); // PENDING, APPROVED, REJECTED, all

    const dateFrom = searchParams.get("dateFrom") || undefined;
    const dateTo = searchParams.get("dateTo") || undefined;

    // Non-admin/supervisor users only see their own transfers
    const canSeeAll = ["ADMIN", "SUPERVISOR"].includes(user.role);

    const where = {
      ...(!canSeeAll && { createdById: user.id }),
      ...(status && status !== "all" && {
        status: status as "PENDING" | "APPROVED" | "REJECTED",
      }),
      ...((dateFrom || dateTo) && {
        createdAt: {
          ...(dateFrom && { gte: new Date(dateFrom) }),
          ...(dateTo && { lte: new Date(dateTo + "T23:59:59.999Z") }),
        },
      }),
    };

    const [orders, total] = await Promise.all([
      prisma.transferOrder.findMany({
        where,
        include: {
          createdBy: { select: { name: true } },
          reviewedBy: { select: { name: true } },
          items: {
            include: {
              product: { select: { name: true, sku: true, currentStock: true } },
              fromBin: { select: { code: true, name: true, location: true } },
              toBin: { select: { code: true, name: true, location: true } },
            },
          },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.transferOrder.count({ where }),
    ]);

    return paginatedResponse(orders, total, page, limit);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch transfer orders", 500);
  }
}

// POST: Create a new transfer order (any role)
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await req.json();
    const data = createSchema.parse(body);

    // Validate all items
    for (const item of data.items) {
      if (item.fromBinId === item.toBinId) {
        return errorResponse("Source and destination bins must be different", 400);
      }
    }

    // Verify all products and bins exist
    const productIds = [...new Set(data.items.map((i) => i.productId))];
    const binIds = [...new Set(data.items.flatMap((i) => [i.fromBinId, i.toBinId]))];

    const [products, bins] = await Promise.all([
      prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, currentStock: true, name: true } }),
      prisma.bin.findMany({ where: { id: { in: binIds } }, select: { id: true, code: true } }),
    ]);

    const productMap = new Map(products.map((p) => [p.id, p]));
    const binSet = new Set(bins.map((b) => b.id));

    for (const item of data.items) {
      const product = productMap.get(item.productId);
      if (!product) return errorResponse(`Product not found: ${item.productId}`, 404);
      if (!binSet.has(item.fromBinId)) return errorResponse(`Source bin not found`, 404);
      if (!binSet.has(item.toBinId)) return errorResponse(`Destination bin not found`, 404);
      if (product.currentStock < item.quantity) {
        return errorResponse(`Insufficient stock for ${product.name}. Available: ${product.currentStock}`, 400);
      }
    }

    // Generate order number: TRF-YYYYMM-NNNN
    const now = new Date();
    const prefix = `TRF-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
    const lastOrder = await prisma.transferOrder.findFirst({
      where: { orderNo: { startsWith: prefix } },
      orderBy: { orderNo: "desc" },
      select: { orderNo: true },
    });
    const seq = lastOrder ? parseInt(lastOrder.orderNo.split("-").pop() || "0", 10) + 1 : 1;
    const orderNo = `${prefix}-${String(seq).padStart(4, "0")}`;

    // Auto-approve for ADMIN
    const isAutoApprove = user.role === "ADMIN";
    const status = isAutoApprove ? "APPROVED" : "PENDING";

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.transferOrder.create({
        data: {
          orderNo,
          status: status as "PENDING" | "APPROVED",
          notes: data.notes || null,
          createdById: user.id,
          reviewedById: isAutoApprove ? user.id : null,
          reviewedAt: isAutoApprove ? new Date() : null,
          items: {
            create: data.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              fromBinId: item.fromBinId,
              toBinId: item.toBinId,
            })),
          },
        },
        include: {
          createdBy: { select: { name: true } },
          items: {
            include: {
              product: { select: { name: true, sku: true } },
              fromBin: { select: { code: true, location: true } },
              toBin: { select: { code: true, location: true } },
            },
          },
        },
      });

      // If auto-approved, execute the transfers
      if (isAutoApprove) {
        for (const item of data.items) {
          // Move product to destination bin
          await tx.product.update({
            where: { id: item.productId },
            data: { binId: item.toBinId },
          });

          // Move serial items
          await tx.serialItem.updateMany({
            where: { productId: item.productId, binId: item.fromBinId, status: "IN_STOCK" },
            data: { binId: item.toBinId },
          });

          // Create inventory transaction record
          const product = productMap.get(item.productId)!;
          const fromBin = bins.find((b) => b.id === item.fromBinId);
          const toBin = bins.find((b) => b.id === item.toBinId);
          await tx.inventoryTransaction.create({
            data: {
              type: "TRANSFER",
              productId: item.productId,
              quantity: item.quantity,
              previousStock: product.currentStock,
              newStock: product.currentStock,
              referenceNo: orderNo,
              notes: `[APPROVED] From: ${fromBin?.code} → To: ${toBin?.code} | Transfer Order: ${orderNo}`,
              userId: user.id,
            },
          });
        }
      }

      return order;
    });

    return successResponse(result, 201);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to create transfer order", 400);
  }
}
