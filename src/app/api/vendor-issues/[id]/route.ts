export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { vendorIssueUpdateSchema } from "@/lib/validations";
import { requireAuth, requireFeature, AuthError } from "@/lib/auth-helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireFeature("vendor_issues", "view", ["ADMIN", "SUPERVISOR", "PURCHASE_MANAGER", "ACCOUNTS_MANAGER"]);
    const { id } = await params;

    const issue = await prisma.vendorIssue.findUnique({
      where: { id },
      include: {
        vendor: { select: { id: true, name: true, code: true, whatsappNumber: true, phone: true } },
        bill: { select: { id: true, billNo: true, amount: true } },
        createdBy: { select: { id: true, name: true } },
        notes: {
          include: { author: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!issue) return errorResponse("Issue not found", 404);
    return successResponse(issue);
  } catch (error) {
    if (error instanceof AuthError)
      return errorResponse(error.message, error.status);
    return errorResponse(
      error instanceof Error ? error.message : "Failed to fetch issue",
      500
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireFeature("vendor_issues", "edit", ["ADMIN", "SUPERVISOR", "PURCHASE_MANAGER", "ACCOUNTS_MANAGER"]);
    const { id } = await params;
    const body = await req.json();
    const data = vendorIssueUpdateSchema.parse(body);

    // Fetch current issue to detect status transitions
    const current = await prisma.vendorIssue.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!current) return errorResponse("Issue not found", 404);

    // Handle resolvedAt auto-set/clear on status transitions
    let resolvedAt: Date | null | undefined = undefined;
    if (data.status === "RESOLVED" && current.status !== "RESOLVED") {
      resolvedAt = new Date();
    } else if (data.status && data.status !== "RESOLVED" && current.status === "RESOLVED") {
      resolvedAt = null;
    }

    const issue = await prisma.vendorIssue.update({
      where: { id },
      data: {
        ...(data.status && { status: data.status }),
        ...(data.priority && { priority: data.priority }),
        ...(data.resolution !== undefined && { resolution: data.resolution }),
        ...(data.docLink !== undefined && { docLink: data.docLink || null }),
        ...(resolvedAt !== undefined && { resolvedAt }),
      },
      include: {
        vendor: { select: { id: true, name: true, code: true, whatsappNumber: true, phone: true } },
        bill: { select: { id: true, billNo: true, amount: true } },
        createdBy: { select: { id: true, name: true } },
        notes: {
          include: { author: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    // Auto-log a note on a status change so the follow-up timeline records every stage move.
    if (data.status && data.status !== current.status) {
      const label = data.status.replace(/_/g, " ").toLowerCase();
      const noteText =
        data.status === "RESOLVED" && data.resolution
          ? `Marked resolved — ${data.resolution}`
          : `Status changed to ${label}`;
      const note = await prisma.vendorIssueNote.create({
        data: { issueId: id, text: noteText, authorId: user.id },
        include: { author: { select: { id: true, name: true } } },
      });
      issue.notes = [note, ...issue.notes];
    }

    return successResponse(issue);
  } catch (error) {
    if (error instanceof AuthError)
      return errorResponse(error.message, error.status);
    return errorResponse(
      error instanceof Error ? error.message : "Failed to update issue",
      400
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(["ADMIN"]);
    const { id } = await params;

    const issue = await prisma.vendorIssue.findUnique({ where: { id } });
    if (!issue) return errorResponse("Issue not found", 404);

    await prisma.vendorIssue.delete({ where: { id } });
    return successResponse({ deleted: true });
  } catch (error) {
    if (error instanceof AuthError)
      return errorResponse(error.message, error.status);
    return errorResponse(
      error instanceof Error ? error.message : "Failed to delete issue",
      500
    );
  }
}
