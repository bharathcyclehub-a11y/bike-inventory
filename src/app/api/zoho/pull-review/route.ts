export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

// GET — latest pull summary + history
export async function GET() {
  try {
    await requireAuth(["ADMIN", "SUPERVISOR"]);

    // Latest pull log
    const latestPull = await prisma.zohoPullLog.findFirst({
      orderBy: { createdAt: "desc" },
    });

    if (!latestPull) {
      return successResponse({ latest: null, history: [] });
    }

    // Preview items for latest pull
    const previews = await prisma.zohoPullPreview.findMany({
      where: { pullId: latestPull.pullId },
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
        ...latestPull,
        previews: grouped,
      },
      history,
    });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch pull review", 500);
  }
}
