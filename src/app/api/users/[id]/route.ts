export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(["ADMIN", "SUPERVISOR"]);
    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        accessCode: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { transactions: true, stockCounts: true } },
      },
    });

    if (!user) return errorResponse("User not found", 404);
    return successResponse(user);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch user", 500);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(["ADMIN"]);
    const { id } = await params;
    const body = await req.json();

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) return errorResponse("User not found", 404);

    const VALID_ROLES = ["ADMIN", "SUPERVISOR", "MANAGER", "INWARDS_CLERK", "OUTWARDS_CLERK"];

    const updateData: Record<string, unknown> = {};
    if (body.name && typeof body.name === "string") updateData.name = body.name.trim();
    if (body.email && typeof body.email === "string") updateData.email = body.email.trim().toLowerCase();
    if (body.role && VALID_ROLES.includes(body.role)) updateData.role = body.role;
    if (body.accessCode && typeof body.accessCode === "string") updateData.accessCode = body.accessCode.toUpperCase().trim();
    if (body.isActive !== undefined && typeof body.isActive === "boolean") updateData.isActive = body.isActive;
    if (body.password && typeof body.password === "string" && body.password.length >= 6) updateData.password = await bcrypt.hash(body.password, 10);

    // Check uniqueness if email or accessCode changed
    if (body.email && body.email !== existing.email) {
      const dup = await prisma.user.findUnique({ where: { email: body.email } });
      if (dup) return errorResponse("Email already exists", 409);
    }
    if (body.accessCode && body.accessCode.toUpperCase() !== existing.accessCode) {
      const dup = await prisma.user.findUnique({ where: { accessCode: body.accessCode.toUpperCase() } });
      if (dup) return errorResponse("Access code already taken", 409);
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    });

    return successResponse(user);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to update user", 400);
  }
}
