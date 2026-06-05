import Anthropic from "@anthropic-ai/sdk";
import type { ParsedItem } from "@/lib/excel-parser";

const client = new Anthropic();

export async function parsePdfWithAI(buffer: ArrayBuffer, fileName: string): Promise<ParsedItem[]> {
  const base64 = Buffer.from(buffer).toString("base64");
  const isPdf = fileName.toLowerCase().endsWith(".pdf");
  const mediaType = isPdf ? "application/pdf" : (
    fileName.toLowerCase().endsWith(".png") ? "image/png" :
    fileName.toLowerCase().endsWith(".jpg") || fileName.toLowerCase().endsWith(".jpeg") ? "image/jpeg" :
    fileName.toLowerCase().endsWith(".webp") ? "image/webp" : "image/jpeg"
  );

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          {
            type: isPdf ? "document" : "image",
            source: { type: "base64", media_type: mediaType, data: base64 },
            ...(isPdf ? { title: fileName } : {}),
          } as Anthropic.DocumentBlockParam | Anthropic.ImageBlockParam,
          {
            type: "text",
            text: `Extract ALL product/inventory items from this document into a JSON array. Each item should have these fields:
- "name": product name (required)
- "sku": product code/SKU/article number (if present, else null)
- "category": category/group (if present, else null)
- "qty": available quantity/stock (if present, else 0)
- "price": dealer price/cost price (if present, else null)
- "mrp": MRP/retail price (if present, else null)
- "size": size/wheel size (if present, else null)

Rules:
- Extract EVERY row that looks like a product entry
- Skip headers, totals, subtotals, empty rows
- Numbers should be plain integers or floats (no commas, no currency symbols)
- If a field is not present in the document, use null
- Return ONLY the JSON array, no other text

Return format: [{"name":"...","sku":"...","category":"...","qty":0,"price":null,"mrp":null,"size":null}, ...]`,
          },
        ],
      },
    ],
  });

  const text = response.content.find((b) => b.type === "text")?.text || "";

  // Extract JSON array from response
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("Could not extract product data from this document. The AI could not find a product table.");

  let rawItems: Array<{ name?: string; sku?: string; category?: string; qty?: number; price?: number; mrp?: number; size?: string }>;
  try {
    rawItems = JSON.parse(jsonMatch[0]);
  } catch {
    throw new Error("Failed to parse AI response. Try uploading a clearer document.");
  }

  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new Error("No product items found in this document.");
  }

  return rawItems
    .filter((item) => item.name && String(item.name).trim().length > 0)
    .map((item) => ({
      rawSku: item.sku ? String(item.sku).trim() : null,
      rawName: String(item.name).trim(),
      rawCategory: item.category ? String(item.category).trim() : null,
      brandAvailableQty: typeof item.qty === "number" ? item.qty : parseInt(String(item.qty || "0")) || 0,
      brandPrice: typeof item.price === "number" ? item.price : (item.price ? parseFloat(String(item.price)) : null),
      brandMrp: typeof item.mrp === "number" ? item.mrp : (item.mrp ? parseFloat(String(item.mrp)) : null),
      rawSize: item.size ? String(item.size).trim() : null,
    }));
}
