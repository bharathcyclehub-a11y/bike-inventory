export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  successResponse,
  errorResponse,
  paginatedResponse,
} from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const skip = (page - 1) * limit;

    const status = searchParams.get("status") || undefined;
    const assignedToId = searchParams.get("assignedToId") || undefined;
    const customerId = searchParams.get("customerId") || undefined;
    const priority = searchParams.get("priority") || undefined;
    const search = searchParams.get("search") || undefined;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (assignedToId) where.assignedToId = assignedToId;
    if (customerId) where.customerId = customerId;
    if (priority) where.priority = priority;
    if (search) {
      where.OR = [
        { jobNo: { contains: search, mode: "insensitive" } },
        { customer: { name: { contains: search, mode: "insensitive" } } },
        { customer: { phone: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [jobs, total] = await Promise.all([
      prisma.serviceJob.findMany({
        where,
        select: {
          id: true,
          jobNo: true,
          complaint: true,
          priority: true,
          status: true,
          estimatedCost: true,
          actualCost: true,
          estimatedCompletion: true,
          createdAt: true,
          customer: { select: { id: true, name: true, phone: true } },
          bike: { select: { id: true, brand: true, model: true, size: true } },
          assignedTo: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.serviceJob.count({ where }),
    ]);

    return paginatedResponse(jobs, total, page, limit);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch jobs", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(["ADMIN", "SUPERVISOR", "MECHANIC"]);
    const body = await req.json();

    const { customerId, bikeId, complaint, priority, assignedToId, estimatedCompletion, notes } = body;

    if (!customerId || !complaint) {
      return errorResponse("customerId and complaint are required", 400);
    }

    const customer = await prisma.serviceCustomer.findUnique({ where: { id: customerId } });
    if (!customer) return errorResponse("Customer not found", 404);

    if (bikeId) {
      const bike = await prisma.customerBike.findUnique({ where: { id: bikeId } });
      if (!bike || bike.customerId !== customerId) {
        return errorResponse("Bike not found or does not belong to this customer", 400);
      }
    }

    const lastJob = await prisma.serviceJob.findFirst({
      where: { jobNo: { startsWith: "BCH-JOB-" } },
      orderBy: { jobNo: "desc" },
      select: { jobNo: true },
    });
    const nextNum = lastJob ? parseInt(lastJob.jobNo.replace("BCH-JOB-", ""), 10) + 1 : 1;
    const jobNo = `BCH-JOB-${String(nextNum).padStart(4, "0")}`;

    const job = await prisma.serviceJob.create({
      data: {
        jobNo,
        customerId,
        bikeId: bikeId || null,
        complaint,
        priority: priority || "NORMAL",
        assignedToId: assignedToId || null,
        estimatedCompletion: estimatedCompletion ? new Date(estimatedCompletion) : null,
        notes: notes || null,
        createdById: user.id,
      },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        bike: { select: { id: true, brand: true, model: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    });

    return successResponse(job, 201);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to create job", 500);
  }
}
