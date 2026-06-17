export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";
import { APP_FEATURES, type FeaturePermission, type RolePermissions } from "@/lib/app-features";

// Re-exported for backward compatibility with any modules importing these from this route.
export { APP_FEATURES };
export type { FeaturePermission, RolePermissions };

// Default permissions per role
const DEFAULT_PERMISSIONS: RolePermissions = {
  CEO: Object.fromEntries(APP_FEATURES.map(f => [f.key, { view: true, create: true, edit: true, delete: true, approve: true, fetch: true }])),
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
  INWARDS_EXECUTIVE: Object.fromEntries(APP_FEATURES.map(f => [f.key, {
    view: ["dashboard", "stock", "inbound", "transfers", "stock_audit", "barcode"].includes(f.key),
    create: ["transfers", "stock_audit"].includes(f.key),
    edit: ["inbound", "stock_audit", "transfers"].includes(f.key),
    delete: false,
    approve: ["inbound"].includes(f.key),
    fetch: ["stock"].includes(f.key),
  }])),
  OUTWARDS_EXECUTIVE: Object.fromEntries(APP_FEATURES.map(f => [f.key, {
    view: ["dashboard", "stock", "inbound", "deliveries", "barcode"].includes(f.key),
    create: false,
    edit: ["deliveries"].includes(f.key),
    delete: false,
    approve: ["deliveries"].includes(f.key),
    fetch: ["deliveries"].includes(f.key),
  }])),
  STORE_MANAGER: Object.fromEntries(APP_FEATURES.map(f => [f.key, {
    view: true,
    create: ["deliveries", "transfers", "stock_audit", "vendor_issues", "expenses", "customers"].includes(f.key),
    edit: ["stock", "deliveries", "transfers", "inbound", "stock_audit", "vendors", "bills", "vendor_issues"].includes(f.key),
    delete: false,
    approve: ["deliveries", "stock_audit", "transfers", "inbound"].includes(f.key),
    fetch: ["deliveries", "inbound", "bills", "vendors", "stock"].includes(f.key),
  }])),
  SALES_MANAGER: Object.fromEntries(APP_FEATURES.map(f => [f.key, {
    view: ["dashboard", "stock", "deliveries", "barcode", "reports", "vendor_issues", "customers", "second_hand"].includes(f.key),
    create: ["deliveries", "customers", "vendor_issues"].includes(f.key),
    edit: ["deliveries", "customers"].includes(f.key),
    delete: false,
    approve: ["deliveries"].includes(f.key),
    fetch: ["deliveries", "stock"].includes(f.key),
  }])),
  SERVICE_MANAGER: Object.fromEntries(APP_FEATURES.map(f => [f.key, {
    view: ["dashboard", "stock", "vendor_issues", "barcode", "reports"].includes(f.key),
    create: ["vendor_issues"].includes(f.key),
    edit: ["vendor_issues"].includes(f.key),
    delete: false,
    approve: false,
    fetch: ["stock"].includes(f.key),
  }])),
};

// GET: Fetch role permissions
export async function GET() {
  try {
    await requireAuth(["ADMIN"]);

    const config = await prisma.alertConfig.findUnique({ where: { id: "singleton" } });
    const saved = config?.rolePermissions as RolePermissions | null;

    // Merge saved with defaults (to pick up any new features)
    const merged: RolePermissions = {};
    for (const role of Object.keys(DEFAULT_PERMISSIONS)) {
      merged[role] = {};
      for (const feature of APP_FEATURES) {
        merged[role][feature.key] = {
          ...DEFAULT_PERMISSIONS[role]?.[feature.key] || { view: false, create: false, edit: false, delete: false, approve: false, fetch: false },
          ...saved?.[role]?.[feature.key],
        };
      }
    }

    return successResponse({ permissions: merged, features: APP_FEATURES });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed", 500);
  }
}

// PUT: Update role permissions
export async function PUT(req: NextRequest) {
  try {
    await requireAuth(["ADMIN"]);
    const body = await req.json();
    const { permissions } = body as { permissions: RolePermissions };

    if (!permissions || typeof permissions !== "object") {
      return errorResponse("Invalid permissions data", 400);
    }

    // Ensure ADMIN always has full access
    if (permissions.ADMIN) {
      for (const feature of APP_FEATURES) {
        permissions.ADMIN[feature.key] = { view: true, create: true, edit: true, delete: true, approve: true, fetch: true };
      }
    }

    await prisma.alertConfig.upsert({
      where: { id: "singleton" },
      update: { rolePermissions: permissions as object },
      create: { id: "singleton", rolePermissions: permissions as object },
    });

    return successResponse({ saved: true });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed", 400);
  }
}
