export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { sopSchema } from "@/lib/validations";
import { requireAuth, AuthError } from "@/lib/auth-helpers";
import type { SOPFrequency, Role } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    const isAdminOrSupervisor = user.role === "CEO" || user.role === "ADMIN" || user.role === "SUPERVISOR";
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category") || undefined;
    const isActive = searchParams.get("isActive");
    const frequency = searchParams.get("frequency") || undefined;
    const forMyRole = searchParams.get("forMyRole") === "true";
    const forRole = searchParams.get("forRole") || undefined;
    const forUserId = searchParams.get("forUserId") || undefined;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      ...(category && { category }),
      ...(isActive !== null && isActive !== undefined && isActive !== "" && {
        isActive: isActive === "true",
      }),
      ...(frequency && { frequency: frequency as SOPFrequency }),
    };

    // If forMyRole=true, return SOPs assigned to user's role OR individually assigned (ALL roles including CEO/ADMIN)
    if (forMyRole) {
      where.OR = [
        { roleAssignments: { some: { role: user.role as Role } } },
        { assignees: { some: { userId: user.id } } },
      ];
    } else if (forRole || forUserId) {
      // Admin can view SOPs for a specific role/user
      const orConditions: unknown[] = [];
      if (forRole) orConditions.push({ roleAssignments: { some: { role: forRole as Role } } });
      if (forUserId) orConditions.push({ assignees: { some: { userId: forUserId } } });
      if (orConditions.length > 0) where.OR = orConditions;
    }

    const sops = await prisma.sOP.findMany({
      where,
      include: {
        assignees: {
          include: { user: { select: { id: true, name: true } } },
        },
        roleAssignments: true,
        _count: { select: { checkOffs: true, violations: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return successResponse(sops);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch SOPs", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(["CEO", "ADMIN", "SUPERVISOR"]);
    const body = await req.json();
    const data = sopSchema.parse(body);

    const sop = await prisma.sOP.create({
      data: {
        title: data.title,
        description: data.description,
        category: data.category,
        frequency: data.frequency as SOPFrequency,
        timeSlots: data.timeSlots || ["MORNING", "AFTERNOON", "EVENING"],
        createdById: user.id,
        ...(data.assigneeIds && data.assigneeIds.length > 0 && {
          assignees: {
            create: data.assigneeIds.map((uid: string) => ({ userId: uid })),
          },
        }),
        ...(data.roleIds && data.roleIds.length > 0 && {
          roleAssignments: {
            create: data.roleIds.map((role: string) => ({ role: role as Role })),
          },
        }),
      },
      include: {
        assignees: {
          include: { user: { select: { id: true, name: true } } },
        },
        roleAssignments: true,
      },
    });

    return successResponse(sop, 201);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to create SOP", 400);
  }
}
