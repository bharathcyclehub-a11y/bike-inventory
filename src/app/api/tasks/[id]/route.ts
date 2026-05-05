export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { taskUpdateSchema } from "@/lib/validations";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        assignees: { include: { user: { select: { id: true, name: true } } } },
        subtasks: { orderBy: { sortOrder: "asc" } },
        createdBy: { select: { name: true } },
      },
    });

    if (!task) return errorResponse("Task not found", 404);
    return successResponse(task);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch task", 500);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    const body = await req.json();
    const data = taskUpdateSchema.parse(body);

    const existing = await prisma.task.findUnique({
      where: { id },
      select: { recurrenceType: true },
    });
    if (!existing) return errorResponse("Task not found", 404);

    // Recurring task completion: mark today's date, keep PENDING
    let statusUpdate = data.status as never | undefined;
    let completedAt: Date | undefined;
    let recurringDoneDate: string | undefined = data.recurringDoneDate;

    if (data.status === "DONE" && existing.recurrenceType) {
      statusUpdate = undefined;
      recurringDoneDate = new Date().toISOString().split("T")[0];
    } else if (data.status === "DONE") {
      completedAt = new Date();
    }

    // Handle assignees replacement
    if (data.assigneeIds && data.assigneeIds.length > 0) {
      await prisma.taskAssignee.deleteMany({ where: { taskId: id } });
      await prisma.taskAssignee.createMany({
        data: data.assigneeIds.map((userId) => ({ taskId: id, userId })),
      });
    }

    // Handle subtask toggling
    if (data.subtasks) {
      for (const sub of data.subtasks as { id?: string; title: string; done?: boolean }[]) {
        if (sub.id) {
          await prisma.subtask.update({
            where: { id: sub.id },
            data: { done: sub.done ?? false },
          });
        }
      }
    }

    const task = await prisma.task.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.priority !== undefined && { priority: data.priority as never }),
        ...(data.timeSlot !== undefined && { timeSlot: data.timeSlot as never }),
        ...(data.dueDate !== undefined && { dueDate: new Date(data.dueDate) }),
        ...(data.recurrenceType !== undefined && { recurrenceType: data.recurrenceType as never }),
        ...(data.recurrenceDays !== undefined && { recurrenceDays: data.recurrenceDays }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
        ...(data.isMyDay !== undefined && { isMyDay: data.isMyDay }),
        ...(data.myDayDate !== undefined && { myDayDate: data.myDayDate }),
        ...(statusUpdate !== undefined && { status: statusUpdate }),
        ...(completedAt && { completedAt }),
        ...(recurringDoneDate !== undefined && { recurringDoneDate }),
      },
      include: {
        assignees: { include: { user: { select: { id: true, name: true } } } },
        subtasks: { orderBy: { sortOrder: "asc" } },
        createdBy: { select: { name: true } },
      },
    });

    return successResponse(task);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to update task", 400);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(["ADMIN", "SUPERVISOR"]);
    const { id } = await params;

    await prisma.task.delete({ where: { id } });
    return successResponse({ deleted: true });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to delete task", 400);
  }
}
