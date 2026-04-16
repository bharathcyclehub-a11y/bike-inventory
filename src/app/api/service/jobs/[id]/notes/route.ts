export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const job = await prisma.serviceJob.findUnique({ where: { id }, select: { id: true } });
    if (!job) return errorResponse("Job not found", 404);

    const notes = await prisma.serviceJobNote.findMany({
      where: { jobId: id },
      include: { createdBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });

    return successResponse(notes);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch notes", 500);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(["ADMIN", "SUPERVISOR", "MECHANIC"]);
    const { id } = await params;
    const body = await req.json();

    const { content, type } = body;

    if (!content) return errorResponse("content is required", 400);

    const job = await prisma.serviceJob.findUnique({ where: { id }, select: { id: true } });
    if (!job) return errorResponse("Job not found", 404);

    const note = await prisma.serviceJobNote.create({
      data: {
        jobId: id,
        content,
        type: type || "NOTE",
        createdById: user.id,
      },
      include: { createdBy: { select: { id: true, name: true } } },
    });

    return successResponse(note, 201);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to add note", 500);
  }
}
