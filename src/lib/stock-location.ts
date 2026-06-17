// Per-location stock helpers. See docs in inventory-config.ts for the design.
//
// Model: WAREHOUSE quantity is tracked explicitly in StockLevel. STORE is always
// DERIVED as (currentStock - warehouse), so every stock mutation that isn't
// warehouse-aware (sales, Zoho import, audit, reset...) needs no changes and the
// invariant store + warehouse == currentStock holds by construction.
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

type Tx = Prisma.TransactionClient;
type DbClient = Tx | typeof prisma;

// On-hand split for display. Warehouse is clamped into [0, currentStock] so Store
// is never negative even if an oversell temporarily left a stale-high warehouse row.
export function splitStock(currentStock: number, warehouseQty: number): { store: number; warehouse: number } {
  const warehouse = Math.max(0, Math.min(warehouseQty, currentStock));
  return { store: currentStock - warehouse, warehouse };
}

// Warehouse quantity for many products at once (productId -> qty, missing = 0).
export async function getWarehouseQtyMap(productIds: string[], client: DbClient = prisma): Promise<Map<string, number>> {
  if (productIds.length === 0) return new Map();
  const rows = await client.stockLevel.findMany({
    where: { productId: { in: productIds }, location: "WAREHOUSE" },
    select: { productId: true, quantity: true },
  });
  return new Map(rows.map((r) => [r.productId, r.quantity]));
}

// Warehouse quantity for a single product (0 if no row).
export async function getWarehouseQty(productId: string, client: DbClient = prisma): Promise<number> {
  const row = await client.stockLevel.findUnique({
    where: { productId_location: { productId, location: "WAREHOUSE" } },
    select: { quantity: true },
  });
  return row?.quantity ?? 0;
}

// Adjust warehouse quantity by a delta (may be negative). Clamps at 0, upserts the row.
// Returns the new warehouse quantity.
export async function adjustWarehouseQty(tx: Tx, productId: string, delta: number): Promise<number> {
  const existing = await tx.stockLevel.findUnique({
    where: { productId_location: { productId, location: "WAREHOUSE" } },
    select: { quantity: true },
  });
  const next = Math.max(0, (existing?.quantity ?? 0) + delta);
  await tx.stockLevel.upsert({
    where: { productId_location: { productId, location: "WAREHOUSE" } },
    update: { quantity: next },
    create: { productId, location: "WAREHOUSE", quantity: next },
  });
  return next;
}
