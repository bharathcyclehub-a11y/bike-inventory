export const dynamic = "force-dynamic";

import { ZohoClient } from "@/lib/zoho";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

export async function GET() {
  try {
    await requireAuth(["ADMIN"]);

    const zoho = new ZohoClient();
    const ready = await zoho.init();
    if (!ready) return errorResponse("Zoho not connected. Check Settings > Zoho.", 400);

    // Pull ALL active items across all pages to get total count
    const allItems = await zoho.listAllItems("active");
    const withStock = allItems.filter((item) => Number(item.stock_on_hand || 0) > 0);
    const listSamples = withStock.slice(0, 5);

    // Fetch FULL details for first 3 items to find brand/manufacturer fields
    const detailedSamples = [];
    for (const item of listSamples.slice(0, 3)) {
      try {
        const detail = await zoho.getItem(item.item_id);
        detailedSamples.push({
          name: item.name,
          sku: item.sku,
          item_id: item.item_id,
          // From list API
          list_brand: item.brand || null,
          list_manufacturer: item.manufacturer || null,
          // From detail API — extract brand/manufacturer
          detail_brand: (detail.item as Record<string, unknown>).brand || null,
          detail_manufacturer: (detail.item as Record<string, unknown>).manufacturer || null,
          detail_category: (detail.item as Record<string, unknown>).category_name || (detail.item as Record<string, unknown>).category || null,
          cost_price: item.purchase_rate || null,
          selling_price: item.rate || null,
          stock_on_hand: item.stock_on_hand || null,
          hsn: item.hsn_or_sac || null,
          // GST from item_tax_preferences
          gst_from_tax_prefs: null as number | null,
          _raw_detail: detail.item,
        });
      } catch {
        detailedSamples.push({
          name: item.name,
          sku: item.sku,
          item_id: item.item_id,
          error: "Failed to fetch detail",
          _raw_list: item,
        });
      }
    }

    return successResponse({
      totalActiveItems: allItems.length,
      willBeImported: withStock.length,
      samples: detailedSamples,
    });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Zoho test failed", 500);
  }
}
