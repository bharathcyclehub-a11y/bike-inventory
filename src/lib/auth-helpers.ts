import { getServerSession as nextAuthGetServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { Role } from "@/types";

export async function getServerSession() {
  return nextAuthGetServerSession(authOptions);
}

export async function getCurrentUser() {
  const session = await getServerSession();
  if (!session?.user) return null;

  const user = session.user as {
    name?: string | null;
    email?: string | null;
    role?: string;
    userId?: string;
  };

  if (!user.userId || !user.role) return null;

  // Verify user is still active in the database
  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { isActive: true },
  });
  if (!dbUser || !dbUser.isActive) return null;

  return {
    id: user.userId,
    name: user.name || "User",
    email: user.email || "",
    role: user.role as Role,
    isActive: dbUser.isActive,
  };
}

export async function requireAuth(roles?: Role[]) {
  const user = await getCurrentUser();

  if (!user) {
    throw new AuthError("Authentication required", 401);
  }

  if (!user.isActive) {
    throw new AuthError("Account is inactive", 403);
  }

  if (roles && roles.length > 0 && !roles.includes(user.role) && user.role !== "CUSTOM") {
    throw new AuthError("Insufficient permissions", 403);
  }

  return user;
}

export class AuthError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}
