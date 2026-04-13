"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ArrowDownCircle,
  ArrowUpCircle,
  Package,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Role } from "@/types";

interface BottomNavProps {
  role: Role;
}

const allTabs = [
  { href: "/", label: "Home", icon: LayoutDashboard, key: "home" },
  { href: "/inwards", label: "Inwards", icon: ArrowDownCircle, key: "inwards" },
  { href: "/outwards", label: "Outwards", icon: ArrowUpCircle, key: "outwards" },
  { href: "/stock", label: "Stock", icon: Package, key: "stock" },
  { href: "/more", label: "More", icon: MoreHorizontal, key: "more" },
];

function getVisibleTabs(role: Role) {
  // All roles see all tabs, but we highlight certain tabs per role
  return allTabs;
}

function getHighlightedTab(role: Role): string {
  switch (role) {
    case "INWARDS_CLERK":
      return "inwards";
    case "OUTWARDS_CLERK":
      return "outwards";
    case "MANAGER":
      return "home";
    case "SUPERVISOR":
      return "home";
    case "ADMIN":
      return "home";
    default:
      return "home";
  }
}

export function BottomNav({ role }: BottomNavProps) {
  const pathname = usePathname();
  const tabs = getVisibleTabs(role);
  const highlightedTab = getHighlightedTab(role);

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
          const isRoleHighlight = tab.key === highlightedTab && !active;

          return (
            <Link
              key={tab.key}
              href={tab.href}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full min-w-[44px] gap-0.5 transition-colors",
                {
                  "text-slate-900": active,
                  "text-slate-400": !active && !isRoleHighlight,
                  "text-slate-600": isRoleHighlight,
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
