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

    // Pull first page (up to 200) and return 5 sample items with stock > 0
    const data = await zoho.listItems(1);
    const items = (data.items || [])
      .filter((item) => Number(item.stock_on_hand || 0) > 0)
      .slice(0, 5);

    const samples = items.map((item) => ({
      name: item.name,
      sku: item.sku,
      brand: item.brand || null,
      manufacturer: item.manufacturer || null,
      cost_price: item.purchase_rate || null,
      selling_price: item.rate || null,
      gst: item.tax_percentage || null,
      hsn: item.hsn_or_sac || null,
      stock_on_hand: item.stock_on_hand || null,
      product_type: item.product_type || null,
      item_type: item.item_type || null,
      // Include ALL raw fields so we can see what Zoho actually returns
      _raw: item,
    }));

    return successResponse({
      totalItemsInPage: data.items?.length || 0,
      hasMore: data.page_context?.has_more_page || false,
      samples,
    });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Zoho test failed", 500);
  }
}
