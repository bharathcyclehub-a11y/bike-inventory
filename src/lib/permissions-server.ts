// Server-side permission resolver — the SINGLE source of truth for "what can this user do".
// Used by /api/my-permissions (drives the UI's canView) AND by requireFeature() in the API
// guards, so the navigation, the page, and the data layer all agree on the same grants.
//
// Why this exists: previously the nav and the API hardcoded role allow-lists that ignored the
// per-user CUSTOM-role grants, so granting a custom role a feature had no effect. Resolving
// permissions live from the DB here (no reliance on a stale session) fixes that class of bug.

import { prisma } from "@/lib/db";
import { APP_FEATURES, type RolePermissions, type FeaturePermission } from "@/lib/app-features";

export type PermAction = keyof FeaturePermission; // "view" | "create" | "edit" | "delete" | "approve" | "fetch"

const NONE: FeaturePermission = { view: false, create: false, edit: false, delete: false, approve: false, fetch: false };
const ALL: FeaturePermission = { view: true, create: true, edit: true, delete: true, approve: true, fetch: true };

// Built-in role defaults — kept in sync with the admin "Roles & Permissions" editor.
export const DEFAULT_PERMISSIONS: RolePermissions = {
  ADMIN: Object.fromEntries(APP_FEATURES.map(f => [f.key, { ...ALL }])),
  SUPERVISOR: Object.fromEntries(APP_FEATURES.map(f => [f.key, {
    view: true,
    create: ["deliveries", "transfers", "stock_audit", "vendor_issues", "expenses"].includes(f.key),
    edit: ["stock", "deliveries", "transfers", "inbound", "stock_audit", "vendors", "bills", "vendor_issues"].includes(f.key),
    delete: false,
    approve: ["deliveries", "stock_audit", "transfers", "inbound"].includes(f.key),
    fetch: ["deliveries", "inbound", "bills", "vendors", "stock"].includes(f.key),
  }])),
  PURCHASE_MANAGER: Object.fromEntries(APP_FEATURES.map(f => [f.key, {
    view: ["dashboard", "stock", "inbound", "vendors", "purchase_orders", "reorder", "barcode", "reports", "bills", "vendor_issues"].includes(f.key),
    create: ["inbound", "purchase_orders", "vendors", "vendor_issues"].includes(f.key),
    edit: ["inbound", "purchase_orders", "vendors", "reorder", "vendor_issues"].includes(f.key),
    delete: false,
    approve: ["purchase_orders", "inbound"].includes(f.key),
    fetch: ["inbound", "vendors", "stock"].includes(f.key),
  }])),
  ACCOUNTS_MANAGER: Object.fromEntries(APP_FEATURES.map(f => [f.key, {
    view: ["dashboard", "stock", "expenses", "bills", "vendors", "stock_audit", "reports", "customers", "transfers", "vendor_issues"].includes(f.key),
    create: ["expenses", "bills", "customers"].includes(f.key),
    edit: ["expenses", "bills", "customers"].includes(f.key),
    delete: false,
    approve: ["expenses", "bills"].includes(f.key),
    fetch: ["bills"].includes(f.key),
  }])),
  INWARDS_EXECUTIVE: Object.fromEntries(APP_FEATURES.map(f => [f.key, {
    view: ["dashboard", "stock", "inbound", "deliveries", "transfers", "stock_audit", "barcode"].includes(f.key),
    create: ["deliveries", "transfers", "stock_audit"].includes(f.key),
    edit: ["inbound", "deliveries", "stock_audit", "transfers"].includes(f.key),
    delete: false,
    approve: ["inbound"].includes(f.key),
    fetch: ["stock", "deliveries"].includes(f.key),
  }])),
  OUTWARDS_EXECUTIVE: Object.fromEntries(APP_FEATURES.map(f => [f.key, {
    view: ["dashboard", "stock", "inbound", "deliveries", "barcode", "second_hand"].includes(f.key),
    create: ["deliveries"].includes(f.key),
    edit: ["deliveries"].includes(f.key),
    delete: false,
    approve: ["deliveries"].includes(f.key),
    fetch: ["deliveries"].includes(f.key),
  }])),
  STORE_MANAGER: Object.fromEntries(APP_FEATURES.map(f => [f.key, {
    view: ["dashboard", "stock", "inbound", "deliveries", "vendors", "bills", "expenses", "stock_audit", "reports", "barcode", "vendor_issues", "customers", "transfers", "team"].includes(f.key),
    create: ["deliveries", "stock_audit", "vendor_issues", "expenses", "transfers"].includes(f.key),
    edit: ["deliveries", "stock", "stock_audit", "vendors", "bills", "vendor_issues"].includes(f.key),
    delete: false,
    approve: ["deliveries", "stock_audit"].includes(f.key),
    fetch: ["deliveries", "inbound", "vendors", "stock", "bills"].includes(f.key),
  }])),
  SALES_MANAGER: Object.fromEntries(APP_FEATURES.map(f => [f.key, {
    view: ["dashboard", "stock", "deliveries", "reports", "barcode", "customers", "second_hand", "vendor_issues"].includes(f.key),
    create: ["deliveries", "customers", "vendor_issues"].includes(f.key),
    edit: ["deliveries", "customers"].includes(f.key),
    delete: false,
    approve: ["deliveries"].includes(f.key),
    fetch: ["deliveries", "stock"].includes(f.key),
  }])),
  SERVICE_MANAGER: Object.fromEntries(APP_FEATURES.map(f => [f.key, {
    view: ["dashboard", "stock", "inbound", "vendor_issues", "stock_audit", "barcode", "reports"].includes(f.key),
    create: ["vendor_issues", "stock_audit"].includes(f.key),
    edit: ["vendor_issues", "stock_audit"].includes(f.key),
    delete: false,
    approve: false,
    fetch: ["stock"].includes(f.key),
  }])),
};

/**
 * Resolve a user's effective permission map LIVE from the DB.
 * - ADMIN / CEO  → everything.
 * - CUSTOM       → the per-user grants on the user record (user.permissions).
 * - built-in     → role defaults merged with the admin's saved overrides (alertConfig.rolePermissions).
 */
export async function getEffectivePermissions(user: { id: string; role: string }): Promise<Record<string, FeaturePermission>> {
  const { id, role } = user;

  if (role === "ADMIN" || role === "CEO") {
    return Object.fromEntries(APP_FEATURES.map(f => [f.key, { ...ALL }]));
  }

  if (role === "CUSTOM") {
    let stored: Record<string, FeaturePermission> = {};
    try {
      const u = await prisma.user.findUnique({ where: { id }, select: { permissions: true } });
      stored = (u?.permissions as Record<string, FeaturePermission> | null) || {};
    } catch { stored = {}; }
    return Object.fromEntries(APP_FEATURES.map(f => [f.key, stored[f.key] || { ...NONE }]));
  }

  let saved: RolePermissions | null = null;
  try {
    const config = await prisma.alertConfig.findUnique({ where: { id: "singleton" } });
    saved = (config?.rolePermissions as RolePermissions | null) || null;
  } catch { saved = null; }

  return Object.fromEntries(APP_FEATURES.map(f => [f.key, {
    ...(DEFAULT_PERMISSIONS[role]?.[f.key] || { ...NONE }),
    ...(saved?.[role]?.[f.key] || {}),
  }]));
}

/** True if the user is allowed the given action on the given feature. */
export async function userCan(user: { id: string; role: string }, feature: string, action: PermAction = "view"): Promise<boolean> {
  if (user.role === "ADMIN" || user.role === "CEO") return true;
  const perms = await getEffectivePermissions(user);
  return !!perms[feature]?.[action];
}
