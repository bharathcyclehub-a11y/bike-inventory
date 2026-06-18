/**
 * Run: npx tsx prisma/migrate-to-4-locations.ts
 *
 * Moves from the old 2-bucket model (STORE derived + WAREHOUSE) to 4 explicit
 * locations (BCH/BCC × Warehouse/Store). The current on-hand (all in WAREHOUSE)
 * becomes BCH_WAREHOUSE; everything else stays 0 and will be set by today's counts.
 *
 * Idempotent and additive — re-running is safe. Reconciles sum(StockLevel) ==
 * Product.currentStock at the end.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Legacy STORE rows (if any) were derived; drop them.
  const delStore = await prisma.stockLevel.deleteMany({ where: { location: "STORE" } });
  console.log(`Deleted ${delStore.count} legacy STORE rows.`);

  // Move the seeded warehouse stock into BCH Warehouse.
  const moved = await prisma.stockLevel.updateMany({
    where: { location: "WAREHOUSE" },
    data: { location: "BCH_WAREHOUSE" },
  });
  console.log(`Moved ${moved.count} WAREHOUSE rows -> BCH_WAREHOUSE.`);

  // Reconcile sum(StockLevel) == currentStock for products that have rows.
  const grouped = await prisma.stockLevel.groupBy({ by: ["productId"], _sum: { quantity: true } });
  const ids = grouped.map((g) => g.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: { id: true, sku: true, currentStock: true },
  });
  const curById = new Map(products.map((p) => [p.id, p]));
  const mismatches: string[] = [];
  for (const g of grouped) {
    const p = curById.get(g.productId);
    const sum = g._sum.quantity ?? 0;
    if (p && sum !== p.currentStock) mismatches.push(`${p.sku}: currentStock=${p.currentStock}, StockLevel sum=${sum}`);
  }

  const byLoc = await prisma.stockLevel.groupBy({ by: ["location"], _count: { _all: true }, _sum: { quantity: true } });
  console.log("\nStockLevel by location:");
  for (const g of byLoc) console.log(`  ${g.location}: ${g._count._all} rows, ${g._sum.quantity ?? 0} units`);

  if (mismatches.length) {
    console.error(`\n❌ ${mismatches.length} reconciliation mismatch(es):`);
    mismatches.forEach((m) => console.error(`   ${m}`));
    process.exitCode = 1;
  } else {
    console.log(`\n✅ Reconciliation passed for ${grouped.length} products with stock.`);
  }
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
