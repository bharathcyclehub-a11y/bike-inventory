export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

const VALID_TRANSITIONS: Record<string, string[]> = {
  CREATED: ["DIAGNOSED", "ON_HOLD", "CANCELLED"],
  DIAGNOSED: ["QUOTED", "ON_HOLD", "CANCELLED"],
  QUOTED: ["APPROVED", "ON_HOLD", "CANCELLED"],
  APPROVED: ["IN_PROGRESS", "ON_HOLD", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "ON_HOLD"],
  COMPLETED: ["INVOICED"],
  INVOICED: ["DELIVERED"],
  ON_HOLD: [],
  CANCELLED: [],
  DELIVERED: [],
};

const STATUS_TIMESTAMP_MAP: Record<string, string> = {
  DIAGNOSED: "diagnosedAt",
  QUOTED: "quotedAt",
  APPROVED: "approvedAt",
  IN_PROGRESS: "startedAt",
  COMPLETED: "completedAt",
  DELIVERED: "deliveredAt",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const job = await prisma.serviceJob.findUnique({
      where: { id },
      include: {
        customer: true,
        bike: true,
        assignedTo: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true } },
        items: {
          include: { product: { select: { id: true, name: true, sku: true } } },
          orderBy: { createdAt: "asc" },
        },
        jobNotes: {
          include: { createdBy: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
        },
        invoice: true,
      },
    });

    if (!job) return errorResponse("Job not found", 404);

    return successResponse(job);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch job", 500);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(["ADMIN", "SUPERVISOR", "MECHANIC"]);
    const { id } = await params;
    const body = await req.json();

    const existingJob = await prisma.serviceJob.findUnique({ where: { id } });
    if (!existingJob) return errorResponse("Job not found", 404);

    const updateData: Record<string, unknown> = {};

    if (body.diagnosis !== undefined) updateData.diagnosis = body.diagnosis;
    if (body.assignedToId !== undefined) updateData.assignedToId = body.assignedToId || null;
    if (body.priority !== undefined) updateData.priority = body.priority;
    if (body.estimatedCost !== undefined) updateData.estimatedCost = body.estimatedCost;
    if (body.estimatedCompletion !== undefined) {
      updateData.estimatedCompletion = body.estimatedCompletion ? new Date(body.estimatedCompletion) : null;
    }
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.discount !== undefined) updateData.discount = body.discount;

    if (body.status && body.status !== existingJob.status) {
      const currentStatus = existingJob.status;
      const newStatus = body.status as string;

      if (currentStatus === "ON_HOLD") {
        const holdNote = await prisma.serviceJobNote.findFirst({
          where: { jobId: id, type: "STATUS_CHANGE", content: { startsWith: "ON_HOLD from " } },
          orderBy: { createdAt: "desc" },
        });
        const prevStatus = holdNote ? holdNote.content.replace("ON_HOLD from ", "") : "CREATED";
        const allowedFromHold = VALID_TRANSITIONS[prevStatus] || [];
        if (newStatus !== prevStatus && !allowedFromHold.includes(newStatus)) {
          return errorResponse(`Cannot transition from ON_HOLD to ${newStatus}. Previous status was ${prevStatus}`, 400);
        }
      } else {
        const allowed = VALID_TRANSITIONS[currentStatus] || [];
        if (!allowed.includes(newStatus)) {
          return errorResponse(`Cannot transition from ${currentStatus} to ${newStatus}`, 400);
        }
      }

      updateData.status = newStatus;

      const timestampField = STATUS_TIMESTAMP_MAP[newStatus];
      if (timestampField) {
        updateData[timestampField] = new Date();
      }

      const noteContent = newStatus === "ON_HOLD"
        ? `ON_HOLD from ${currentStatus}`
        : `${currentStatus} -> ${newStatus}`;

      await prisma.serviceJobNote.create({
        data: {
          jobId: id,
          content: noteContent,
          type: "STATUS_CHANGE",
          createdById: user.id,
        },
      });
    }

    const updatedJob = await prisma.serviceJob.update({
      where: { id },
      data: updateData,
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        bike: { select: { id: true, brand: true, model: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    });

    return successResponse(updatedJob);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to update job", 500);
  }
}
