export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { ZohoClient } from "@/lib/zoho";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

const BATCH_SIZE = 25; // Stay within Vercel's 60s timeout

export async function POST() {
  try {
    await requireAuth(["ADMIN"]);

    const zoho = new ZohoClient();
    const ready = await zoho.init();
    if (!ready) return errorResponse("Zoho not connected", 400);

    // Find products that have a zohoItemId but are still "Unbranded"
    const unbrandedBrand = await prisma.brand.findFirst({ where: { name: "Unbranded" } });
    if (!unbrandedBrand) {
      return successResponse({ message: "No 'Unbranded' brand found — nothing to enrich", updated: 0, remaining: 0 });
    }

    const products = await prisma.product.findMany({
      where: {
        brandId: unbrandedBrand.id,
        zohoItemId: { not: null },
      },
      select: { id: true, zohoItemId: true, name: true },
      take: BATCH_SIZE,
    });

    if (products.length === 0) {
      const totalUnbranded = await prisma.product.count({ where: { brandId: unbrandedBrand.id } });
      return successResponse({
        message: totalUnbranded > 0
          ? `${totalUnbranded} products still unbranded but have no Zoho ID`
          : "All products have brands assigned!",
        updated: 0,
        remaining: 0,
      });
    }

    // Build brand cache
    const allBrands = await prisma.brand.findMany();
    const brandMap = new Map(allBrands.map((b) => [b.name.toLowerCase(), b.id]));

    let updated = 0;
    let failed = 0;
    const enriched: Array<{ name: string; brand: string; gst: number }> = [];
    const errors: string[] = [];

    for (const product of products) {
      try {
        const detail = await zoho.getItem(product.zohoItemId!);
        const item = detail.item as Record<string, unknown>;

        // Extract brand
        const brandName = String(item.brand || item.manufacturer || "").trim();

        // Extract GST from item_tax_preferences
        let gstRate = 0;
        const taxPrefs = item.item_tax_preferences as Array<{ tax_percentage?: number; tax_type?: string }> | undefined;
        if (taxPrefs && taxPrefs.length > 0) {
          // Prefer intra-state GST (CGST+SGST)
          const intraTax = taxPrefs.find((t) => t.tax_type !== "inter_state");
          gstRate = Number(intraTax?.tax_percentage || taxPrefs[0]?.tax_percentage || 0);
        }

        if (brandName) {
          const existingBrandId = brandMap.get(brandName.toLowerCase());
          let brandId: string;
          if (existingBrandId) {
            brandId = existingBrandId;
          } else {
            const newBrand = await prisma.brand.create({ data: { name: brandName } });
            brandMap.set(brandName.toLowerCase(), newBrand.id);
            brandId = newBrand.id;
          }

          await prisma.product.update({
            where: { id: product.id },
            data: {
              brandId,
              ...(gstRate > 0 ? { gstRate } : {}),
            },
          });
          enriched.push({ name: product.name, brand: brandName, gst: gstRate });
          updated++;
        } else if (gstRate > 0) {
          // No brand found but has GST — still update GST
          await prisma.product.update({
            where: { id: product.id },
            data: { gstRate },
          });
          enriched.push({ name: product.name, brand: "—", gst: gstRate });
          updated++;
        }
      } catch (err) {
        failed++;
        errors.push(`${product.name}: ${err instanceof Error ? err.message : "Unknown"}`);
      }
    }

    // Count remaining
    const remaining = await prisma.product.count({
      where: { brandId: unbrandedBrand.id, zohoItemId: { not: null } },
    });

    return successResponse({
      batchSize: BATCH_SIZE,
      processed: products.length,
      updated,
      failed,
      remaining,
      enriched,
      errors: errors.slice(0, 10),
    });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Brand enrichment failed", 500);
  }
}
