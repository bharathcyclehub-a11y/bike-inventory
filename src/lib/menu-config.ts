// Single source of truth for the full app navigation catalog. Used by BOTH the
// mobile "More" page and the desktop sidebar so they can never drift. Every href
// here is a real (dashboard) route; items are filtered by role + permission at
// render time.
import {
  Settings,
  BarChart3,
  Warehouse,
  QrCode,
  Tag,
  ClipboardCheck,
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
  Clock,
  IndianRupee,
  Wrench,
  ClipboardList,
  Activity,
} from "lucide-react";
import { BIN_TRACKING_ENABLED } from "@/lib/inventory-config";
import type { Role } from "@/types";

export interface MenuItem {
  label: string;
  icon: typeof Building2;
  href: string;
  roles: Role[];
  featureKey?: string; // maps to permission system feature key
  comingSoon?: boolean;
}

export interface MenuGroup {
  title: string;
  items: MenuItem[];
}

export const MENU_GROUPS: MenuGroup[] = [
  {
    title: "Accounts",
    items: [
      { label: "Accounts Dashboard", icon: IndianRupee, href: "/accounts", roles: ["ADMIN", "SUPERVISOR", "ACCOUNTS_MANAGER", "STORE_MANAGER", "CUSTOM"], featureKey: "bills" },
      { label: "Bills & Payments", icon: FileText, href: "/bills", roles: ["ADMIN", "SUPERVISOR", "STORE_MANAGER", "CUSTOM"], featureKey: "bills" },
      { label: "Record Payment", icon: CreditCard, href: "/payments/new", roles: ["ADMIN", "SUPERVISOR", "STORE_MANAGER", "CUSTOM"], featureKey: "bills" },
      { label: "Receivables", icon: HandCoins, href: "/receivables", roles: ["ADMIN", "SUPERVISOR", "STORE_MANAGER", "CUSTOM"], featureKey: "customers" },
      { label: "Expenses", icon: Receipt, href: "/expenses", roles: ["ADMIN", "SUPERVISOR", "STORE_MANAGER", "CUSTOM"], featureKey: "expenses" },
    ],
  },
  {
    title: "Purchase",
    items: [
      { label: "Vendors", icon: Building2, href: "/vendors", roles: ["ADMIN", "SUPERVISOR", "PURCHASE_MANAGER", "CUSTOM"], featureKey: "vendors" },
      { label: "Purchase Orders", icon: ShoppingCart, href: "/purchase-orders", roles: ["ADMIN", "SUPERVISOR", "PURCHASE_MANAGER", "CUSTOM"], featureKey: "purchase_orders" },
      { label: "Brand Stock Upload", icon: FileText, href: "/brand-stock", roles: ["ADMIN", "SUPERVISOR", "PURCHASE_MANAGER", "CUSTOM"], featureKey: "purchase_orders" },
      { label: "Vendor Issues", icon: AlertCircle, href: "/vendor-issues", roles: ["ADMIN", "SUPERVISOR", "PURCHASE_MANAGER", "ACCOUNTS_MANAGER", "STORE_MANAGER", "SERVICE_MANAGER", "CUSTOM"], featureKey: "vendor_issues" },
      { label: "Inbound Tracking", icon: Truck, href: "/inbound", roles: ["ADMIN", "SUPERVISOR", "PURCHASE_MANAGER", "CUSTOM"], featureKey: "inbound" },
    ],
  },
  {
    title: "Operations",
    items: [
      { label: "Transfers", icon: ArrowRightLeft, href: "/transfers", roles: ["ADMIN", "SUPERVISOR", "CUSTOM"], featureKey: "transfers" },
      { label: "Stock Audit", icon: ClipboardCheck, href: "/stock-audit", roles: ["ADMIN", "SUPERVISOR", "PURCHASE_MANAGER", "ACCOUNTS_MANAGER", "INWARDS_EXECUTIVE", "OUTWARDS_EXECUTIVE", "CUSTOM"], featureKey: "stock_audit" },
      { label: "Barcode Scanner", icon: QrCode, href: "/scanner", roles: ["ADMIN", "SUPERVISOR", "PURCHASE_MANAGER", "INWARDS_EXECUTIVE", "OUTWARDS_EXECUTIVE", "CUSTOM"], featureKey: "barcode" },
      { label: "Label Designer", icon: Tag, href: "/more/label-designer", roles: ["ADMIN"], featureKey: "barcode" },
      { label: "Reorder Dashboard", icon: RefreshCw, href: "/reorder", roles: ["ADMIN", "PURCHASE_MANAGER", "CUSTOM"], featureKey: "reorder" },
      { label: "Outward", icon: Truck, href: "/deliveries", roles: ["ADMIN", "SUPERVISOR", "INWARDS_EXECUTIVE", "OUTWARDS_EXECUTIVE", "STORE_MANAGER", "SALES_MANAGER", "CUSTOM"], featureKey: "deliveries" },
      { label: "Second-Hand Cycles", icon: Bike, href: "/second-hand", roles: ["ADMIN", "SUPERVISOR", "OUTWARDS_EXECUTIVE", "ACCOUNTS_MANAGER", "SALES_MANAGER", "CUSTOM"], featureKey: "second_hand" },
    ],
  },
  {
    title: "Admin",
    items: [
      { label: "Activity Log", icon: ClipboardList, href: "/activity", roles: ["ADMIN", "SUPERVISOR", "OUTWARDS_EXECUTIVE", "INWARDS_EXECUTIVE", "PURCHASE_MANAGER", "ACCOUNTS_MANAGER", "STORE_MANAGER", "SALES_MANAGER", "SERVICE_MANAGER", "CUSTOM"] },
      { label: "Team Management", icon: Users, href: "/team", roles: ["ADMIN", "SUPERVISOR", "STORE_MANAGER", "CUSTOM"], featureKey: "team" },
      { label: "Reports", icon: BarChart3, href: "/reports", roles: ["ADMIN", "SUPERVISOR", "STORE_MANAGER", "SALES_MANAGER", "CUSTOM"], featureKey: "reports" },
      { label: "Service Revenue", icon: Wrench, href: "/service-revenue", roles: ["ADMIN", "SERVICE_MANAGER"] },
      { label: "AI Insights", icon: Brain, href: "/ai", roles: ["ADMIN", "SUPERVISOR", "PURCHASE_MANAGER", "CUSTOM"], featureKey: "reorder" },
      ...(BIN_TRACKING_ENABLED ? [{ label: "Bins & Locations", icon: Warehouse, href: "/more/bins", roles: ["ADMIN"] }] as MenuItem[] : []),
      { label: "Brand Management", icon: Settings, href: "/more/brands", roles: ["ADMIN"] },
      { label: "Brand Lead Times", icon: Clock, href: "/more/brand-lead-times", roles: ["ADMIN"] },
      { label: "Price Correction", icon: IndianRupee, href: "/price-correction", roles: ["ADMIN"] },
      { label: "WhatsApp Templates", icon: MessageSquare, href: "/more/whatsapp-templates", roles: ["ADMIN"], featureKey: "whatsapp_templates" },
      { label: "Alert Config", icon: Bell, href: "/more/alerts", roles: ["ADMIN"] },
      { label: "Zoho Books Sync", icon: Cloud, href: "/more/zoho", roles: ["ADMIN"], featureKey: "zoho" },
      { label: "App Logic", icon: Activity, href: "/more/app-logic", roles: ["ADMIN"] },
      { label: "App Problems", icon: AlertCircle, href: "/more/problems", roles: ["ADMIN", "SUPERVISOR", "PURCHASE_MANAGER", "ACCOUNTS_MANAGER", "INWARDS_EXECUTIVE", "OUTWARDS_EXECUTIVE", "STORE_MANAGER", "SALES_MANAGER", "SERVICE_MANAGER", "CUSTOM"] },
    ],
  },
];

// Convenience: should a menu item be shown for this role + permission set?
export function canSeeMenuItem(
  item: MenuItem,
  role: Role,
  canView: (feature: string) => boolean
): boolean {
  if (!item.roles.includes(role)) return false;
  if (item.featureKey && !canView(item.featureKey)) return false;
  return true;
}
