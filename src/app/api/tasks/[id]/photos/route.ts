export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    const body = await req.json();

    if (!body.url || typeof body.url !== "string") {
      return errorResponse("URL is required", 400);
    }

    const task = await prisma.task.update({
      where: { id },
      data: { photoUrls: { push: body.url } },
    });

    return successResponse(task);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to add photo", 400);
  }
}
