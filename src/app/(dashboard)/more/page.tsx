"use client";

import { useSession, signOut } from "next-auth/react";
import {
  User,
  Settings,
  BarChart3,
  Warehouse,
  QrCode,
  ClipboardCheck,
  LogOut,
  ChevronRight,
  MessageSquare,
  Building2,
  ShoppingCart,
  FileText,
  CreditCard,
  Receipt,
  Users,
  Cloud,
  Brain,
  ArrowRightLeft,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Role } from "@/types";

interface MenuItem {
  label: string;
  icon: typeof Building2;
  href: string;
  roles: Role[];
  comingSoon?: boolean;
}

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Owner / Director",
  SUPERVISOR: "Store Supervisor",
  MANAGER: "Operations Manager",
  INWARDS_CLERK: "Inventory & Receiving Lead",
  OUTWARDS_CLERK: "Sales & Dispatch Lead",
};

const menuItems: MenuItem[] = [
  {
    label: "Vendors",
    icon: Building2,
    href: "/vendors",
    roles: ["ADMIN", "SUPERVISOR", "MANAGER"],
  },
  {
    label: "Reorder Dashboard",
    icon: RefreshCw,
    href: "/reorder",
    roles: ["ADMIN", "MANAGER"],
  },
  {
    label: "Purchase Orders",
    icon: ShoppingCart,
    href: "/purchase-orders",
    roles: ["ADMIN", "SUPERVISOR", "MANAGER"],
  },
  {
    label: "Bills & Payments",
    icon: FileText,
    href: "/bills",
    roles: ["ADMIN", "SUPERVISOR", "MANAGER"],
  },
  {
    label: "Record Payment",
    icon: CreditCard,
    href: "/payments/new",
    roles: ["ADMIN", "MANAGER"],
  },
  {
    label: "Expenses",
    icon: Receipt,
    href: "/expenses",
    roles: ["ADMIN", "SUPERVISOR", "MANAGER"],
  },
  {
    label: "Transfers",
    icon: ArrowRightLeft,
    href: "/transfers",
    roles: ["ADMIN", "SUPERVISOR", "MANAGER"],
  },
  {
    label: "Stock Audit",
    icon: ClipboardCheck,
    href: "/stock-audit",
    roles: ["ADMIN", "SUPERVISOR", "MANAGER"],
  },
  {
    label: "Bins & Locations",
    icon: Warehouse,
    href: "/more/bins",
    roles: ["ADMIN"],
  },
  {
    label: "Barcode Scanner",
    icon: QrCode,
    href: "/scanner",
    roles: ["ADMIN", "SUPERVISOR", "MANAGER", "INWARDS_CLERK", "OUTWARDS_CLERK"],
  },
  {
    label: "Team Management",
    icon: Users,
    href: "/team",
    roles: ["ADMIN", "SUPERVISOR"],
  },
  {
    label: "AI Insights",
    icon: Brain,
    href: "/ai",
    roles: ["ADMIN", "SUPERVISOR", "MANAGER"],
  },
  {
    label: "Reports",
    icon: BarChart3,
    href: "/reports",
    roles: ["ADMIN", "SUPERVISOR"],
  },
  {
    label: "Team Chat",
    icon: MessageSquare,
    href: "#",
    roles: ["ADMIN", "SUPERVISOR", "MANAGER", "INWARDS_CLERK", "OUTWARDS_CLERK"],
    comingSoon: true,
  },
  {
    label: "Zoho Books Sync",
    icon: Cloud,
    href: "/more/zoho",
    roles: ["ADMIN"],
  },
  {
    label: "Settings",
    icon: Settings,
    href: "#",
    roles: ["ADMIN"],
    comingSoon: true,
  },
];

export default function MorePage() {
  const { data: session } = useSession();
  const user = session?.user as { name?: string; role?: string; userId?: string } | undefined;
  const role = (user?.role || "INWARDS_CLERK") as Role;

  const visibleItems = menuItems.filter((item) => item.roles.includes(role));

  return (
    <div>
      {/* User Card */}
      <Card className="mb-4">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-slate-200 flex items-center justify-center">
            <User className="h-6 w-6 text-slate-500" />
          </div>
          <div className="flex-1">
            <p className="text-base font-semibold text-slate-900">
              {user?.name || "User"}
            </p>
            <Badge variant="info">{ROLE_LABELS[role]}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Menu Items */}
      <div className="space-y-1">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          if (item.comingSoon) {
            return (
              <div key={item.label} className="flex items-center gap-3 px-4 py-3 rounded-lg opacity-50 cursor-not-allowed">
                <Icon className="h-5 w-5 text-slate-400" />
                <span className="flex-1 text-sm font-medium text-slate-500">
                  {item.label}
                </span>
                <Badge variant="default">Soon</Badge>
              </div>
            );
          }
          return (
            <Link key={item.href} href={item.href}>
              <div className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-100 transition-colors">
                <Icon className="h-5 w-5 text-slate-500" />
                <span className="flex-1 text-sm font-medium text-slate-700">
                  {item.label}
                </span>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Sign Out */}
      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-red-50 transition-colors w-full mt-4"
      >
        <LogOut className="h-5 w-5 text-red-500" />
        <span className="text-sm font-medium text-red-600">Sign Out</span>
      </button>

      <p className="text-xs text-slate-300 text-center mt-8">
        Bike Inventory v0.8.0 | Final
      </p>
    </div>
  );
}
