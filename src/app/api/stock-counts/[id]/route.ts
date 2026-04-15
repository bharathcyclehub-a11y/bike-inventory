export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { stockCountUpdateSchema } from "@/lib/validations";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(["ADMIN", "SUPERVISOR", "PURCHASE_MANAGER", "ACCOUNTS_MANAGER", "INWARDS_CLERK", "OUTWARDS_CLERK"]);
    const { id } = await params;

    const stockCount = await prisma.stockCount.findUnique({
      where: { id },
      include: {
        assignedTo: { select: { name: true } },
        bin: { select: { code: true, name: true, location: true } },
        items: {
          include: {
            product: {
              select: { name: true, sku: true, currentStock: true, type: true, category: { select: { name: true } }, brand: { select: { name: true } }, bin: { select: { code: true, location: true } } },
            },
          },
          orderBy: { product: { name: "asc" } },
        },
      },
    });

    if (!stockCount) return errorResponse("Stock count not found", 404);

    const countedItems = stockCount.items.filter((i) => i.countedQty !== null).length;
    const totalVariance = stockCount.items.reduce((sum, i) => sum + (i.variance || 0), 0);
    const itemsWithVariance = stockCount.items.filter((i) => i.variance !== null && i.variance !== 0).length;

    return successResponse({
      ...stockCount,
      countedItems,
      totalItems: stockCount.items.length,
      totalVariance,
      itemsWithVariance,
    });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch stock count", 500);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(["ADMIN", "SUPERVISOR", "PURCHASE_MANAGER", "ACCOUNTS_MANAGER", "INWARDS_CLERK", "OUTWARDS_CLERK"]);
    const { id } = await params;
    const body = await req.json();
    const data = stockCountUpdateSchema.parse(body);

    const existing = await prisma.stockCount.findUnique({ where: { id } });
    if (!existing) return errorResponse("Stock count not found", 404);

    // Status transition guards
    if (data.status) {
      const VALID_TRANSITIONS: Record<string, string[]> = {
        PENDING: ["IN_PROGRESS"],
        IN_PROGRESS: ["COMPLETED"],
        COMPLETED: [], // Cannot transition from COMPLETED
      };
      const allowed = VALID_TRANSITIONS[existing.status] || [];
      if (!allowed.includes(data.status)) {
        return errorResponse(
          `Cannot change status from ${existing.status} to ${data.status}. ${
            existing.status === "COMPLETED" ? "This stock count is already completed." : `Must be ${allowed.join(" or ")} next.`
          }`,
          400
        );
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      if (data.items && data.items.length > 0) {
        for (const item of data.items) {
          if (item.countedQty < 0) continue; // Reject negative counts
          const existingItem = await tx.stockCountItem.findUnique({ where: { id: item.id } });
          if (existingItem) {
            await tx.stockCountItem.update({
              where: { id: item.id },
              data: {
                countedQty: item.countedQty,
                variance: item.countedQty - existingItem.systemQty,
                notes: item.notes ?? existingItem.notes,
                countedAt: new Date(),
              },
            });
          }
        }
      }

      const updateData: Record<string, unknown> = {};
      if (data.status) updateData.status = data.status;
      if (data.notes !== undefined) updateData.notes = data.notes;
      if (data.status === "COMPLETED") updateData.completedAt = new Date();

      // When completing: apply counted quantities to product stock
      if (data.status === "COMPLETED") {
        const BASELINE_END = new Date("2026-04-19T23:59:59+05:30");
        const isBaselinePeriod = new Date() <= BASELINE_END;

        const countedItems = await tx.stockCountItem.findMany({
          where: { stockCountId: id, countedQty: { not: null } },
        });

        for (const item of countedItems) {
          if (item.countedQty === null || item.countedQty === 0) continue;

          const product = await tx.product.findUnique({
            where: { id: item.productId },
            select: { id: true, currentStock: true, binId: true },
          });

          if (!product) continue;

          if (isBaselinePeriod) {
            // --- BASELINE MODE (Apr 14-19): Stock count = INWARD + PUTAWAY ---
            // 1. Set product stock to counted quantity
            await tx.product.update({
              where: { id: product.id },
              data: {
                currentStock: item.countedQty,
                // 2. PUTAWAY: assign product to this bin
                ...(existing.binId && { binId: existing.binId }),
              },
            });

            // 3. Create INWARD transaction (this is inventory intake, not an audit)
            await tx.inventoryTransaction.create({
              data: {
                type: "INWARD",
                productId: product.id,
                quantity: item.countedQty,
                previousStock: product.currentStock,
                newStock: item.countedQty,
                referenceNo: existing.title,
                notes: `[STOCK_COUNT] [BASELINE] Counted ${item.countedQty} units${existing.binId ? " — placed in bin" : ""} during "${existing.title}"`,
                userId: user.id,
              },
            });
          } else {
            // --- VERIFICATION MODE (after Apr 19): Stock count = AUDIT ---
            // Compare counted vs system, create adjustment only for variance
            const variance = item.countedQty - product.currentStock;

            await tx.product.update({
              where: { id: product.id },
              data: {
                currentStock: item.countedQty,
                ...(existing.binId && { binId: existing.binId }),
              },
            });

            if (variance !== 0) {
              await tx.inventoryTransaction.create({
                data: {
                  type: "ADJUSTMENT",
                  productId: product.id,
                  quantity: Math.abs(variance),
                  previousStock: product.currentStock,
                  newStock: item.countedQty,
                  referenceNo: existing.title,
                  notes: `[STOCK_COUNT] [VERIFICATION] ${variance > 0 ? "Surplus" : "Shortage"} of ${Math.abs(variance)} found during "${existing.title}"`,
                  userId: user.id,
                },
              });
            }
          }
        }
      }

      const updated = await tx.stockCount.update({
        where: { id },
        data: updateData,
        include: {
          assignedTo: { select: { name: true } },
          _count: { select: { items: true } },
        },
      });

      return updated;
    });

    return successResponse(result);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to update stock count", 400);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(["ADMIN", "SUPERVISOR", "PURCHASE_MANAGER", "ACCOUNTS_MANAGER", "INWARDS_CLERK", "OUTWARDS_CLERK"]);
    const { id } = await params;

    const stockCount = await prisma.stockCount.findUnique({ where: { id } });
    if (!stockCount) return errorResponse("Stock count not found", 404);

    if (stockCount.status === "COMPLETED") {
      // Only ADMIN can delete completed stock counts (with full reversal)
      if (user.role !== "ADMIN") {
        return errorResponse("Only ADMIN can delete a completed stock count", 403);
      }

      await prisma.$transaction(async (tx) => {
        // Find all transactions created by this stock count
        const transactions = await tx.inventoryTransaction.findMany({
          where: {
            referenceNo: stockCount.title,
            notes: { contains: "[STOCK_COUNT]" },
          },
        });

        // Reverse each product's stock and bin assignment
        for (const txn of transactions) {
          const product = await tx.product.findUnique({
            where: { id: txn.productId },
            select: { id: true, binId: true },
          });
          if (!product) continue;

          await tx.product.update({
            where: { id: product.id },
            data: {
              currentStock: txn.previousStock,
              // Clear bin only if it was assigned by this stock count
              ...(stockCount.binId && product.binId === stockCount.binId && { binId: null }),
            },
          });
        }

        // Delete the transactions
        await tx.inventoryTransaction.deleteMany({
          where: {
            referenceNo: stockCount.title,
            notes: { contains: "[STOCK_COUNT]" },
          },
        });

        // Delete count items and count
        await tx.stockCountItem.deleteMany({ where: { stockCountId: id } });
        await tx.stockCount.delete({ where: { id } });
      });

      return successResponse({ deleted: true, reversed: true });
    }

    // Non-completed counts: simple delete
    await prisma.$transaction([
      prisma.stockCountItem.deleteMany({ where: { stockCountId: id } }),
      prisma.stockCount.delete({ where: { id } }),
    ]);

    return successResponse({ deleted: true });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to delete stock count", 400);
  }
}
