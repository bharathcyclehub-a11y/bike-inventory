export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

export async function GET() {
  try {
    await requireAuth(["ADMIN", "SUPERVISOR"]);

    const counter = await prisma.taskCounter.upsert({
      where: { id: "singleton" },
      update: {},
      create: { id: "singleton", current: 0 },
    });

    const nextId = `BCH-${String(counter.current + 1).padStart(3, "0")}`;
    return successResponse({ nextId });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to get next ID", 500);
  }
}
