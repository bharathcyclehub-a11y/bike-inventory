/**
 * Run: npx tsx prisma/backfill-stock-levels.ts
 *
 * Seeds StockLevel WAREHOUSE rows from each product's existing currentStock + bin
 * location. Store stock is DERIVED (currentStock - warehouse), never stored — see
 * src/lib/stock-location.ts. Additive and idempotent; touches nothing on Product
 * or Bin, so it is fully reversible (just delete the StockLevel rows).
 *
 * Mapping (see src/lib/inventory-config.ts):
 *   - bin.location matching /warehouse/i  -> a WAREHOUSE row with the product's stock
 *   - everything else, and products with no bin -> Store (no row; derived)
 *
 * Any pre-existing STORE rows (from an earlier dual-row backfill) are deleted so
 * the derive model is the single source of truth.
 */
import { PrismaClient } from "@prisma/client";
import { binLocationToStockLocation } from "../src/lib/inventory-config";

const prisma = new PrismaClient();

async function main() {
  // Remove any stored STORE rows — Store is always derived now.
  const delResult = await prisma.stockLevel.deleteMany({ where: { location: "STORE" } });
  console.log(`Deleted ${delResult.count} stale STORE rows (Store is derived).`);

  const products = await prisma.product.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      sku: true,
      currentStock: true,
      reservedStock: true,
      bin: { select: { location: true } },
    },
  });

  const warehouseProducts = products.filter((p) => binLocationToStockLocation(p.bin?.location) === "WAREHOUSE");
  console.log(`Backfilling WAREHOUSE StockLevel for ${warehouseProducts.length} of ${products.length} active products...`);

  // Batched parallel upserts. Idempotent: upsert keyed by (productId, WAREHOUSE).
  const BATCH = 25;
  for (let i = 0; i < warehouseProducts.length; i += BATCH) {
    const chunk = warehouseProducts.slice(i, i + BATCH);
    await Promise.all(
      chunk.map((p) =>
        prisma.stockLevel.upsert({
          where: { productId_location: { productId: p.id, location: "WAREHOUSE" } },
          update: { quantity: p.currentStock, reservedQuantity: p.reservedStock },
          create: {
            productId: p.id,
            location: "WAREHOUSE",
            quantity: p.currentStock,
            reservedQuantity: p.reservedStock,
          },
        })
      )
    );
  }

  console.log(`✅ Upserted ${warehouseProducts.length} WAREHOUSE rows. Store stock derives from currentStock - warehouse.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
