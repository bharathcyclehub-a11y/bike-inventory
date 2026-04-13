export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse, paginatedResponse, parseSearchParams } from "@/lib/api-utils";
import { userSchema } from "@/lib/validations";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  try {
    await requireAuth(["ADMIN", "SUPERVISOR"]);
    const { page, limit, skip, search } = parseSearchParams(req.url);

    const where = {
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
        ],
      }),
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          accessCode: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { transactions: true } },
        },
        orderBy: { name: "asc" },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return paginatedResponse(users, total, page, limit);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch users", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth(["ADMIN"]);
    const body = await req.json();
    const data = userSchema.parse(body);

    // Check for duplicate email or access code
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email: data.email }, { accessCode: data.accessCode.toUpperCase() }],
      },
    });
    if (existing) {
      return errorResponse(
        existing.email === data.email ? "Email already exists" : "Access code already taken",
        409
      );
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        role: data.role,
        accessCode: data.accessCode.toUpperCase(),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        accessCode: true,
        isActive: true,
        createdAt: true,
      },
    });

    return successResponse(user, 201);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to create user", 400);
  }
}
