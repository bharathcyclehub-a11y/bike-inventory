export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { getServerSession, AuthError } from "@/lib/auth-helpers";
import { getEffectivePermissions } from "@/lib/permissions-server";

// GET: Return the current user's own effective permissions (any authenticated user).
// Resolution is delegated to src/lib/permissions-server.ts so the UI (canView) and the API
// guards (requireFeature) always agree.
export async function GET() {
  try {
    const session = await getServerSession();
    if (!session?.user) return errorResponse("Not authenticated", 401);

    const role = (session.user as { role?: string }).role || "INWARDS_EXECUTIVE";
    const userId = (session.user as { id?: string; userId?: string }).userId
      || (session.user as { id?: string }).id
      || "";

    const permissions = await getEffectivePermissions({ id: userId, role });

    // Include the custom role's display name when relevant.
    let customRoleName: string | null = null;
    if (role === "CUSTOM" && userId) {
      try {
        const u = await prisma.user.findUnique({ where: { id: userId }, select: { customRoleName: true } });
        customRoleName = u?.customRoleName ?? null;
      } catch { customRoleName = null; }
    }

    return successResponse({ role, customRoleName, permissions });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed", 500);
  }
}
