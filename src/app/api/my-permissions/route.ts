export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { getServerSession, AuthError } from "@/lib/auth-helpers";
import { APP_FEATURES, type RolePermissions } from "@/app/api/role-permissions/route";

// Default permissions per role (same as role-permissions route)
const DEFAULT_PERMISSIONS: RolePermissions = {
  ADMIN: Object.fromEntries(APP_FEATURES.map(f => [f.key, { view: true, create: true, edit: true, delete: true, approve: true, fetch: true }])),
  SUPERVISOR: Object.fromEntries(APP_FEATURES.map(f => [f.key, {
    view: true,
    create: ["deliveries", "transfers", "stock_audit", "vendor_issues", "expenses"].includes(f.key),
    edit: ["stock", "deliveries", "transfers", "inbound", "stock_audit", "vendors", "bills", "vendor_issues"].includes(f.key),
    delete: false,
    approve: ["deliveries", "stock_audit", "transfers", "inbound"].includes(f.key),
    fetch: ["deliveries", "inbound", "bills", "vendors", "stock"].includes(f.key),
  }])),
  PURCHASE_MANAGER: Object.fromEntries(APP_FEATURES.map(f => [f.key, {
    view: ["dashboard", "stock", "inbound", "vendors", "purchase_orders", "reorder", "barcode", "reports", "bills"].includes(f.key),
    create: ["inbound", "purchase_orders", "vendors"].includes(f.key),
    edit: ["inbound", "purchase_orders", "vendors", "reorder"].includes(f.key),
    delete: false,
    approve: ["purchase_orders", "inbound"].includes(f.key),
    fetch: ["inbound", "vendors", "stock"].includes(f.key),
  }])),
  ACCOUNTS_MANAGER: Object.fromEntries(APP_FEATURES.map(f => [f.key, {
    view: ["dashboard", "stock", "expenses", "bills", "vendors", "stock_audit", "reports", "customers", "transfers"].includes(f.key),
    create: ["expenses", "bills", "customers"].includes(f.key),
    edit: ["expenses", "bills", "customers"].includes(f.key),
    delete: false,
    approve: ["expenses", "bills"].includes(f.key),
    fetch: ["bills"].includes(f.key),
  }])),
  INWARDS_CLERK: Object.fromEntries(APP_FEATURES.map(f => [f.key, {
    view: ["dashboard", "stock", "inbound", "transfers", "stock_audit", "barcode"].includes(f.key),
    create: ["transfers", "stock_audit"].includes(f.key),
    edit: ["inbound", "stock_audit", "transfers"].includes(f.key),
    delete: false,
    approve: ["inbound"].includes(f.key),
    fetch: ["stock"].includes(f.key),
  }])),
  OUTWARDS_CLERK: Object.fromEntries(APP_FEATURES.map(f => [f.key, {
    view: ["dashboard", "stock", "inbound", "deliveries", "barcode"].includes(f.key),
    create: false,
    edit: ["deliveries"].includes(f.key),
    delete: false,
    approve: ["deliveries"].includes(f.key),
    fetch: ["deliveries"].includes(f.key),
  }])),
};

// GET: Return current user's own permissions (any authenticated user)
export async function GET() {
  try {
    const session = await getServerSession();
    if (!session?.user) return errorResponse("Not authenticated", 401);

    const role = (session.user as { role?: string }).role || "INWARDS_CLERK";

    // Admin always has full access
    if (role === "ADMIN") {
      return successResponse({ role, permissions: DEFAULT_PERMISSIONS.ADMIN });
    }

    // CUSTOM role — read permissions from user record
    if (role === "CUSTOM") {
      const userId = (session.user as { id?: string }).id;
      if (userId) {
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { permissions: true, customRoleName: true } });
        if (user?.permissions) {
          // User has per-user permissions stored as { featureKey: { view, create, ... } }
          const userPerms = user.permissions as Record<string, { view: boolean; create: boolean; edit: boolean; delete: boolean; approve: boolean; fetch: boolean }>;
          const merged: Record<string, { view: boolean; create: boolean; edit: boolean; delete: boolean; approve: boolean; fetch: boolean }> = {};
          for (const feature of APP_FEATURES) {
            merged[feature.key] = userPerms[feature.key] || { view: false, create: false, edit: false, delete: false, approve: false, fetch: false };
          }
          return successResponse({ role, customRoleName: user.customRoleName, permissions: merged });
        }
      }
      // Fallback: no permissions set for custom user
      const empty: Record<string, { view: boolean; create: boolean; edit: boolean; delete: boolean; approve: boolean; fetch: boolean }> = {};
      for (const feature of APP_FEATURES) {
        empty[feature.key] = { view: false, create: false, edit: false, delete: false, approve: false, fetch: false };
      }
      return successResponse({ role, permissions: empty });
    }

    // Read saved permissions from DB
    const config = await prisma.alertConfig.findUnique({ where: { id: "singleton" } });
    const saved = config?.rolePermissions as RolePermissions | null;

    // Merge defaults with saved overrides for this role
    const merged: Record<string, { view: boolean; create: boolean; edit: boolean; delete: boolean; approve: boolean; fetch: boolean }> = {};
    for (const feature of APP_FEATURES) {
      merged[feature.key] = {
        ...(DEFAULT_PERMISSIONS[role]?.[feature.key] || { view: false, create: false, edit: false, delete: false, approve: false, fetch: false }),
        ...(saved?.[role]?.[feature.key]),
      };
    }

    return successResponse({ role, permissions: merged });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed", 500);
  }
}
