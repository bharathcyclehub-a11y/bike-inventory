export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(["ADMIN", "SUPERVISOR", "MECHANIC"]);
    const { id } = await params;

    const customer = await prisma.serviceCustomer.findUnique({
      where: { id },
      include: {
        bikes: { orderBy: { createdAt: "desc" } },
        jobs: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            jobNo: true,
            complaint: true,
            status: true,
            priority: true,
            estimatedCost: true,
            actualCost: true,
            createdAt: true,
            bike: { select: { id: true, brand: true, model: true } },
            assignedTo: { select: { id: true, name: true } },
          },
        },
        _count: { select: { jobs: true, bikes: true } },
      },
    });

    if (!customer) return errorResponse("Customer not found", 404);
    return successResponse(customer);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch customer", 500);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(["ADMIN", "SUPERVISOR"]);
    const { id } = await params;
    const body = await req.json();

    const { name, phone, whatsapp, email, address, area, pincode, isActive } = body;

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name.trim();
    if (phone !== undefined) data.phone = phone.trim();
    if (whatsapp !== undefined) data.whatsapp = whatsapp?.trim() || null;
    if (email !== undefined) data.email = email?.trim() || null;
    if (address !== undefined) data.address = address?.trim() || null;
    if (area !== undefined) data.area = area?.trim() || null;
    if (pincode !== undefined) data.pincode = pincode?.trim() || null;
    if (isActive !== undefined) data.isActive = isActive;

    if (phone !== undefined) {
      const existing = await prisma.serviceCustomer.findUnique({ where: { phone: phone.trim() } });
      if (existing && existing.id !== id) {
        return errorResponse("Phone number already in use", 409);
      }
    }

    const customer = await prisma.serviceCustomer.update({
      where: { id },
      data,
      include: {
        bikes: true,
        _count: { select: { jobs: true, bikes: true } },
      },
    });

    return successResponse(customer);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to update customer", 400);
  }
}
