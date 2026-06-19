"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bike, LogOut, Package, LayoutDashboard } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { getPrimaryTabs, FEATURE_NAV_ITEMS, NAV_FEATURE_MAP, HOME_TAB, type NavItem } from "@/lib/nav-config";
import { MENU_GROUPS } from "@/lib/menu-config";
import { usePermissions } from "@/lib/use-permissions";
import type { Role } from "@/types";

interface AppSidebarProps {
  role: Role;
  className?: string;
}

// Responsive sidebar for the single-codebase desktop view. Mirrors the mobile nav
// exactly: quick tabs (bottom-nav equivalents) + the full "More" catalog, all
// role + permission filtered. Every href is a real (dashboard) route.
export function AppSidebar({ role, className }: AppSidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { canView, navTabs } = usePermissions(role);
  const userName = session?.user?.name || "User";
  const initials = userName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  // CEO inherits ADMIN access; ADMIN bypasses the per-feature permission check (sees all).
  const effectiveRole: Role = role === "CEO" ? "ADMIN" : role;
  const canSee = (featureKey?: string) => effectiveRole === "ADMIN" || !featureKey || canView(featureKey);

  // ── Quick tabs: the role's primary tabs + Stock (if viewable) + any admin nav override ──
  const seen = new Set<string>();
  const quick: NavItem[] = [HOME_TAB, ...getPrimaryTabs(role).filter((t) => t.key !== "more" && t.key !== "home")];
  if (canView("stock") && !quick.some((t) => t.href === "/stock")) {
    quick.push({ href: "/stock", label: "Stock", icon: Package, key: "stock" });
  }
  for (const href of navTabs || []) {
    const item = FEATURE_NAV_ITEMS.find((f) => f.href === href);
    if (item && !quick.some((t) => t.href === item.href)) quick.push(item);
  }
  const quickTabs = quick.filter((t) => {
    if (seen.has(t.href)) return false;
    const feature = NAV_FEATURE_MAP[t.href];
    if (feature && !canSee(feature)) return false;
    seen.add(t.href);
    return true;
  });

  // ── Full catalog groups, deduped against the quick tabs ──
  const groups = MENU_GROUPS.map((g) => ({
    title: g.title,
    items: g.items.filter((it) => it.roles.includes(effectiveRole) && canSee(it.featureKey) && !seen.has(it.href)),
  })).filter((g) => g.items.length > 0);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  }

  const linkClass = (active: boolean) =>
    cn(
      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
      active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
    );

  return (
    <aside className={cn("w-60 h-screen sticky top-0 bg-white border-r border-slate-200 flex-col shrink-0", className)}>
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-slate-100 shrink-0">
        <div className="bg-slate-900 rounded-lg p-1.5">
          <Bike className="h-5 w-5 text-white" />
        </div>
        <span className="text-base font-bold text-slate-900">Bike Inventory</span>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-3">
        <div className="space-y-0.5">
          {quickTabs.map((tab) => {
            const Icon = tab.icon ?? LayoutDashboard;
            return (
              <Link key={tab.key} href={tab.href} className={linkClass(isActive(tab.href))}>
                <Icon className="h-4.5 w-4.5 shrink-0" />
                {tab.label}
              </Link>
            );
          })}
        </div>

        {groups.map((group) => (
          <div key={group.title} className="mt-4">
            <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{group.title}</p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} className={linkClass(isActive(item.href))}>
                    <Icon className="h-4.5 w-4.5 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-200 px-4 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
            <span className="text-xs font-semibold text-slate-600">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">{userName}</p>
            <p className="text-[11px] text-slate-400 capitalize">{role.toLowerCase().replace(/_/g, " ")}</p>
          </div>
          <button onClick={() => signOut({ callbackUrl: "/login" })} className="text-slate-400 hover:text-red-500 transition-colors" title="Sign out">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
