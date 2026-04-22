export const dynamic = "force-dynamic";
export const maxDuration = 120;

import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";
import { ZohoInventoryClient } from "@/lib/zoho-inventory";
import { ZohoClient } from "@/lib/zoho";
import { prisma } from "@/lib/db";

// GET — fetch Zoho categories tree
export async function GET() {
  try {
    await requireAuth(["ADMIN"]);

    const inventory = new ZohoInventoryClient();
    const invReady = await inventory.init();
    if (invReady) {
      const catData = await inventory.apiCall<{
        categories: Array<{
          category_id: string;
          category_name: string;
          description?: string;
          parent_category_id?: string;
          parent_category_name?: string;
          depth?: number;
          status?: string;
          has_active_items?: boolean;
        }>;
      }>("GET", "/categories");

      return successResponse({
        source: "zoho-inventory",
        categories: catData.categories || [],
      });
    }

    const zoho = new ZohoClient();
    const booksReady = await zoho.init();
    if (booksReady) {
      const catData = await zoho.apiCall<{
        categories: Array<{
          category_id: string;
          category_name: string;
          parent_category_id?: string;
          parent_category_name?: string;
          depth?: number;
        }>;
      }>("GET", "/categories");

      return successResponse({
        source: "zoho-books",
        categories: catData.categories || [],
      });
    }

    return errorResponse("No Zoho source connected", 400);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed", 500);
  }
}

// POST — Sync all item categories from Zoho (one-time bulk update)
export async function POST(req: NextRequest) {
  try {
    await requireAuth(["ADMIN"]);
    const body = await req.json().catch(() => ({}));
    const dryRun = body.dryRun === true;

    // Pull ALL items from Zoho (no stock filter, no date filter)
    const inventory = new ZohoInventoryClient();
    const invReady = await inventory.init();

    let zohoItems: Array<{ item_id: string; sku: string; name: string; category_name?: string }> = [];

    if (invReady) {
      zohoItems = await inventory.listAllItems();
    } else {
      const zoho = new ZohoClient();
      const booksReady = await zoho.init();
      if (!booksReady) return errorResponse("No Zoho source connected", 400);
      zohoItems = await zoho.listAllItems();
    }

    // Build category cache
    const categoryCache: Record<string, string> = {};
    async function getOrCreateCategory(name: string): Promise<string> {
      if (!categoryCache[name]) {
        let cat = await prisma.category.findFirst({ where: { name } });
        if (!cat) cat = await prisma.category.create({ data: { name, description: `Zoho category: ${name}` } });
        categoryCache[name] = cat.id;
      }
      return categoryCache[name];
    }

    const stats = {
      totalZohoItems: zohoItems.length,
      matched: 0,
      updated: 0,
      noCategory: 0,
      notFound: 0,
      categoryDistribution: {} as Record<string, number>,
    };

    for (const item of zohoItems) {
      const catName = (item.category_name || "").trim();

      // Track distribution
      const displayCat = catName || "(none)";
      stats.categoryDistribution[displayCat] = (stats.categoryDistribution[displayCat] || 0) + 1;

      if (!catName) {
        stats.noCategory++;
        continue;
      }

      // Find matching product by SKU or zohoItemId
      let product: { id: string; categoryId: string } | null = null;
      if (item.sku) {
        product = await prisma.product.findFirst({ where: { sku: item.sku }, select: { id: true, categoryId: true } });
      }
      if (!product && item.item_id) {
        product = await prisma.product.findFirst({ where: { zohoItemId: item.item_id }, select: { id: true, categoryId: true } });
      }

      if (!product) {
        stats.notFound++;
        continue;
      }

      stats.matched++;

      if (!dryRun) {
        const categoryId = await getOrCreateCategory(catName);
        if (product.categoryId !== categoryId) {
          await prisma.product.update({ where: { id: product.id }, data: { categoryId } });
          stats.updated++;
        }
      }
    }

    return successResponse({
      dryRun,
      ...stats,
      categoriesCreated: Object.keys(categoryCache),
    });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to sync categories", 500);
  }
}
