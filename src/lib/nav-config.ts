import {
  LayoutDashboard,
  ArrowDownCircle,
  Package,
  MoreHorizontal,
  ArrowRightLeft,
  Building2,
  Receipt,
  Truck,
  Users,
  BarChart3,
  FileText,
  Settings,
} from "lucide-react";
import type { Role } from "@/types";

export interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  key: string;
}

// Primary tabs shown in bottom nav (mobile) and sidebar main section (desktop)
export function getPrimaryTabs(role: Role): NavItem[] {
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
    case "CUSTOM":
    default:
      return [
        { href: "/", label: "Home", icon: LayoutDashboard, key: "home" },
        { href: "/inbound", label: "Inwards", icon: ArrowDownCircle, key: "inbound" },
        { href: "/stock", label: "Stock", icon: Package, key: "stock" },
        { href: "/more", label: "More", icon: MoreHorizontal, key: "more" },
      ];
  }
}

// Extra sidebar items visible only on desktop (for ADMIN/SUPERVISOR)
export function getDesktopExtraTabs(role: Role): NavItem[] {
  if (role === "ADMIN") {
    return [
      { href: "/vendors", label: "Vendors", icon: Building2, key: "vendors" },
      { href: "/accounts", label: "Accounts", icon: FileText, key: "accounts" },
      { href: "/reports", label: "Reports", icon: BarChart3, key: "reports" },
      { href: "/team", label: "Team", icon: Users, key: "team" },
      { href: "/more", label: "Settings", icon: Settings, key: "settings" },
    ];
  }
  if (role === "SUPERVISOR") {
    return [
      { href: "/deliveries", label: "Deliveries", icon: Truck, key: "deliveries" },
      { href: "/accounts", label: "Accounts", icon: FileText, key: "accounts" },
      { href: "/reports", label: "Reports", icon: BarChart3, key: "reports" },
      { href: "/team", label: "Team", icon: Users, key: "team" },
    ];
  }
  return [];
}

// Resolve href for desktop context (prefix with /desktop)
export function desktopHref(href: string): string {
  if (href === "/") return "/desktop";
  return `/desktop${href}`;
}
