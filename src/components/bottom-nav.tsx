"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { getPrimaryTabs, NAV_FEATURE_MAP, FEATURE_NAV_ITEMS, HOME_TAB, MORE_TAB } from "@/lib/nav-config";
import { usePermissions } from "@/lib/use-permissions";
import type { Role } from "@/types";

interface BottomNavProps {
  role: Role;
}

export function BottomNav({ role }: BottomNavProps) {
  const pathname = usePathname();
  const { canView } = usePermissions(role);
  // CUSTOM roles get their tabs from the full feature catalog (filtered by grants below) instead
  // of a hardcoded per-role list — so any granted feature shows up.
  const allTabs = role === "CUSTOM" ? [HOME_TAB, ...FEATURE_NAV_ITEMS, MORE_TAB] : getPrimaryTabs(role);

  // Filter tabs by permission (always show home + more)
  const filtered = allTabs.filter((tab) => {
    if (tab.key === "home" || tab.key === "more") return true;
    const feature = NAV_FEATURE_MAP[tab.href];
    if (!feature) return true; // No permission mapping = always show
    return canView(feature);
  });

  // Keep the mobile bar uncluttered: Home + up to 3 granted features + More. The rest stay
  // reachable from the permission-filtered "More" page.
  const tabs =
    role === "CUSTOM"
      ? [HOME_TAB, ...filtered.filter((t) => t.key !== "home" && t.key !== "more").slice(0, 3), MORE_TAB]
      : filtered;

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 safe-bottom">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {tabs.map((tab) => {
          const active = isActive(tab.href);
          const Icon = tab.icon;

          return (
            <Link
              key={tab.key}
              href={tab.href}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full min-w-[44px] gap-0.5 transition-colors",
                {
                  "text-slate-900": active,
                  "text-slate-400": !active,
                }
              )}
            >
              <Icon
                className={cn("h-5 w-5", {
                  "stroke-[2.5px]": active,
                })}
              />
              <span
                className={cn("text-[10px] font-medium", {
                  "font-semibold": active,
                })}
              >
                {tab.label}
              </span>
              {active && (
                <div className="absolute top-0 w-8 h-0.5 bg-slate-900 rounded-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
