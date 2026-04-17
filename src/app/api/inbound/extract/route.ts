export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

// POST: AI Vision — extract line items from bill image using Gemini
export async function POST(req: NextRequest) {
  try {
    await requireAuth(["ADMIN", "PURCHASE_MANAGER"]);

    const body = await req.json();
    const { imageBase64 } = body;

    if (!imageBase64) return errorResponse("imageBase64 is required", 400);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return errorResponse("Gemini API key not configured", 500);

    // Strip data URL prefix if present
    const base64Data = imageBase64.replace(/^data:image\/[a-z]+;base64,/, "");

    const prompt = `You are reading a bicycle brand invoice/bill image from India.
Extract ALL line items into this exact JSON format:
{
  "billNo": "the invoice/bill number",
  "billDate": "YYYY-MM-DD",
  "totalAmount": number,
  "lineItems": [
    {
      "name": "product name as written on bill",
      "quantity": number,
      "rate": number,
      "amount": number,
      "hsn": "HSN code if visible or null"
    }
  ]
}
Rules:
- Extract EVERY line item, don't skip any
- Rate = unit price, Amount = qty × rate
- If HSN is not visible, use null
- billDate must be YYYY-MM-DD format
- Return ONLY valid JSON, no markdown, no explanation`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: "image/jpeg",
                  data: base64Data,
                },
              },
            ],
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 4096,
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("Gemini API error:", errText);
      return errorResponse("Gemini API request failed", 502);
    }

    const geminiData = await geminiRes.json();
    const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Parse JSON from response (strip markdown fences if present)
    const jsonStr = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    try {
      const parsed = JSON.parse(jsonStr);
      return successResponse(parsed);
    } catch {
      console.error("Failed to parse Gemini response:", text);
      return errorResponse("AI could not parse the bill. Please enter details manually.", 422);
    }
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed", 500);
  }
}
