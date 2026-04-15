export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { ZohoClient } from "@/lib/zoho";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

export async function POST() {
  try {
    const user = await requireAuth(["ADMIN"]);

    const zoho = new ZohoClient();
    const ready = await zoho.init();
    if (!ready) return errorResponse("Zoho not connected", 400);

    const log = await prisma.syncLog.create({
      data: { syncType: "clean-import", status: "running", triggeredBy: user.id },
    });

    // Step 1: Pull ALL items from Zoho
    const allItems = await zoho.listAllItems();

    // Step 2: Filter — only active items with stock > 0
    const activeItems = allItems.filter((item) => {
      const stock = Number(item.stock_on_hand || 0);
      return stock > 0;
    });

    // Step 3: Delete all existing products (cascade: serial items, transactions, stock count items, PO items)
    await prisma.$transaction(async (tx) => {
      await tx.serialTransactionItem.deleteMany({});
      await tx.serialItem.deleteMany({});
      await tx.stockCountItem.deleteMany({});
      await tx.inventoryTransaction.deleteMany({});
      await tx.purchaseOrderItem.deleteMany({});
      await tx.product.deleteMany({});
      // Clean up brands (except "General") and categories (except "General")
      // Keep all brands/categories — they'll be re-created as needed
    });

    // Step 4: Ensure default category exists
    let defaultCategory = await prisma.category.findFirst({ where: { name: "Imported" } });
    if (!defaultCategory) {
      defaultCategory = await prisma.category.create({
        data: { name: "Imported", description: "Items imported from Zoho" },
      });
    }

    // Step 5: Build brand cache
    const allBrands = await prisma.brand.findMany();
    const brandMap = new Map(allBrands.map((b) => [b.name.toLowerCase(), b.id]));

    // Ensure a fallback brand exists
    let defaultBrand = await prisma.brand.findFirst({ where: { name: "Unbranded" } });
    if (!defaultBrand) {
      defaultBrand = await prisma.brand.create({ data: { name: "Unbranded" } });
      brandMap.set("unbranded", defaultBrand.id);
    }

    // Step 6: Import active items
    let imported = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const item of activeItems) {
      try {
        const zohoItem = item as Record<string, unknown>;
        const sku = (item.sku || `ZOHO-${String(Date.now()).slice(-8)}-${imported}`).substring(0, 50);

        // Resolve brand
        const brandName = String(zohoItem.brand || zohoItem.manufacturer || "").trim();
        let brandId = defaultBrand.id;
        if (brandName) {
          const existingBrandId = brandMap.get(brandName.toLowerCase());
          if (existingBrandId) {
            brandId = existingBrandId;
          } else {
            const newBrand = await prisma.brand.create({ data: { name: brandName } });
            brandMap.set(brandName.toLowerCase(), newBrand.id);
            brandId = newBrand.id;
          }
        }

        // Determine product type
        const zohoType = String(zohoItem.product_type || zohoItem.item_type || "").toLowerCase();
        let productType: "BICYCLE" | "SPARE_PART" | "ACCESSORY" = "SPARE_PART";
        if (zohoType.includes("bicycle") || zohoType.includes("cycle")) productType = "BICYCLE";
        else if (zohoType.includes("accessory")) productType = "ACCESSORY";

        const stock = Number(zohoItem.stock_on_hand || 0);

        await prisma.product.create({
          data: {
            sku,
            name: item.name,
            categoryId: defaultCategory.id,
            brandId,
            type: productType,
            costPrice: Number(zohoItem.purchase_rate || 0),
            sellingPrice: Number(zohoItem.rate || 0),
            mrp: Number(zohoItem.rate || 0),
            gstRate: Number(zohoItem.tax_percentage || 18),
            hsnCode: String(zohoItem.hsn_or_sac || ""),
            currentStock: stock,
          },
        });
        imported++;
      } catch (err) {
        failed++;
        errors.push(`${item.name}: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }

    const status = failed === 0 ? "success" : imported === 0 ? "failed" : "partial";

    await prisma.syncLog.update({
      where: { id: log.id },
      data: {
        status,
        totalItems: allItems.length,
        synced: imported,
        failed,
        errors: errors.length > 0 ? JSON.stringify(errors) : null,
        completedAt: new Date(),
      },
    });

    return successResponse({
      syncType: "clean-import",
      status,
      zohoTotal: allItems.length,
      activeWithStock: activeItems.length,
      imported,
      failed,
      errors: errors.slice(0, 20),
    });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Clean import failed", 500);
  }
}
