export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";
import { z } from "zod";

const ALLOWED_ROLES = ["ADMIN", "ACCOUNTS_MANAGER", "OUTWARDS_CLERK"] as const;

const noteSchema = z.object({
  content: z.string().min(1, "Note content is required").max(2000),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth([...ALLOWED_ROLES]);
    const { id } = await params;

    const ticket = await prisma.serviceTicket.findUnique({ where: { id }, select: { id: true } });
    if (!ticket) return errorResponse("Service ticket not found", 404);

    const notes = await prisma.serviceTicketNote.findMany({
      where: { ticketId: id },
      include: {
        createdBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return successResponse(notes);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch notes", 500);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth([...ALLOWED_ROLES]);
    const { id } = await params;
    const body = await req.json();
    const data = noteSchema.parse(body);

    const ticket = await prisma.serviceTicket.findUnique({ where: { id }, select: { id: true } });
    if (!ticket) return errorResponse("Service ticket not found", 404);

    const note = await prisma.serviceTicketNote.create({
      data: {
        ticketId: id,
        content: data.content,
        type: "NOTE",
        createdById: user.id,
      },
      include: {
        createdBy: { select: { name: true } },
      },
    });

    return successResponse(note, 201);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to add note", 400);
  }
}
