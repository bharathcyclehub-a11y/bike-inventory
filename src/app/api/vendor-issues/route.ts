export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  successResponse,
  errorResponse,
  paginatedResponse,
  parseSearchParams,
} from "@/lib/api-utils";
import { vendorIssueSchema } from "@/lib/validations";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  try {
    await requireAuth(["ADMIN", "SUPERVISOR", "PURCHASE_MANAGER", "ACCOUNTS_MANAGER"]);
    const { page, limit, skip, search, searchParams } = parseSearchParams(
      req.url
    );
    const status = searchParams.get("status") || undefined;
    const priority = searchParams.get("priority") || undefined;
    const vendorId = searchParams.get("vendorId") || undefined;
    const dateFrom = searchParams.get("dateFrom") || undefined;
    const dateTo = searchParams.get("dateTo") || undefined;

    const where = {
      ...(search && {
        OR: [
          { issueNo: { contains: search, mode: "insensitive" as const } },
          {
            vendor: {
              name: { contains: search, mode: "insensitive" as const },
            },
          },
        ],
      }),
      ...(status && { status: status as never }),
      ...(priority && { priority: priority as never }),
      ...(vendorId && { vendorId }),
      ...((dateFrom || dateTo) && {
        createdAt: {
          ...(dateFrom && { gte: new Date(dateFrom) }),
          ...(dateTo && { lte: new Date(dateTo + "T23:59:59.999Z") }),
        },
      }),
    };

    const [issues, total, openCount, inProgressCount, resolvedCount] =
      await Promise.all([
        prisma.vendorIssue.findMany({
          where,
          select: {
            id: true,
            issueNo: true,
            issueType: true,
            description: true,
            status: true,
            priority: true,
            createdAt: true,
            vendor: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.vendorIssue.count({ where }),
        prisma.vendorIssue.count({ where: { ...where, status: "OPEN" } }),
        prisma.vendorIssue.count({
          where: { ...where, status: "IN_PROGRESS" },
        }),
        prisma.vendorIssue.count({ where: { ...where, status: "RESOLVED" } }),
      ]);

    return paginatedResponse(
      issues.map((i) => ({ ...i, openCount, inProgressCount, resolvedCount })),
      total,
      page,
      limit
    );
  } catch (error) {
    if (error instanceof AuthError)
      return errorResponse(error.message, error.status);
    return errorResponse(
      error instanceof Error ? error.message : "Failed to fetch issues",
      500
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(["ADMIN", "PURCHASE_MANAGER", "ACCOUNTS_MANAGER"]);
    const body = await req.json();
    const data = vendorIssueSchema.parse(body);

    // Auto-generate issueNo: ISS-YYYYMM-NNNN
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
    const prefix = `ISS-${yearMonth}-`;

    const lastIssue = await prisma.vendorIssue.findFirst({
      where: { issueNo: { startsWith: prefix } },
      orderBy: { issueNo: "desc" },
      select: { issueNo: true },
    });

    let seq = 1;
    if (lastIssue) {
      const lastSeq = parseInt(lastIssue.issueNo.split("-").pop() || "0", 10);
      seq = lastSeq + 1;
    }

    const issueNo = `${prefix}${String(seq).padStart(4, "0")}`;

    const issue = await prisma.vendorIssue.create({
      data: {
        vendorId: data.vendorId,
        issueNo,
        issueType: data.issueType,
        description: data.description,
        priority: data.priority || "MEDIUM",
        billId: data.billId || null,
        createdById: user.id,
      },
      include: { vendor: { select: { name: true } } },
    });

    return successResponse(issue, 201);
  } catch (error) {
    if (error instanceof AuthError)
      return errorResponse(error.message, error.status);
    return errorResponse(
      error instanceof Error ? error.message : "Failed to create issue",
      400
    );
  }
}
