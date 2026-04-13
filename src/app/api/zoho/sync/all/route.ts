export const dynamic = "force-dynamic";

import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

export async function POST(req: Request) {
  try {
    await requireAuth(["ADMIN"]);

    const baseUrl = new URL(req.url).origin;
    const headers = { "Content-Type": "application/json", cookie: req.headers.get("cookie") || "" };

    const results: Record<string, unknown> = {};

    // Run syncs sequentially to respect rate limits
    for (const syncType of ["items", "contacts", "invoices", "bills"]) {
      try {
        const res = await fetch(`${baseUrl}/api/zoho/sync/${syncType}`, {
          method: "POST",
          headers,
          body: JSON.stringify({}),
        });
        results[syncType] = await res.json();
      } catch (err) {
        results[syncType] = { error: err instanceof Error ? err.message : "Failed" };
      }
    }

    return successResponse({ syncType: "all", results });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Full sync failed", 500);
  }
}
