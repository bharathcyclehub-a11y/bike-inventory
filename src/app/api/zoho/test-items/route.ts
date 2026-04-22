export const dynamic = "force-dynamic";

import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";
import { ZohoInventoryClient } from "@/lib/zoho-inventory";
import { ZohoClient } from "@/lib/zoho";

// GET — fetch categories from Zoho (Inventory first, Books fallback)
export async function GET() {
  try {
    await requireAuth(["ADMIN"]);

    // Try Zoho Inventory first
    const inventory = new ZohoInventoryClient();
    const invReady = await inventory.init();
    if (invReady) {
      // Zoho Inventory: /categories endpoint
      const catData = await inventory.apiCall<{
        categories: Array<{
          category_id: string;
          category_name: string;
          description?: string;
          parent_category_id?: string;
          parent_category_name?: string;
          depth?: number;
          status?: string;
        }>;
      }>("GET", "/categories");

      // Also grab first page of items to see category_name distribution
      const itemsPage = await inventory.listItems(1, "active");
      const categoryCount: Record<string, number> = {};
      for (const item of itemsPage.items || []) {
        const cat = item.category_name || "(none)";
        categoryCount[cat] = (categoryCount[cat] || 0) + 1;
      }

      return successResponse({
        source: "zoho-inventory",
        categories: catData.categories || [],
        itemCategoryDistribution: categoryCount,
        sampleItemsChecked: (itemsPage.items || []).length,
      });
    }

    // Fallback: Zoho Books
    const zoho = new ZohoClient();
    const booksReady = await zoho.init();
    if (booksReady) {
      const catData = await zoho.apiCall<{
        categories: Array<{
          category_id: string;
          category_name: string;
          description?: string;
          parent_category_id?: string;
          parent_category_name?: string;
          depth?: number;
          status?: string;
        }>;
      }>("GET", "/categories");

      const itemsPage = await zoho.listItems(1);
      const categoryCount: Record<string, number> = {};
      for (const item of itemsPage.items || []) {
        const cat = item.category_name || "(none)";
        categoryCount[cat] = (categoryCount[cat] || 0) + 1;
      }

      return successResponse({
        source: "zoho-books",
        categories: catData.categories || [],
        itemCategoryDistribution: categoryCount,
        sampleItemsChecked: (itemsPage.items || []).length,
      });
    }

    return errorResponse("No Zoho source connected", 400);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch categories", 500);
  }
}
