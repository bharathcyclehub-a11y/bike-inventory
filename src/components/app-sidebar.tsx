"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bike, LogOut } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { getPrimaryTabs, getDesktopExtraTabs, NAV_FEATURE_MAP, FEATURE_NAV_ITEMS, HOME_TAB } from "@/lib/nav-config";
import { usePermissions } from "@/lib/use-permissions";
import type { Role } from "@/types";

interface AppSidebarProps {
  role: Role;
  className?: string;
}

// Responsive sidebar for the single-codebase desktop view. Links straight to the
// (dashboard) routes — no /desktop prefix — so every page works on desktop.
export function AppSidebar({ role, className }: AppSidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { canView } = usePermissions(role);
  const userName = session?.user?.name || "User";
  const initials = userName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  const primaryTabs = role === "CUSTOM" ? [HOME_TAB, ...FEATURE_NAV_ITEMS] : getPrimaryTabs(role);
  const extraTabs = getDesktopExtraTabs(role);

  function isAllowed(href: string, key: string): boolean {
    if (key === "home" || key === "more" || key === "settings" || key === "activity") return true;
    const feature = NAV_FEATURE_MAP[href];
    if (!feature) return true;
    return canView(feature);
  }

  const mainTabs = primaryTabs.filter((t) => t.key !== "more" && isAllowed(t.href, t.key));
  const mainKeys = new Set(mainTabs.map((t) => t.key));
  const secondaryTabs = extraTabs.filter((t) => !mainKeys.has(t.key) && t.key !== "settings" && isAllowed(t.href, t.key));
  const settingsTab = extraTabs.find((t) => t.key === "settings");

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  }

  const linkClass = (active: boolean) =>
    cn(
      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
      active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
    );

  return (
    <aside className={cn("w-60 h-screen sticky top-0 bg-white border-r border-slate-200 flex-col shrink-0", className)}>
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-slate-100">
        <div className="bg-slate-900 rounded-lg p-1.5">
          <Bike className="h-5 w-5 text-white" />
        </div>
        <span className="text-base font-bold text-slate-900">Bike Inventory</span>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-3">
        <div className="space-y-0.5">
          {mainTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <Link key={tab.key} href={tab.href} className={linkClass(isActive(tab.href))}>
                <Icon className="h-4.5 w-4.5 shrink-0" />
                {tab.label}
              </Link>
            );
          })}
        </div>

        {secondaryTabs.length > 0 && (
          <>
            <div className="my-3 border-t border-slate-100" />
            <div className="space-y-0.5">
              {secondaryTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <Link key={tab.key} href={tab.href} className={linkClass(isActive(tab.href))}>
                    <Icon className="h-4.5 w-4.5 shrink-0" />
                    {tab.label}
                  </Link>
                );
              })}
            </div>
          </>
        )}

        {settingsTab && (
          <>
            <div className="my-3 border-t border-slate-100" />
            <Link href={settingsTab.href} className={linkClass(isActive(settingsTab.href))}>
              <settingsTab.icon className="h-4.5 w-4.5 shrink-0" />
              {settingsTab.label}
            </Link>
          </>
        )}
      </nav>

      <div className="border-t border-slate-200 px-4 py-3">
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
