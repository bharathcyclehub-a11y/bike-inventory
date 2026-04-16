export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

// GET — pull summary (by pullId or latest) + history
export async function GET(req: NextRequest) {
  try {
    await requireAuth(["ADMIN", "SUPERVISOR", "OUTWARDS_CLERK"]);

    const pullIdParam = req.nextUrl.searchParams.get("pullId");

    // Find the target pull
    const targetPull = pullIdParam
      ? await prisma.zohoPullLog.findUnique({ where: { pullId: pullIdParam } })
      : await prisma.zohoPullLog.findFirst({ orderBy: { createdAt: "desc" } });

    if (!targetPull) {
      return successResponse({ latest: null, history: [], previews: [] });
    }

    // Preview items for target pull
    const previews = await prisma.zohoPullPreview.findMany({
      where: { pullId: targetPull.pullId },
      orderBy: { createdAt: "asc" },
    });

    const grouped = {
      contacts: previews.filter((p) => p.entityType === "contact"),
      items: previews.filter((p) => p.entityType === "item"),
      bills: previews.filter((p) => p.entityType === "bill"),
      invoices: previews.filter((p) => p.entityType === "invoice"),
    };

    // Recent pull history (last 10)
    const history = await prisma.zohoPullLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    return successResponse({
      latest: {
        ...targetPull,
        previews: grouped,
      },
      previews,
      history,
    });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch pull review", 500);
  }
}
