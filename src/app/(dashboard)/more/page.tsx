"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import {
  User,
  Settings,
  BarChart3,
  Warehouse,
  QrCode,
  Tag,
  ClipboardCheck,
  LogOut,
  ChevronRight,
  ChevronDown,
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
  HandCoins,
  AlertCircle,
  Bell,
  Truck,
  Bike,
  UserCheck,
  Clock,
  IndianRupee,
  Wrench,
  ClipboardList,
  ListTodo,
  BookOpenCheck,
  Activity,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePermissions } from "@/lib/use-permissions";
import type { Role } from "@/types";

interface MenuItem {
  label: string;
  icon: typeof Building2;
  href: string;
  roles: Role[];
  featureKey?: string; // maps to permission system feature key
  comingSoon?: boolean;
}

interface MenuGroup {
  title: string;
  items: MenuItem[];
}

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Owner / Director",
  SUPERVISOR: "Store Supervisor",
  PURCHASE_MANAGER: "Purchase Manager",
  ACCOUNTS_MANAGER: "Accounts Manager",
  INWARDS_CLERK: "Inventory & Receiving Lead",
  OUTWARDS_CLERK: "Sales & Dispatch Lead",
  CUSTOM: "Custom Role",
};

const MENU_GROUPS: MenuGroup[] = [
  {
    title: "Operations Hub",
    items: [
      { label: "Tasks", icon: ListTodo, href: "/tasks", roles: ["ADMIN", "SUPERVISOR", "PURCHASE_MANAGER", "ACCOUNTS_MANAGER", "INWARDS_CLERK", "OUTWARDS_CLERK", "CUSTOM"] },
      { label: "SOPs", icon: BookOpenCheck, href: "/sops", roles: ["ADMIN", "SUPERVISOR"] },
      { label: "My Check-offs", icon: ClipboardCheck, href: "/sops/my-checkoffs", roles: ["ADMIN", "SUPERVISOR", "PURCHASE_MANAGER", "ACCOUNTS_MANAGER", "INWARDS_CLERK", "OUTWARDS_CLERK", "CUSTOM"] },
      { label: "Ops Stats", icon: Activity, href: "/ops-stats", roles: ["ADMIN", "SUPERVISOR"] },
    ],
  },
  {
    title: "Accounts",
    items: [
      { label: "Accounts Dashboard", icon: IndianRupee, href: "/accounts", roles: ["ADMIN", "SUPERVISOR", "ACCOUNTS_MANAGER"], featureKey: "bills" },
      { label: "Bills & Payments", icon: FileText, href: "/bills", roles: ["ADMIN", "SUPERVISOR"], featureKey: "bills" },
      { label: "Record Payment", icon: CreditCard, href: "/payments/new", roles: ["ADMIN", "SUPERVISOR"], featureKey: "bills" },
      { label: "Receivables", icon: HandCoins, href: "/receivables", roles: ["ADMIN", "SUPERVISOR"], featureKey: "customers" },
      { label: "Expenses", icon: Receipt, href: "/expenses", roles: ["ADMIN", "SUPERVISOR"], featureKey: "expenses" },
    ],
  },
  {
    title: "Purchase",
    items: [
      { label: "Vendors", icon: Building2, href: "/vendors", roles: ["ADMIN", "SUPERVISOR", "PURCHASE_MANAGER"], featureKey: "vendors" },
      { label: "Purchase Orders", icon: ShoppingCart, href: "/purchase-orders", roles: ["ADMIN", "SUPERVISOR", "PURCHASE_MANAGER"], featureKey: "purchase_orders" },
      { label: "Vendor Issues", icon: AlertCircle, href: "/vendor-issues", roles: ["ADMIN", "SUPERVISOR", "PURCHASE_MANAGER", "ACCOUNTS_MANAGER"], featureKey: "vendor_issues" },
      { label: "Inbound Tracking", icon: Truck, href: "/inbound", roles: ["ADMIN", "SUPERVISOR", "PURCHASE_MANAGER"], featureKey: "inbound" },
    ],
  },
  {
    title: "Operations",
    items: [
      { label: "Transfers", icon: ArrowRightLeft, href: "/transfers", roles: ["ADMIN", "SUPERVISOR"], featureKey: "transfers" },
      { label: "Stock Audit", icon: ClipboardCheck, href: "/stock-audit", roles: ["ADMIN", "SUPERVISOR", "PURCHASE_MANAGER", "ACCOUNTS_MANAGER", "INWARDS_CLERK", "OUTWARDS_CLERK"], featureKey: "stock_audit" },
      { label: "Barcode Scanner", icon: QrCode, href: "/scanner", roles: ["ADMIN", "SUPERVISOR", "PURCHASE_MANAGER", "INWARDS_CLERK", "OUTWARDS_CLERK"], featureKey: "barcode" },
      { label: "Label Designer", icon: Tag, href: "/more/label-designer", roles: ["ADMIN"], featureKey: "barcode" },
      { label: "Reorder Dashboard", icon: RefreshCw, href: "/reorder", roles: ["ADMIN", "PURCHASE_MANAGER"], featureKey: "reorder" },
      { label: "Deliveries", icon: Truck, href: "/deliveries", roles: ["ADMIN", "SUPERVISOR", "OUTWARDS_CLERK"], featureKey: "deliveries" },
      { label: "Second-Hand Cycles", icon: Bike, href: "/second-hand", roles: ["ADMIN", "SUPERVISOR", "OUTWARDS_CLERK", "ACCOUNTS_MANAGER"], featureKey: "second_hand" },
    ],
  },
  {
    title: "Admin",
    items: [
      { label: "Activity Log", icon: ClipboardList, href: "/activity", roles: ["ADMIN", "SUPERVISOR", "OUTWARDS_CLERK", "INWARDS_CLERK", "PURCHASE_MANAGER", "ACCOUNTS_MANAGER", "CUSTOM"] },
      { label: "Team Management", icon: Users, href: "/team", roles: ["ADMIN", "SUPERVISOR"], featureKey: "team" },
      { label: "Reports", icon: BarChart3, href: "/reports", roles: ["ADMIN", "SUPERVISOR"], featureKey: "reports" },
      { label: "Service Revenue", icon: Wrench, href: "/service-revenue", roles: ["ADMIN"] },
      { label: "AI Insights", icon: Brain, href: "/ai", roles: ["ADMIN", "SUPERVISOR", "PURCHASE_MANAGER"], featureKey: "reorder" },
      { label: "Bins & Locations", icon: Warehouse, href: "/more/bins", roles: ["ADMIN"] },
      { label: "Brand Management", icon: Settings, href: "/more/brands", roles: ["ADMIN"] },
      { label: "Brand Lead Times", icon: Clock, href: "/more/brand-lead-times", roles: ["ADMIN"] },
      { label: "Price Correction", icon: IndianRupee, href: "/price-correction", roles: ["ADMIN"] },
      { label: "WhatsApp Templates", icon: MessageSquare, href: "/more/whatsapp-templates", roles: ["ADMIN"], featureKey: "whatsapp_templates" },
      { label: "Alert Config", icon: Bell, href: "/more/alerts", roles: ["ADMIN"] },
      { label: "Zoho Books Sync", icon: Cloud, href: "/more/zoho", roles: ["ADMIN"], featureKey: "zoho" },
    ],
  },
];

export default function MorePage() {
  const { data: session } = useSession();
  const user = session?.user as { name?: string; role?: string; userId?: string } | undefined;
  const role = (user?.role || "INWARDS_CLERK") as Role;
  const { canView } = usePermissions(role);
  const [syncClearing, setSyncClearing] = useState(false);
  const [syncResult, setSyncResult] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const handleClearSync = async () => {
    setSyncClearing(true);
    setSyncResult("");
    try {
      const res = await fetch("/api/sync/clear", { method: "POST" }).then(r => r.json());
      if (res.success) {
        const { clearedSyncs, clearedPulls } = res.data;
        setSyncResult(clearedSyncs + clearedPulls > 0
          ? `Cleared ${clearedSyncs} sync(s), ${clearedPulls} pull(s)`
          : "No stuck syncs found");
      } else {
        setSyncResult(res.error || "Failed");
      }
    } catch { setSyncResult("Network error"); }
    finally { setSyncClearing(false); }
  };

  const toggleGroup = (title: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(title) ? next.delete(title) : next.add(title);
      return next;
    });
  };

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

      {/* Grouped Menu */}
      <div className="space-y-2">
        {MENU_GROUPS.map((group) => {
          const visibleItems = group.items.filter((item) => {
            if (!item.roles.includes(role)) return false;
            // For non-admin roles, also check saved permissions
            if (role !== "ADMIN" && item.featureKey && !canView(item.featureKey)) return false;
            return true;
          });
          if (visibleItems.length === 0) return null;
          const isExpanded = expandedGroups.has(group.title);

          return (
            <Card key={group.title}>
              <button
                onClick={() => toggleGroup(group.title)}
                className="w-full flex items-center justify-between px-4 py-3"
              >
                <span className="text-sm font-bold text-slate-800">{group.title}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400">{visibleItems.length}</span>
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  )}
                </div>
              </button>
              {isExpanded && (
                <div className="border-t border-slate-100">
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    if (item.comingSoon) {
                      return (
                        <div key={item.label} className="flex items-center gap-3 px-4 py-2.5 opacity-50 cursor-not-allowed">
                          <Icon className="h-4 w-4 text-slate-400" />
                          <span className="flex-1 text-sm text-slate-500">{item.label}</span>
                          <Badge variant="default">Soon</Badge>
                        </div>
                      );
                    }
                    return (
                      <Link key={item.href} href={item.href}>
                        <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors">
                          <Icon className="h-4 w-4 text-slate-500" />
                          <span className="flex-1 text-sm text-slate-700">{item.label}</span>
                          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Admin: Clear Stuck Syncs */}
      {role === "ADMIN" && (
        <div className="mt-4 px-4 py-3 bg-slate-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">Zoho Sync</p>
              <p className="text-xs text-slate-400">Clear stuck syncs if fetch shows &quot;already in progress&quot;</p>
            </div>
            <button onClick={handleClearSync} disabled={syncClearing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-xs font-medium hover:bg-amber-200 disabled:opacity-50">
              <RefreshCw className={`h-3.5 w-3.5 ${syncClearing ? "animate-spin" : ""}`} />
              {syncClearing ? "Clearing..." : "Clear & Reset"}
            </button>
          </div>
          {syncResult && (
            <p className="text-xs text-green-600 mt-1.5">{syncResult}</p>
          )}
        </div>
      )}

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
