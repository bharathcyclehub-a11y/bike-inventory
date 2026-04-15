export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse, paginatedResponse, parseSearchParams } from "@/lib/api-utils";
import { serviceTicketSchema } from "@/lib/validations";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

const ALLOWED_ROLES = ["ADMIN", "ACCOUNTS_MANAGER", "OUTWARDS_CLERK"] as const;

export async function GET(req: NextRequest) {
  try {
    await requireAuth([...ALLOWED_ROLES]);
    const { page, limit, skip, search, searchParams } = parseSearchParams(req.url);

    const status = searchParams.get("status") || undefined;
    const department = searchParams.get("department") || undefined;
    const priority = searchParams.get("priority") || undefined;
    const assignedToId = searchParams.get("assignedToId") || undefined;

    const where = {
      ...(status && { status }),
      ...(department && { department }),
      ...(priority && { priority }),
      ...(assignedToId && { assignedToId }),
      ...(search && {
        OR: [
          { customerName: { contains: search, mode: "insensitive" as const } },
          { customerPhone: { contains: search, mode: "insensitive" as const } },
          { productName: { contains: search, mode: "insensitive" as const } },
          { ticketNo: { contains: search, mode: "insensitive" as const } },
          { issueBrief: { contains: search, mode: "insensitive" as const } },
        ],
      }),
    };

    const [tickets, total] = await Promise.all([
      prisma.serviceTicket.findMany({
        where,
        include: {
          createdBy: { select: { name: true } },
          assignedTo: { select: { name: true } },
          _count: { select: { notes: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.serviceTicket.count({ where }),
    ]);

    return paginatedResponse(tickets, total, page, limit);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch service tickets", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth([...ALLOWED_ROLES]);
    const body = await req.json();
    const data = serviceTicketSchema.parse(body);

    // Auto-generate ticketNo: BCH-SVC-0001
    const lastTicket = await prisma.serviceTicket.findFirst({
      orderBy: { ticketNo: "desc" },
      select: { ticketNo: true },
    });

    let nextNum = 1;
    if (lastTicket?.ticketNo) {
      const match = lastTicket.ticketNo.match(/BCH-SVC-(\d+)/);
      if (match) nextNum = parseInt(match[1], 10) + 1;
    }
    const ticketNo = `BCH-SVC-${String(nextNum).padStart(4, "0")}`;

    const ticket = await prisma.serviceTicket.create({
      data: {
        ticketNo,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        alternatePhone: data.alternatePhone,
        customerAddress: data.customerAddress,
        pincode: data.pincode,
        productName: data.productName,
        invoiceNo: data.invoiceNo,
        issueBrief: data.issueBrief,
        department: data.department,
        assignedMechanic: data.assignedMechanic,
        salesPerson: data.salesPerson,
        priority: data.priority || "NORMAL",
        deliveryZone: data.deliveryZone,
        deliveryAddress: data.deliveryAddress,
        estimatedDelivery: data.estimatedDelivery,
        reversePickup: data.reversePickup || false,
        freeAccessories: data.freeAccessories,
        assignedToId: data.assignedToId,
        createdById: user.id,
        // Auto-set emTicketStatus for EM Service department
        ...(data.department === "EM Service" && { emTicketStatus: "OPEN" }),
        notes: {
          create: {
            content: "Ticket created",
            type: "STATUS_CHANGE",
            createdById: user.id,
          },
        },
      },
      include: {
        createdBy: { select: { name: true } },
        assignedTo: { select: { name: true } },
        _count: { select: { notes: true } },
      },
    });

    return successResponse(ticket, 201);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to create service ticket", 400);
  }
}
