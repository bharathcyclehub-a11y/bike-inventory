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

    // We need a default category and brand for imported items
    let defaultCategory = await prisma.category.findFirst({ where: { name: "Imported" } });
    if (!defaultCategory) {
      defaultCategory = await prisma.category.create({
        data: { name: "Imported", description: "Items imported from Zoho" },
      });
    }

    let defaultBrand = await prisma.brand.findFirst({ where: { name: "Imported" } });
    if (!defaultBrand) {
      defaultBrand = await prisma.brand.create({
        data: { name: "Imported" },
      });
    }

    // Build brand lookup cache — match Zoho brand field to local brands
    const allBrands = await prisma.brand.findMany();
    const brandMap = new Map(allBrands.map((b) => [b.name.toLowerCase(), b.id]));

    for (const item of items) {
      try {
        const zohoItem = item as Record<string, unknown>;
        const sku = (item.sku || `ZOHO-${String(Date.now()).slice(-6)}`).substring(0, 50);

        // Check if product already exists by SKU — update brand/pricing if so
        if (item.sku) {
          const existing = await prisma.product.findFirst({
            where: { sku: item.sku },
          });
          if (existing) {
            // Update with latest Zoho data (brand, pricing, GST)
            const brandName = String(zohoItem.brand || zohoItem.manufacturer || "").trim();
            let brandId = existing.brandId;
            if (brandName) {
              const existingBrandId = brandMap.get(brandName.toLowerCase());
              if (existingBrandId) {
                brandId = existingBrandId;
              } else {
                // Create new brand from Zoho data
                const newBrand = await prisma.brand.create({ data: { name: brandName } });
                brandMap.set(brandName.toLowerCase(), newBrand.id);
                brandId = newBrand.id;
              }
            }
            await prisma.product.update({
              where: { id: existing.id },
              data: {
                brandId,
                costPrice: Number(zohoItem.purchase_rate || existing.costPrice),
                sellingPrice: Number(zohoItem.rate || existing.sellingPrice),
                mrp: Number(zohoItem.rate || existing.mrp),
                gstRate: Number(zohoItem.tax_percentage || existing.gstRate),
                hsnCode: String(zohoItem.hsn_or_sac || existing.hsnCode || ""),
              },
            });
            skipped++; // counted as "updated existing"
            continue;
          }
        }

        // Resolve brand from Zoho item
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

        // Determine product type from Zoho item_type or product_type
        const zohoType = String(zohoItem.product_type || zohoItem.item_type || "").toLowerCase();
        let productType: "BICYCLE" | "SPARE_PART" | "ACCESSORY" = "SPARE_PART";
        if (zohoType.includes("bicycle") || zohoType.includes("cycle")) productType = "BICYCLE";
        else if (zohoType.includes("accessory")) productType = "ACCESSORY";

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
