export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse, parseSearchParams } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = parseSearchParams(req.url);
    const status = searchParams.get("status") || "PENDING";

    const isAdmin = ["ADMIN", "CEO", "SUPERVISOR"].includes(user.role);

    const where = {
      status: status as never,
      ...(!isAdmin && { suggestedRole: user.role as never }),
    };

    const suggestions = await prisma.taskSuggestion.findMany({
      where,
      orderBy: [{ urgencyScore: "desc" }, { createdAt: "desc" }],
      take: 20,
      include: {
        triageBy: { select: { name: true } },
      },
    });

    return successResponse(suggestions);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch suggestions", 500);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await req.json();
    const { id, action } = body as { id: string; action: "accept" | "dismiss" };

    if (!id || !["accept", "dismiss"].includes(action)) {
      return errorResponse("Invalid request: id and action (accept/dismiss) required", 400);
    }

    const suggestion = await prisma.taskSuggestion.findUnique({ where: { id } });
    if (!suggestion) return errorResponse("Suggestion not found", 404);
    if (suggestion.status !== "PENDING") return errorResponse("Suggestion already processed", 400);

    if (action === "dismiss") {
      const updated = await prisma.taskSuggestion.update({
        where: { id },
        data: { status: "DISMISSED", triageById: user.id },
      });
      return successResponse(updated);
    }

    // Accept: create a real Task and mark suggestion as accepted
    const result = await prisma.$transaction(async (tx) => {
      const counter = await tx.taskCounter.upsert({
        where: { id: "singleton" },
        update: { current: { increment: 1 } },
        create: { id: "singleton", current: 1 },
      });

      const taskNo = `TSK-${String(counter.current).padStart(3, "0")}`;

      const task = await tx.task.create({
        data: {
          taskNo,
          title: suggestion.title,
          notes: suggestion.description,
          priority: "TODAY" as never,
          status: "PENDING" as never,
          createdById: user.id,
        },
      });

      // Auto-assign to a user with the suggested role
      const targetUser = await tx.user.findFirst({
        where: { role: suggestion.suggestedRole, isActive: true },
        select: { id: true },
      });

      if (targetUser) {
        await tx.taskAssignee.create({
          data: { taskId: task.id, userId: targetUser.id },
        });
      }

      const updated = await tx.taskSuggestion.update({
        where: { id },
        data: { status: "ACCEPTED", triageById: user.id, createdTaskId: task.id },
      });

      return { suggestion: updated, task };
    });

    return successResponse(result);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to process suggestion", 500);
  }
}
