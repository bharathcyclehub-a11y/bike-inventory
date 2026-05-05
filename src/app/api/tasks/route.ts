export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse, paginatedResponse, parseSearchParams } from "@/lib/api-utils";
import { taskSchema } from "@/lib/validations";
import { requireAuth, AuthError } from "@/lib/auth-helpers";
import { dueDateFromPriority } from "@/lib/ops-constants";
import type { Priority } from "@/lib/ops-constants";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { page, limit, skip, searchParams } = parseSearchParams(req.url);
    const status = searchParams.get("status") || undefined;
    const priority = searchParams.get("priority") || undefined;
    const assigneeId = searchParams.get("assigneeId") || undefined;

    const isRestricted = !["ADMIN", "SUPERVISOR"].includes(user.role);

    const where = {
      ...(status && { status: status as never }),
      ...(priority && { priority: priority as never }),
      ...(assigneeId && { assignees: { some: { userId: assigneeId } } }),
      ...(isRestricted && { assignees: { some: { userId: user.id } } }),
    };

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        include: {
          assignees: { include: { user: { select: { id: true, name: true } } } },
          subtasks: { orderBy: { sortOrder: "asc" } },
          createdBy: { select: { name: true } },
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        skip,
        take: limit,
      }),
      prisma.task.count({ where }),
    ]);

    return paginatedResponse(tasks, total, page, limit);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch tasks", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(["ADMIN", "SUPERVISOR"]);
    const body = await req.json();
    const data = taskSchema.parse(body);

    const counter = await prisma.taskCounter.upsert({
      where: { id: "singleton" },
      update: { current: { increment: 1 } },
      create: { id: "singleton", current: 1 },
    });

    const taskNo = `BCH-${String(counter.current).padStart(3, "0")}`;

    const dueDate = data.dueDate
      ? new Date(data.dueDate)
      : dueDateFromPriority(data.priority as Priority);

    const task = await prisma.task.create({
      data: {
        taskNo,
        title: data.title,
        notes: data.notes,
        priority: data.priority as never,
        timeSlot: data.timeSlot as never,
        dueDate,
        recurrenceType: data.recurrenceType as never,
        recurrenceDays: data.recurrenceDays || [],
        createdById: user.id,
        assignees: {
          createMany: {
            data: data.assigneeIds.map((userId) => ({ userId })),
          },
        },
        subtasks: data.subtasks?.length
          ? {
              createMany: {
                data: data.subtasks.map((s, i) => ({ title: s.title, sortOrder: i })),
              },
            }
          : undefined,
      },
      include: {
        assignees: { include: { user: { select: { id: true, name: true } } } },
        subtasks: { orderBy: { sortOrder: "asc" } },
        createdBy: { select: { name: true } },
      },
    });

    return successResponse(task, 201);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to create task", 400);
  }
}
