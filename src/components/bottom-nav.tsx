"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ArrowDownCircle,

  Package,
  MoreHorizontal,
  ArrowRightLeft,
  Building2,
  Receipt,
  Truck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Role } from "@/types";

interface BottomNavProps {
  role: Role;
}

interface TabConfig {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  key: string;
}

// Each role gets exactly 5 tabs tailored to their daily work
function getTabsForRole(role: Role): TabConfig[] {
  switch (role) {
    case "ADMIN":
      return [
        { href: "/", label: "Home", icon: LayoutDashboard, key: "home" },
        { href: "/inbound", label: "Inwards", icon: ArrowDownCircle, key: "inbound" },
        { href: "/deliveries", label: "Deliveries", icon: Truck, key: "deliveries" },
        { href: "/stock", label: "Stock", icon: Package, key: "stock" },
        { href: "/more", label: "More", icon: MoreHorizontal, key: "more" },
      ];
    case "SUPERVISOR":
      return [
        { href: "/", label: "Home", icon: LayoutDashboard, key: "home" },
        { href: "/inbound", label: "Inwards", icon: ArrowDownCircle, key: "inbound" },
        { href: "/vendors", label: "Vendors", icon: Building2, key: "vendors" },
        { href: "/stock", label: "Stock", icon: Package, key: "stock" },
        { href: "/more", label: "More", icon: MoreHorizontal, key: "more" },
      ];
    case "PURCHASE_MANAGER":
      return [
        { href: "/", label: "Home", icon: LayoutDashboard, key: "home" },
        { href: "/inbound", label: "Inwards", icon: ArrowDownCircle, key: "inbound" },
        { href: "/stock", label: "Stock", icon: Package, key: "stock" },
        { href: "/purchase-orders", label: "POs", icon: Receipt, key: "pos" },
        { href: "/more", label: "More", icon: MoreHorizontal, key: "more" },
      ];
    case "ACCOUNTS_MANAGER":
      return [
        { href: "/", label: "Home", icon: LayoutDashboard, key: "home" },
        { href: "/inbound", label: "Inwards", icon: ArrowDownCircle, key: "inbound" },
        { href: "/expenses", label: "Expenses", icon: Receipt, key: "expenses" },
        { href: "/stock", label: "Stock", icon: Package, key: "stock" },
        { href: "/more", label: "More", icon: MoreHorizontal, key: "more" },
      ];
    case "INWARDS_CLERK":
      return [
        { href: "/", label: "Home", icon: LayoutDashboard, key: "home" },
        { href: "/inbound", label: "Inwards", icon: ArrowDownCircle, key: "inbound" },
        { href: "/transfers", label: "Transfers", icon: ArrowRightLeft, key: "transfers" },
        { href: "/stock", label: "Stock", icon: Package, key: "stock" },
        { href: "/more", label: "More", icon: MoreHorizontal, key: "more" },
      ];
    case "OUTWARDS_CLERK":
      return [
        { href: "/", label: "Home", icon: LayoutDashboard, key: "home" },
        { href: "/inbound", label: "Inwards", icon: ArrowDownCircle, key: "inbound" },
        { href: "/deliveries", label: "Deliveries", icon: Truck, key: "deliveries" },
        { href: "/stock", label: "Stock", icon: Package, key: "stock" },
        { href: "/more", label: "More", icon: MoreHorizontal, key: "more" },
      ];
    default:
      return [
        { href: "/", label: "Home", icon: LayoutDashboard, key: "home" },
        { href: "/more", label: "More", icon: MoreHorizontal, key: "more" },
      ];
  }
}

export function BottomNav({ role }: BottomNavProps) {
  const pathname = usePathname();
  const tabs = getTabsForRole(role);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 safe-bottom">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {tabs.map((tab: TabConfig) => {
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
