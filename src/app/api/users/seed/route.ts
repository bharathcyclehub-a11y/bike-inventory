export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

const SEED_USERS = [
  { name: "Syed Ibrahim", email: "syed@bikeinventory.local", role: "ADMIN" as const, accessCode: "SYED123" },
  { name: "Srinu", email: "srinu@bikeinventory.local", role: "SUPERVISOR" as const, accessCode: "SRINU123" },
  { name: "Sravan", email: "sravan@bikeinventory.local", role: "ACCOUNTS_MANAGER" as const, accessCode: "SRAVAN123" },
  { name: "Nithin", email: "nithin@bikeinventory.local", role: "INWARDS_CLERK" as const, accessCode: "NITHIN123" },
  { name: "Ranjitha", email: "ranjitha@bikeinventory.local", role: "OUTWARDS_CLERK" as const, accessCode: "RANJITHA123" },
  { name: "Abhi Gowda", email: "abhi@bikeinventory.local", role: "PURCHASE_MANAGER" as const, accessCode: "ABHI123" },
];

export async function POST(_req: NextRequest) {
  try {
    // Only allow if no users exist (first-time setup) or ADMIN
    const userCount = await prisma.user.count();
    if (userCount > 0) {
      await requireAuth(["ADMIN"]);
    }

    const results = [];

    for (const seed of SEED_USERS) {
      const hashedPassword = await bcrypt.hash(seed.accessCode, 10);

      const existing = await prisma.user.findUnique({ where: { email: seed.email } });
      if (existing) {
        // Update password in case access code changed
        await prisma.user.update({
          where: { email: seed.email },
          data: { password: hashedPassword, name: seed.name, role: seed.role, accessCode: seed.accessCode },
        });
        results.push({ name: seed.name, status: "updated" });
        continue;
      }

      await prisma.user.create({
        data: {
          name: seed.name,
          email: seed.email,
          password: hashedPassword,
          role: seed.role,
          accessCode: seed.accessCode,
        },
      });

      results.push({ name: seed.name, status: "created" });
    }

    return successResponse({ seeded: results });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to seed users", 500);
  }
}
