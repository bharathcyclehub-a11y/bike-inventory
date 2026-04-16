export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse, paginatedResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  try {
    await requireAuth(["ADMIN", "SUPERVISOR", "MECHANIC"]);

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || undefined;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const skip = (page - 1) * limit;

    const where = {
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { phone: { contains: search, mode: "insensitive" as const } },
        ],
      }),
    };

    const [customers, total] = await Promise.all([
      prisma.serviceCustomer.findMany({
        where,
        select: {
          id: true,
          name: true,
          phone: true,
          whatsapp: true,
          email: true,
          area: true,
          isActive: true,
          createdAt: true,
          _count: { select: { bikes: true, jobs: true } },
        },
        orderBy: { name: "asc" },
        skip,
        take: limit,
      }),
      prisma.serviceCustomer.count({ where }),
    ]);

    return paginatedResponse(customers, total, page, limit);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch customers", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth(["ADMIN", "SUPERVISOR", "MECHANIC"]);
    const body = await req.json();

    const { name, phone, whatsapp, email, address, area, pincode } = body;

    if (!name?.trim() || !phone?.trim()) {
      return errorResponse("Name and phone are required", 400);
    }

    const existing = await prisma.serviceCustomer.findUnique({
      where: { phone: phone.trim() },
      include: { _count: { select: { bikes: true, jobs: true } } },
    });

    if (existing) {
      return successResponse(existing);
    }

    const customer = await prisma.serviceCustomer.create({
      data: {
        name: name.trim(),
        phone: phone.trim(),
        whatsapp: whatsapp?.trim() || null,
        email: email?.trim() || null,
        address: address?.trim() || null,
        area: area?.trim() || null,
        pincode: pincode?.trim() || null,
      },
      include: { _count: { select: { bikes: true, jobs: true } } },
    });

    return successResponse(customer, 201);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to create customer", 400);
  }
}
