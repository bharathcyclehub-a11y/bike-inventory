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

    // Fetch saved permissions from API (works for all authenticated users)
    fetch("/api/my-permissions")
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data?.permissions) {
          const perms = res.data.permissions as Permissions;
          cachedPermissions = { role, perms };
          setPermissions(perms);
        }
      })
      .catch(() => {
        // Fallback to defaults if API fails
      });
  }, [role]);

  const canView = (feature: string) => {
    if (role === "ADMIN") return true;
    return permissions?.[feature]?.view ?? true;
  };

  const canCreate = (feature: string) => {
    if (role === "ADMIN") return true;
    return permissions?.[feature]?.create ?? false;
  };

  const canEdit = (feature: string) => {
    if (role === "ADMIN") return true;
    return permissions?.[feature]?.edit ?? false;
  };

  const canDelete = (feature: string) => {
    if (role === "ADMIN") return true;
    return permissions?.[feature]?.delete ?? false;
  };

  const canApprove = (feature: string) => {
    if (role === "ADMIN") return true;
    return permissions?.[feature]?.approve ?? false;
  };

  const canFetch = (feature: string) => {
    if (role === "ADMIN") return true;
    return permissions?.[feature]?.fetch ?? false;
  };

  return { permissions, canView, canCreate, canEdit, canDelete, canApprove, canFetch };
}
