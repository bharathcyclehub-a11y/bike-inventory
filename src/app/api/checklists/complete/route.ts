export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";
import { z } from "zod";

const completeSchema = z.object({
  templateId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// POST: Mark a checklist item as complete for today
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await req.json();
    const data = completeSchema.parse(body);

    // Verify template exists and matches user's role
    const template = await prisma.checklistTemplate.findUnique({ where: { id: data.templateId } });
    if (!template) return errorResponse("Template not found", 404);
    if (template.role !== user.role && user.role !== "ADMIN") {
      return errorResponse("Not your checklist", 403);
    }

    const completion = await prisma.checklistCompletion.upsert({
      where: {
        templateId_userId_date: {
          templateId: data.templateId,
          userId: user.id,
          date: data.date,
        },
      },
      create: {
        templateId: data.templateId,
        userId: user.id,
        date: data.date,
      },
      update: {},
    });

    return successResponse(completion, 201);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed", 400);
  }
}

// DELETE: Uncheck a checklist item
export async function DELETE(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(req.url);
    const templateId = searchParams.get("templateId");
    const date = searchParams.get("date");

    if (!templateId || !date) return errorResponse("Missing templateId or date", 400);

    await prisma.checklistCompletion.deleteMany({
      where: { templateId, userId: user.id, date },
    });

    return successResponse({ deleted: true });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed", 400);
  }
}
