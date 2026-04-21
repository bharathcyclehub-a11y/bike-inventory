import { useState, useEffect } from "react";

interface FeaturePermission {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  approve: boolean;
  fetch: boolean;
}

type Permissions = Record<string, FeaturePermission>;

// Cache permissions in memory so we don't re-fetch on every page
let cachedPermissions: { role: string; perms: Permissions } | null = null;

export function usePermissions(role: string) {
  const [permissions, setPermissions] = useState<Permissions | null>(
    cachedPermissions?.role === role ? cachedPermissions.perms : null
  );

  useEffect(() => {
    if (!role || role === "ADMIN") return; // Admin has everything
    if (cachedPermissions?.role === role) {
      setPermissions(cachedPermissions.perms);
      return;
    }

    // Non-admin: try to load from API (admin-only endpoint), fall back to defaults
    // Since the GET is admin-only, non-admin users use the default permissions
    // embedded in the client
    const defaults: Record<string, Permissions> = {
      SUPERVISOR: defaultPerms(["deliveries", "inbound", "bills", "vendors", "stock"]),
      PURCHASE_MANAGER: defaultPerms(["inbound", "vendors", "stock"]),
      ACCOUNTS_MANAGER: defaultPerms(["bills"]),
      INWARDS_CLERK: defaultPerms(["stock"]),
      OUTWARDS_CLERK: defaultPerms([]),
    };

    const perms = defaults[role] || defaultPerms([]);
    cachedPermissions = { role, perms };
    setPermissions(perms);
  }, [role]);

  const canFetch = (feature: string) => {
    if (role === "ADMIN") return true;
    return permissions?.[feature]?.fetch ?? false;
  };

  return { permissions, canFetch };
}

function defaultPerms(fetchFeatures: string[]): Permissions {
  const features = [
    "dashboard", "inbound", "deliveries", "stock", "stock_audit", "transfers",
    "vendors", "bills", "purchase_orders", "expenses", "reports", "team",
    "barcode", "reorder", "second_hand", "zoho", "whatsapp_templates",
    "customers", "vendor_issues",
  ];
  const perms: Permissions = {};
  for (const f of features) {
    perms[f] = {
      view: true, create: false, edit: false, delete: false, approve: false,
      fetch: fetchFeatures.includes(f),
    };
  }
  return perms;
}
