export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

// GET — download pull preview as CSV (simple, works everywhere)
export async function GET(req: NextRequest) {
  try {
    await requireAuth(["ADMIN", "SUPERVISOR"]);

    const pullId = new URL(req.url).searchParams.get("pullId");
    if (!pullId) return errorResponse("pullId required", 400);

    const previews = await prisma.zohoPullPreview.findMany({
      where: { pullId },
      orderBy: [{ entityType: "asc" }, { createdAt: "asc" }],
    });

    if (previews.length === 0) return errorResponse("No data for this pull", 404);

    // Build CSV with all entity types
    const lines: string[] = [];
    lines.push("Type,Zoho ID,Status,Key Fields");

    for (const p of previews) {
      const d = p.data as Record<string, unknown>;
      let keyFields = "";

      if (p.entityType === "contact") {
        keyFields = `Name: ${d.name} | Phone: ${d.phone} | GSTIN: ${d.gstin}`;
      } else if (p.entityType === "item") {
        keyFields = `SKU: ${d.sku} | Name: ${d.name} | Cost: ${d.costPrice} | Sell: ${d.sellingPrice} | GST: ${d.gstRate}% | HSN: ${d.hsnCode}`;
      } else if (p.entityType === "bill") {
        const items = (d.lineItems as Array<{ name: string; quantity: number }>) || [];
        keyFields = `Bill#: ${d.billNumber} | Vendor: ${d.vendorName} | Total: ${d.total} | Items: ${items.length}`;
      } else if (p.entityType === "invoice") {
        const items = (d.lineItems as Array<{ name: string; quantity: number }>) || [];
        keyFields = `Inv#: ${d.invoiceNumber} | Customer: ${d.customerName} | Total: ${d.total} | Items: ${items.length} | Sales: ${d.salesPerson}`;
      }

      // Escape CSV
      const escaped = keyFields.replace(/"/g, '""');
      lines.push(`${p.entityType},${p.zohoId},${p.status},"${escaped}"`);
    }

    const csv = lines.join("\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="zoho-pull-${pullId}.csv"`,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Export failed", 500);
  }
}
