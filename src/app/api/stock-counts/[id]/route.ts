export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { stockCountUpdateSchema } from "@/lib/validations";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(["ADMIN", "SUPERVISOR", "PURCHASE_MANAGER", "ACCOUNTS_MANAGER", "INWARDS_CLERK", "OUTWARDS_CLERK"]);
    const { id } = await params;

    // Clerks can only view their assigned stock counts
    if (["INWARDS_CLERK", "OUTWARDS_CLERK"].includes(user.role)) {
      const check = await prisma.stockCount.findUnique({ where: { id }, select: { assignedToId: true } });
      if (!check) return errorResponse("Stock count not found", 404);
      if (check.assignedToId !== user.id) return errorResponse("You can only access stock counts assigned to you", 403);
    }

    const stockCount = await prisma.stockCount.findUnique({
      where: { id },
      include: {
        assignedTo: { select: { name: true } },
        approvedBy: { select: { name: true } },
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

    // Clerks can only update their assigned stock counts
    if (["INWARDS_CLERK", "OUTWARDS_CLERK"].includes(user.role)) {
      if (existing.assignedToId !== user.id) return errorResponse("You can only update stock counts assigned to you", 403);
    }

    // Only ADMIN/ACCOUNTS_MANAGER can approve or reject
    if (data.status === "APPROVED" || data.status === "REJECTED") {
      if (!["ADMIN", "ACCOUNTS_MANAGER"].includes(user.role)) {
        return errorResponse("Only Admin or Accounts Manager can approve/reject stock counts", 403);
      }
    }

    // ADMIN cannot start or complete counts — only approve/reject
    if (user.role === "ADMIN" && (data.status === "IN_PROGRESS" || data.status === "COMPLETED")) {
      return errorResponse("Admin can only approve or reject stock counts, not initiate or complete them", 403);
    }

    // Status transition guards
    if (data.status) {
      const VALID_TRANSITIONS: Record<string, string[]> = {
        PENDING: ["IN_PROGRESS"],
        IN_PROGRESS: ["COMPLETED"],
        COMPLETED: ["APPROVED", "REJECTED"],
        REJECTED: ["IN_PROGRESS"], // Can re-start after rejection
        APPROVED: [], // Final state
      };
      const allowed = VALID_TRANSITIONS[existing.status] || [];
      if (!allowed.includes(data.status)) {
        return errorResponse(
          `Cannot change status from ${existing.status} to ${data.status}. ${
            existing.status === "APPROVED" ? "This stock count is already approved." : `Must be ${allowed.join(" or ")} next.`
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
      if (data.status === "COMPLETED") {
        updateData.completedAt = new Date();

        // Baseline mode: auto-set uncounted items to countedQty=0 (not found = 0 stock)
        const BASELINE_END = new Date("2026-05-31T23:59:59+05:30");
        if (new Date() <= BASELINE_END) {
          const uncountedItems = await tx.stockCountItem.findMany({
            where: { stockCountId: id, countedQty: null },
            select: { id: true, systemQty: true },
          });
          for (const item of uncountedItems) {
            await tx.stockCountItem.update({
              where: { id: item.id },
              data: { countedQty: 0, variance: 0 - item.systemQty, countedAt: new Date() },
            });
          }
        }
      }
      if (data.status === "APPROVED") {
        updateData.approvedById = user.id;
        updateData.approvedAt = new Date();
      }
      if (data.status === "REJECTED") {
        updateData.rejectionReason = data.rejectionReason || null;
      }

      // When APPROVED: apply counted quantities to product stock + brands
      if (data.status === "APPROVED") {
        const BASELINE_END = new Date("2026-05-31T23:59:59+05:30");
        const isBaselinePeriod = new Date() <= BASELINE_END;

        const countedItems = await tx.stockCountItem.findMany({
          where: { stockCountId: id, countedQty: { not: null } },
          include: { product: { select: { brandId: true, brand: { select: { name: true } } } } },
        });

        for (const item of countedItems) {
          if (item.countedQty === null) continue;

          const product = await tx.product.findUnique({
            where: { id: item.productId },
            select: { id: true, currentStock: true, binId: true, brandId: true, brand: { select: { name: true } } },
          });

          if (!product) continue;

          // Apply suggested brand if item's current brand is Imported/Unbranded/missing
          let brandUpdate: Record<string, string> = {};
          if (item.suggestedBrand && (!product.brand || ["Imported", "Unbranded", "General"].includes(product.brand.name))) {
            const targetBrand = await tx.brand.findFirst({
              where: { name: { equals: item.suggestedBrand, mode: "insensitive" } },
            });
            if (targetBrand) {
              brandUpdate = { brandId: targetBrand.id };
            } else {
              // Create new brand
              const newBrand = await tx.brand.create({ data: { name: item.suggestedBrand } });
              brandUpdate = { brandId: newBrand.id };
            }
          }

          if (isBaselinePeriod) {
            // --- BASELINE MODE (until May 31): Stock count = INWARD + PUTAWAY ---
            // Only assign bin if item was actually found (count > 0)
            const assignBin = existing.binId && item.countedQty > 0;
            await tx.product.update({
              where: { id: product.id },
              data: {
                currentStock: item.countedQty,
                ...(assignBin && { binId: existing.binId }),
                ...brandUpdate,
              },
            });

            await tx.inventoryTransaction.create({
              data: {
                type: "INWARD",
                productId: product.id,
                quantity: item.countedQty,
                previousStock: product.currentStock,
                newStock: item.countedQty,
                referenceNo: existing.title,
                notes: `[STOCK_COUNT] [BASELINE] Counted ${item.countedQty} units${existing.binId ? " — placed in bin" : ""}${item.suggestedBrand ? ` — brand: ${item.suggestedBrand}` : ""} during "${existing.title}"`,
                userId: user.id,
              },
            });
          } else {
            // --- VERIFICATION MODE (after May 31): Stock count = AUDIT ---
            const variance = item.countedQty - product.currentStock;

            await tx.product.update({
              where: { id: product.id },
              data: {
                currentStock: item.countedQty,
                ...(existing.binId && { binId: existing.binId }),
                ...brandUpdate,
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
    const user = await requireAuth(["ADMIN", "SUPERVISOR", "ACCOUNTS_MANAGER"]);
    const { id } = await params;

    const stockCount = await prisma.stockCount.findUnique({ where: { id } });
    if (!stockCount) return errorResponse("Stock count not found", 404);

    if (stockCount.status === "APPROVED") {
      return errorResponse("Cannot delete an approved stock count", 403);
    }

    if (stockCount.status === "COMPLETED") {
      // Only ADMIN can delete completed stock counts
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
