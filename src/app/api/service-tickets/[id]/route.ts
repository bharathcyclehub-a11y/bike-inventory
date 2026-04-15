export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { serviceTicketUpdateSchema } from "@/lib/validations";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

const ALLOWED_ROLES = ["ADMIN", "ACCOUNTS_MANAGER", "OUTWARDS_CLERK"] as const;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth([...ALLOWED_ROLES]);
    const { id } = await params;

    const ticket = await prisma.serviceTicket.findUnique({
      where: { id },
      include: {
        createdBy: { select: { name: true } },
        assignedTo: { select: { name: true } },
        notes: {
          include: {
            createdBy: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!ticket) return errorResponse("Service ticket not found", 404);

    const now = new Date();
    const createdAt = new Date(ticket.createdAt);
    const daysSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
    const isOverdue = daysSinceCreation > 7 && !ticket.resolvedAt;

    return successResponse({
      ...ticket,
      daysSinceCreation,
      isOverdue,
    });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch service ticket", 500);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth([...ALLOWED_ROLES]);
    const { id } = await params;
    const body = await req.json();
    const data = serviceTicketUpdateSchema.parse(body);

    const existing = await prisma.serviceTicket.findUnique({ where: { id } });
    if (!existing) return errorResponse("Service ticket not found", 404);

    // Validate: RESOLUTION_DELAYED requires delayReason
    if (data.status === "RESOLUTION_DELAYED" && !data.delayReason && !existing.delayReason) {
      return errorResponse("Delay reason is required when setting status to RESOLUTION_DELAYED", 400);
    }

    // Build auto-notes for status and assignment changes
    const autoNotes: { content: string; type: string }[] = [];

    if (data.status && data.status !== existing.status) {
      autoNotes.push({
        content: `Status changed from ${existing.status} to ${data.status}`,
        type: "STATUS_CHANGE",
      });
    }

    if (data.emTicketStatus && data.emTicketStatus !== existing.emTicketStatus) {
      autoNotes.push({
        content: `EM ticket status changed from ${existing.emTicketStatus || "none"} to ${data.emTicketStatus}`,
        type: "STATUS_CHANGE",
      });
    }

    if (data.assignedToId && data.assignedToId !== existing.assignedToId) {
      autoNotes.push({
        content: `Ticket reassigned`,
        type: "ASSIGNMENT",
      });
    }

    const ticket = await prisma.$transaction(async (tx) => {
      // Create auto-notes
      if (autoNotes.length > 0) {
        await tx.serviceTicketNote.createMany({
          data: autoNotes.map((note) => ({
            ticketId: id,
            content: note.content,
            type: note.type,
            createdById: user.id,
          })),
        });
      }

      // Build update payload
      const updateData: Record<string, unknown> = {};

      if (data.status !== undefined) updateData.status = data.status;
      if (data.emTicketStatus !== undefined) updateData.emTicketStatus = data.emTicketStatus;
      if (data.ticketPendingFrom !== undefined) updateData.ticketPendingFrom = data.ticketPendingFrom;
      if (data.delayReason !== undefined) updateData.delayReason = data.delayReason;
      if (data.assignedMechanic !== undefined) updateData.assignedMechanic = data.assignedMechanic;
      if (data.assignedToId !== undefined) updateData.assignedToId = data.assignedToId;
      if (data.salesPerson !== undefined) updateData.salesPerson = data.salesPerson;
      if (data.priority !== undefined) updateData.priority = data.priority;
      if (data.deliveryZone !== undefined) updateData.deliveryZone = data.deliveryZone;
      if (data.deliveryAddress !== undefined) updateData.deliveryAddress = data.deliveryAddress;
      if (data.estimatedDelivery !== undefined) updateData.estimatedDelivery = data.estimatedDelivery;
      if (data.reversePickup !== undefined) updateData.reversePickup = data.reversePickup;
      if (data.freeAccessories !== undefined) updateData.freeAccessories = data.freeAccessories;
      if (data.receivedReplacement !== undefined) updateData.receivedReplacement = data.receivedReplacement;

      // Auto-set timestamps
      if (data.status === "RESOLVED") updateData.resolvedAt = new Date();
      if (data.emTicketStatus === "CLOSED") updateData.closedAt = new Date();

      return tx.serviceTicket.update({
        where: { id },
        data: updateData,
        include: {
          createdBy: { select: { name: true } },
          assignedTo: { select: { name: true } },
          _count: { select: { notes: true } },
        },
      });
    });

    return successResponse(ticket);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to update service ticket", 400);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(["ADMIN"]);
    const { id } = await params;

    const ticket = await prisma.serviceTicket.findUnique({ where: { id } });
    if (!ticket) return errorResponse("Service ticket not found", 404);

    await prisma.serviceTicket.delete({ where: { id } });

    return successResponse({ deleted: true });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to delete service ticket", 400);
  }
}
