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

    const data = await zoho.listItems(1);
    const items = data.items || [];

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

    for (const item of items) {
      try {
        // Check if product already exists by SKU
        if (item.sku) {
          const existing = await prisma.product.findFirst({
            where: { sku: item.sku },
          });
          if (existing) {
            skipped++;
            continue;
          }
        }

        const zohoItem = item as Record<string, unknown>;
        const sku = (item.sku || `ZOHO-${String(Date.now()).slice(-6)}`).substring(0, 50);

        await prisma.product.create({
          data: {
            sku,
            name: item.name,
            categoryId: defaultCategory.id,
            brandId: defaultBrand.id,
            type: "SPARE_PART",
            costPrice: Number(zohoItem.purchase_rate || 0),
            sellingPrice: Number(zohoItem.rate || 0),
            mrp: Number(zohoItem.rate || 0),
            gstRate: Number(zohoItem.tax_percentage || 18),
            hsnCode: String(zohoItem.hsn_or_sac || ""),
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
