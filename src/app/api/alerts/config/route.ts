export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

export async function GET() {
  try {
    await requireAuth(["ADMIN"]);

    const config = await prisma.alertConfig.findUnique({ where: { id: "singleton" } });
    return successResponse(config || { id: "singleton", redFlagPhones: "" });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch config", 500);
  }
}

export async function PUT(req: NextRequest) {
  try {
    await requireAuth(["ADMIN"]);
    const body = await req.json();
    const { redFlagPhones } = body as { redFlagPhones: string };

    const config = await prisma.alertConfig.upsert({
      where: { id: "singleton" },
      update: { redFlagPhones },
      create: { id: "singleton", redFlagPhones },
    });

    return successResponse(config);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to update config", 400);
  }
}
