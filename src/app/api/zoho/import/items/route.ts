export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { ZohoClient } from "@/lib/zoho";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError, getCurrentUser } from "@/lib/auth-helpers";

export async function POST() {
  try {
    await requireAuth(["ADMIN"]);
    const currentUser = await getCurrentUser();

    const zoho = new ZohoClient();
    const ready = await zoho.init();
    if (!ready) return errorResponse("Zoho not connected", 400);

    const log = await prisma.syncLog.create({
      data: { syncType: "import-items", status: "running", triggeredBy: currentUser?.id },
    });

    const items = await zoho.listAllItems();

    let imported = 0;
    let skipped = 0;
    let failed = 0;
    const errors: string[] = [];

    // Category resolution: Zoho category_name → auto-classify by name → Spares fallback
    const categoryCache: Record<string, string> = {};
    async function resolveCategory(name: string, zohoCategoryName?: string): Promise<string> {
      const zohoName = (zohoCategoryName || "").trim();
      if (zohoName && ["Bicycles", "Spares", "Accessories"].includes(zohoName)) {
        if (!categoryCache[zohoName]) {
          let cat = await prisma.category.findFirst({ where: { name: zohoName } });
          if (!cat) cat = await prisma.category.create({ data: { name: zohoName, description: `${zohoName} category` } });
          categoryCache[zohoName] = cat.id;
        }
        return categoryCache[zohoName];
      }
      const isBicycle = /\b\d{2,2}(\.\d)?["']?\s*(t\b|ss\b|ms\b|fs\b|sp\b)/i.test(name) || /\b(bicycle|cycle|e-bicycle|e-bike|ebike)\b/i.test(name) || /\b(MTB|mountain.bike|road.bike|hybrid|fat.bike|cruiser)\b/i.test(name) || /\b(geared|non.geared|single.speed|7.speed|21.speed|shimano.*speed)\b/i.test(name);
      const isAccessory = /\b(helmet|lock|pump|light|bell|bottle|cage|mirror|stand|carrier|basket|mudguard|fender|glove|jersey|shorts|bag|pannier|horn|hooter|tool.kit|repair.kit|training.wheel)\b/i.test(name);
      const catName = isBicycle ? "Bicycles" : isAccessory ? "Accessories" : "Spares";
      if (!categoryCache[catName]) {
        let cat = await prisma.category.findFirst({ where: { name: catName } });
        if (!cat) cat = await prisma.category.create({ data: { name: catName, description: `${catName} category` } });
        categoryCache[catName] = cat.id;
      }
      return categoryCache[catName];
    }

    let defaultBrand = await prisma.brand.findFirst({ where: { name: "Imported" } });
    if (!defaultBrand) {
      defaultBrand = await prisma.brand.create({
        data: { name: "Imported" },
      });
    }

    for (const item of items) {
      try {
        const zohoItem = item as Record<string, unknown>;
        const sku = (item.sku || `ZOHO-${String(Date.now()).slice(-6)}`).substring(0, 50);

        // Check if product already exists by SKU — update pricing only (brand managed manually)
        if (item.sku) {
          const existing = await prisma.product.findFirst({
            where: { sku: item.sku },
          });
          if (existing) {
            await prisma.product.update({
              where: { id: existing.id },
              data: {
                costPrice: Number(zohoItem.purchase_rate || existing.costPrice),
                sellingPrice: Number(zohoItem.rate || existing.sellingPrice),
                mrp: Number(zohoItem.rate || existing.mrp),
                gstRate: Number(zohoItem.tax_percentage || existing.gstRate),
                hsnCode: String(zohoItem.hsn_or_sac || existing.hsnCode || ""),
              },
            });
            skipped++;
            continue;
          }
        }

        // Determine product type from Zoho item_type or product_type
        const zohoType = String(zohoItem.product_type || zohoItem.item_type || "").toLowerCase();
        let productType: "BICYCLE" | "SPARE_PART" | "ACCESSORY" = "SPARE_PART";
        if (zohoType.includes("bicycle") || zohoType.includes("cycle")) productType = "BICYCLE";
        else if (zohoType.includes("accessory")) productType = "ACCESSORY";

        const itemCategoryId = await resolveCategory(item.name, item.category_name || "");

        await prisma.product.create({
          data: {
            sku,
            name: item.name,
            categoryId: itemCategoryId,
            brandId: defaultBrand.id,
            type: productType,
            costPrice: Number(zohoItem.purchase_rate || 0),
            sellingPrice: Number(zohoItem.rate || 0),
            mrp: Number(zohoItem.rate || 0),
            gstRate: Number(zohoItem.tax_percentage || 18),
            hsnCode: String(zohoItem.hsn_or_sac || ""),
            currentStock: Number(zohoItem.stock_on_hand || 0),
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
        totalItems: items.length,
        synced: imported,
        failed,
        errors: errors.length > 0 ? JSON.stringify(errors) : null,
        completedAt: new Date(),
      },
    });

    return successResponse({
      syncType: "import-items",
      status,
      total: items.length,
      imported,
      skipped,
      failed,
      errors,
    });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Import failed", 500);
  }
}
