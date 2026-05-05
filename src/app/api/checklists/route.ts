export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";
import { z } from "zod";

const createSchema = z.object({
  title: z.string().min(1),
  role: z.string().min(1),
  sortOrder: z.number().optional(),
});

// GET: List checklist templates (admin sees all, others see their role)
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(req.url);
    const role = searchParams.get("role") || undefined;
    const date = searchParams.get("date") || undefined;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { isActive: true };
    if (user.role === "ADMIN" && role) {
      where.role = role;
    } else if (user.role !== "ADMIN") {
      where.role = user.role;
    }

    const templates = await prisma.checklistTemplate.findMany({
      where,
      orderBy: [{ role: "asc" }, { sortOrder: "asc" }],
      include: {
        completions: date
          ? {
              where: { date, userId: user.role === "ADMIN" ? undefined : user.id },
              select: { id: true, userId: true, completedAt: true, user: { select: { name: true } } },
            }
          : false,
      },
    });

    return successResponse(templates);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed", 500);
  }
}

// POST: Create template (admin only)
export async function POST(req: NextRequest) {
  try {
    await requireAuth(["ADMIN"]);
    const body = await req.json();
    const data = createSchema.parse(body);

    const template = await prisma.checklistTemplate.create({
      data: {
        title: data.title,
        role: data.role as never,
        sortOrder: data.sortOrder || 0,
      },
    });

    return successResponse(template, 201);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed", 400);
  }
}
