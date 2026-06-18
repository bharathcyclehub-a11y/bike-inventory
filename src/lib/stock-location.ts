// Per-location stock helpers. See inventory-config.ts for the location set.
//
// Model: each (product, location) has an explicit StockLevel row. Product.currentStock
// is the cached SUM of a product's rows, recomputed on every change. There is no
// "derived" location — counting/receiving/transferring all write a specific location
// and then recompute the total.
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { StockLocation } from "@/lib/inventory-config";

type Tx = Prisma.TransactionClient;
type DbClient = Tx | typeof prisma;

// Recompute and persist Product.currentStock = sum of its StockLevel quantities.
// Returns the new total.
export async function recomputeCurrentStock(tx: Tx, productId: string): Promise<number> {
  const agg = await tx.stockLevel.aggregate({
    where: { productId },
    _sum: { quantity: true },
  });
  const total = agg._sum.quantity ?? 0;
  await tx.product.update({ where: { id: productId }, data: { currentStock: total } });
  return total;
}

// Change a location's quantity by delta (may be negative). Clamps at 0, upserts the
// row, then recomputes currentStock. Returns the new total.
export async function adjustLocationQty(tx: Tx, productId: string, location: StockLocation, delta: number): Promise<number> {
  const existing = await tx.stockLevel.findUnique({
    where: { productId_location: { productId, location } },
    select: { quantity: true },
  });
  const next = Math.max(0, (existing?.quantity ?? 0) + delta);
  await tx.stockLevel.upsert({
    where: { productId_location: { productId, location } },
    update: { quantity: next },
    create: { productId, location, quantity: next },
  });
  return recomputeCurrentStock(tx, productId);
}

// Set a location's quantity to an absolute value (clamped >= 0), then recompute
// currentStock. Used by stock counts. Returns the new total.
export async function setLocationQty(tx: Tx, productId: string, location: StockLocation, qty: number): Promise<number> {
  const next = Math.max(0, qty);
  await tx.stockLevel.upsert({
    where: { productId_location: { productId, location } },
    update: { quantity: next },
    create: { productId, location, quantity: next },
  });
  return recomputeCurrentStock(tx, productId);
}

// Quantity at one location for many products (productId -> qty, missing = 0).
export async function getLocationQtyMap(productIds: string[], location: StockLocation, client: DbClient = prisma): Promise<Map<string, number>> {
  if (productIds.length === 0) return new Map();
  const rows = await client.stockLevel.findMany({
    where: { productId: { in: productIds }, location },
    select: { productId: true, quantity: true },
  });
  return new Map(rows.map((r) => [r.productId, r.quantity]));
}

// Quantity at one location for a single product (0 if no row).
export async function getLocationQty(productId: string, location: StockLocation, client: DbClient = prisma): Promise<number> {
  const row = await client.stockLevel.findUnique({
    where: { productId_location: { productId, location } },
    select: { quantity: true },
  });
  return row?.quantity ?? 0;
}

// Full per-location breakdown for many products: productId -> { location -> qty }.
export async function getLocationBreakdown(productIds: string[], client: DbClient = prisma): Promise<Map<string, Record<string, number>>> {
  const out = new Map<string, Record<string, number>>();
  if (productIds.length === 0) return out;
  const rows = await client.stockLevel.findMany({
    where: { productId: { in: productIds } },
    select: { productId: true, location: true, quantity: true },
  });
  for (const r of rows) {
    const cur = out.get(r.productId) ?? {};
    cur[r.location] = r.quantity;
    out.set(r.productId, cur);
  }
  return out;
}
