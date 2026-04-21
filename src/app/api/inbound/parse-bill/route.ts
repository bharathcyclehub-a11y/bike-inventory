export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

const PARSE_PROMPT = `You are a bill/invoice parser for a bicycle store. Extract the following from this bill image or PDF:

1. **billNo** — the invoice/bill number
2. **billDate** — the bill date in YYYY-MM-DD format
3. **lineItems** — an array of items, each with:
   - productName: the product/item name (full name as written)
   - quantity: number of units (default 1 if unclear)
   - rate: unit price BEFORE tax (number, no currency symbol)
   - gstPercent: GST percentage applied to this item (e.g. 5, 12, 18, 28). Look for CGST+SGST or IGST columns. If CGST is 9% and SGST is 9%, then gstPercent is 18.
   - gstAmount: total GST amount for this line item (CGST+SGST or IGST amount)
   - amount: total for this line INCLUDING GST (rate × qty + gst). This is the final payable amount.
   - hsn: HSN/SAC code if visible (optional)

Return ONLY valid JSON in this exact format, no markdown, no explanation:
{
  "billNo": "string",
  "billDate": "YYYY-MM-DD",
  "lineItems": [
    { "productName": "string", "quantity": 1, "rate": 0, "gstPercent": 0, "gstAmount": 0, "amount": 0, "hsn": "" }
  ]
}

If you cannot read a field, use empty string for text or 0 for numbers. Always return valid JSON.`;

export async function POST(req: NextRequest) {
  try {
    await requireAuth(["ADMIN", "PURCHASE_MANAGER"]);

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return errorResponse("Claude API key not configured. Add ANTHROPIC_API_KEY to environment variables.", 500);
    }

    const body = await req.json();
    const { imageData, mimeType, brandId } = body as {
      imageData: string;
      mimeType: string;
      brandId?: string;
    };

    if (!imageData) {
      return errorResponse("No image data provided", 400);
    }

    // Strip data URL prefix if present
    const base64Data = imageData.includes(",") ? imageData.split(",")[1] : imageData;

    // Claude vision supports image types; for PDFs, use document type
    const isPdf = mimeType === "application/pdf";
    const mediaType = isPdf ? "application/pdf" as const : (mimeType || "image/jpeg") as "image/jpeg" | "image/png" | "image/gif" | "image/webp";

    const anthropic = new Anthropic({ apiKey });

    const contentBlock = isPdf
      ? { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: base64Data } }
      : { type: "image" as const, source: { type: "base64" as const, media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: base64Data } };

    const result = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            contentBlock,
            { type: "text", text: PARSE_PROMPT },
          ],
        },
      ],
    });

    const responseText = result.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = responseText;
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    let parsed: { billNo: string; billDate: string; lineItems: Array<{ productName: string; quantity: number; rate: number; gstPercent?: number; gstAmount?: number; amount: number; hsn?: string }> };
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      return errorResponse("AI could not parse this bill. Please enter details manually.", 400);
    }

    // Validate and clean the parsed data
    if (!parsed.lineItems || !Array.isArray(parsed.lineItems)) {
      parsed.lineItems = [];
    }

    parsed.lineItems = parsed.lineItems.map((li) => ({
      productName: String(li.productName || "").trim(),
      quantity: Math.max(1, Math.round(Number(li.quantity) || 1)),
      rate: Math.max(0, Number(li.rate) || 0),
      gstPercent: Math.max(0, Number(li.gstPercent) || 0),
      gstAmount: Math.max(0, Number(li.gstAmount) || 0),
      amount: Math.max(0, Number(li.amount) || 0),
      hsn: String(li.hsn || "").trim(),
    })).filter((li) => li.productName.length > 0);

    // Recalculate GST and amounts if they seem off
    for (const li of parsed.lineItems) {
      const baseAmount = li.quantity * li.rate;
      const gstPct = li.gstPercent || 0;
      // If gstAmount is 0 but we have gstPercent, calculate it
      if ((li.gstAmount || 0) === 0 && gstPct > 0 && baseAmount > 0) {
        li.gstAmount = Math.round(baseAmount * gstPct / 100);
      }
      const gstAmt = li.gstAmount || 0;
      // If amount is 0 or just the base, add GST
      const expectedTotal = baseAmount + gstAmt;
      if (li.amount === 0 && expectedTotal > 0) li.amount = expectedTotal;
      // If amount doesn't include GST (matches base), add GST
      if (gstAmt > 0 && Math.abs(li.amount - baseAmount) < 1) {
        li.amount = expectedTotal;
      }
    }

    // Match product names against existing products in the system
    const brandFilter = brandId ? { brandId } : {};
    const allProducts = await prisma.product.findMany({
      where: { status: "ACTIVE", ...brandFilter },
      select: { id: true, name: true, sku: true },
      take: 1000,
    });

    const matchedItems = parsed.lineItems.map((li) => {
      const nameLower = li.productName.toLowerCase();
      let bestMatch: { id: string; name: string; sku: string } | null = null;
      let bestScore = 0;

      for (const p of allProducts) {
        const pLower = p.name.toLowerCase();
        if (pLower === nameLower) {
          bestMatch = p;
          bestScore = 100;
          break;
        }
        if (pLower.includes(nameLower) || nameLower.includes(pLower)) {
          const score = Math.min(nameLower.length, pLower.length) / Math.max(nameLower.length, pLower.length) * 80;
          if (score > bestScore) {
            bestMatch = p;
            bestScore = score;
          }
        }
        const liWords = nameLower.split(/\s+/).filter((w) => w.length > 2);
        const pWords = pLower.split(/\s+/).filter((w) => w.length > 2);
        const overlap = liWords.filter((w) => pWords.some((pw) => pw.includes(w) || w.includes(pw))).length;
        if (liWords.length > 0) {
          const score = (overlap / liWords.length) * 70;
          if (score > bestScore) {
            bestMatch = p;
            bestScore = score;
          }
        }
      }

      return {
        ...li,
        matchedProductId: bestScore >= 40 ? bestMatch?.id : undefined,
        matchedProductName: bestScore >= 40 ? bestMatch?.name : undefined,
        matchedSku: bestScore >= 40 ? bestMatch?.sku : undefined,
        matchScore: Math.round(bestScore),
      };
    });

    return successResponse({
      billNo: String(parsed.billNo || "").trim(),
      billDate: String(parsed.billDate || "").trim(),
      lineItems: matchedItems,
    });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    const msg = error instanceof Error ? error.message : "Failed to parse bill";
    return errorResponse(`AI parsing failed: ${msg}`, 500);
  }
}
