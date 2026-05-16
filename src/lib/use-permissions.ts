import { useState, useEffect, useCallback } from "react";

interface FeaturePermission {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  approve: boolean;
  fetch: boolean;
}

type Permissions = Record<string, FeaturePermission>;

// Cache with TTL (5 minutes)
const CACHE_TTL = 5 * 60 * 1000;
let cachedPermissions: { role: string; perms: Permissions; fetchedAt: number } | null = null;

function isCacheValid(role: string): boolean {
  if (!cachedPermissions) return false;
  if (cachedPermissions.role !== role) return false;
  return Date.now() - cachedPermissions.fetchedAt < CACHE_TTL;
}

/** Force clear the permission cache (e.g. after admin saves new permissions) */
export function clearPermissionCache() {
  cachedPermissions = null;
}

export function usePermissions(role: string) {
  const [permissions, setPermissions] = useState<Permissions | null>(
    isCacheValid(role) ? cachedPermissions!.perms : null
  );
  const [loading, setLoading] = useState(!isCacheValid(role));

  const refetch = useCallback(() => {
    if (!role || role === "ADMIN" || role === "CEO") return;
    setLoading(true);
    fetch("/api/my-permissions")
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data?.permissions) {
          const perms = res.data.permissions as Permissions;
          cachedPermissions = { role, perms, fetchedAt: Date.now() };
          setPermissions(perms);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [role]);

  useEffect(() => {
    if (!role || role === "ADMIN" || role === "CEO") {
      setLoading(false);
      return;
    }
    if (isCacheValid(role)) {
      setPermissions(cachedPermissions!.perms);
      setLoading(false);
      return;
    }
    refetch();
  }, [role, refetch]);

  const canView = (feature: string) => {
    if (role === "ADMIN" || role === "CEO") return true;
    return permissions?.[feature]?.view ?? true;
  };

  const canCreate = (feature: string) => {
    if (role === "ADMIN" || role === "CEO") return true;
    return permissions?.[feature]?.create ?? false;
  };

  const canEdit = (feature: string) => {
    if (role === "ADMIN" || role === "CEO") return true;
    return permissions?.[feature]?.edit ?? false;
  };

  const canDelete = (feature: string) => {
    if (role === "ADMIN" || role === "CEO") return true;
    return permissions?.[feature]?.delete ?? false;
  };

  const canApprove = (feature: string) => {
    if (role === "ADMIN" || role === "CEO") return true;
    return permissions?.[feature]?.approve ?? false;
  };

  const canFetch = (feature: string) => {
    if (role === "ADMIN" || role === "CEO") return true;
    return permissions?.[feature]?.fetch ?? false;
  };

  return { permissions, loading, canView, canCreate, canEdit, canDelete, canApprove, canFetch, refetch };
}
