export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { ZohoClient } from "@/lib/zoho";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

const BATCH_SIZE = 15; // 15 items × 500ms delay = ~7.5s + processing, well within Vercel's 60s timeout

export async function POST() {
  try {
    await requireAuth(["ADMIN"]);

    const zoho = new ZohoClient();
    const ready = await zoho.init();
    if (!ready) return errorResponse("Zoho not connected", 400);

    const unbrandedBrand = await prisma.brand.findFirst({ where: { name: "Unbranded" } });
    if (!unbrandedBrand) {
      return successResponse({ message: "No 'Unbranded' brand found — nothing to enrich", updated: 0, remaining: 0 });
    }

    // Get unbranded products (prefer those with zohoItemId, then fall back to SKU match)
    const products = await prisma.product.findMany({
      where: { brandId: unbrandedBrand.id },
      select: { id: true, sku: true, zohoItemId: true, name: true },
      take: BATCH_SIZE,
    });

    if (products.length === 0) {
      return successResponse({ message: "All products have brands assigned!", updated: 0, remaining: 0 });
    }

    // For products without zohoItemId, we need to find their Zoho item_id by SKU
    const needsLookup = products.filter((p) => !p.zohoItemId);
    let skuToItemId: Map<string, string> | null = null;

    if (needsLookup.length > 0) {
      // Pull all Zoho items once (cached across batches via Zoho pagination)
      const allZohoItems = await zoho.listAllItems("active");
      skuToItemId = new Map(allZohoItems.map((z) => [z.sku, z.item_id]));

      // Backfill zohoItemId for matched products
      for (const p of needsLookup) {
        const zohoId = skuToItemId.get(p.sku);
        if (zohoId) {
          await prisma.product.update({
            where: { id: p.id },
            data: { zohoItemId: zohoId },
          });
          p.zohoItemId = zohoId;
        }
      }
    }

    // Build brand cache
    const allBrands = await prisma.brand.findMany();
    const brandMap = new Map(allBrands.map((b) => [b.name.toLowerCase(), b.id]));

    let updated = 0;
    let failed = 0;
    const enriched: Array<{ name: string; brand: string; gst: number }> = [];
    const errors: string[] = [];

    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      if (!product.zohoItemId) {
        failed++;
        errors.push(`${product.name}: No Zoho ID found (SKU: ${product.sku})`);
        continue;
      }

      // Throttle: 500ms between Zoho detail API calls to avoid rate limit
      if (i > 0) await zoho.delay(500);

      try {
        const detail = await zoho.getItem(product.zohoItemId);
        const item = detail.item as Record<string, unknown>;

        // Extract brand
        const brandName = String(item.brand || item.manufacturer || "").trim();

        // Extract GST from item_tax_preferences
        let gstRate = 0;
        const taxPrefs = item.item_tax_preferences as Array<{ tax_percentage?: number; tax_type?: string }> | undefined;
        if (taxPrefs && taxPrefs.length > 0) {
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
            data: { brandId, ...(gstRate > 0 ? { gstRate } : {}) },
          });
          enriched.push({ name: product.name, brand: brandName, gst: gstRate });
          updated++;
        } else if (gstRate > 0) {
          await prisma.product.update({
            where: { id: product.id },
            data: { gstRate },
          });
          enriched.push({ name: product.name, brand: "—", gst: gstRate });
          updated++;
        } else {
          // No brand and no GST — mark as checked by setting a placeholder
          // Move to a "No Brand in Zoho" brand so we don't re-fetch
          let noBrandId = brandMap.get("no brand in zoho");
          if (!noBrandId) {
            const nb = await prisma.brand.create({ data: { name: "No Brand in Zoho" } });
            brandMap.set("no brand in zoho", nb.id);
            noBrandId = nb.id;
          }
          await prisma.product.update({
            where: { id: product.id },
            data: { brandId: noBrandId },
          });
          enriched.push({ name: product.name, brand: "No Brand in Zoho", gst: 0 });
          updated++;
        }
      } catch (err) {
        failed++;
        errors.push(`${product.name}: ${err instanceof Error ? err.message : "Unknown"}`);
      }
    }

    const remaining = await prisma.product.count({ where: { brandId: unbrandedBrand.id } });

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
