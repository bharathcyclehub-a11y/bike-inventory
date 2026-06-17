import { getServerSession as nextAuthGetServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { userCan, type PermAction } from "@/lib/permissions-server";
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

  if (roles && roles.length > 0 && !roles.includes(user.role)) {
    // CEO has all ADMIN permissions — if ADMIN is in allowed roles, CEO passes too
    if (!(user.role === "CEO" && roles.includes("ADMIN"))) {
      throw new AuthError("Insufficient permissions", 403);
    }
  }

  return user;
}

/**
 * Permission-aware guard. Authorises the request if the user is ADMIN/CEO, OR their role is in
 * `fallbackRoles` (preserves existing built-in behaviour with no regression), OR their effective
 * permission grants the given action on the feature (this is what lets CUSTOM roles through once
 * the admin grants them — fixing the "I granted it but she can't access it" bug).
 */
export async function requireFeature(
  feature: string,
  action: PermAction = "view",
  fallbackRoles?: Role[]
) {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Authentication required", 401);
  if (!user.isActive) throw new AuthError("Account is inactive", 403);

  if (user.role === "ADMIN" || user.role === "CEO") return user;
  if (fallbackRoles && fallbackRoles.includes(user.role)) return user;

  const allowed = await userCan({ id: user.id, role: user.role }, feature, action);
  if (!allowed) throw new AuthError("Insufficient permissions", 403);

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
