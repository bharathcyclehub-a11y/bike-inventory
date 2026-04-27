"use client";

import { usePathname } from "next/navigation";
import { Bell, Search } from "lucide-react";
import Link from "next/link";

const BREADCRUMB_MAP: Record<string, string> = {
  "/desktop": "Dashboard",
  "/desktop/deliveries": "Deliveries",
  "/desktop/stock": "Stock",
  "/desktop/inbound": "Inbound Shipments",
  "/desktop/vendors": "Vendors",
  "/desktop/accounts": "Accounts",
  "/desktop/reports": "Reports",
  "/desktop/team": "Team",
  "/desktop/more": "Settings",
};

export function DesktopHeader() {
  const pathname = usePathname();

  // Build breadcrumb from path
  const segments = pathname.split("/").filter(Boolean);
  const crumbs: { label: string; href: string }[] = [];
  let path = "";
  for (const seg of segments) {
    path += `/${seg}`;
    const label = BREADCRUMB_MAP[path] || seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " ");
    crumbs.push({ label, href: path });
  }

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-6">
      <div className="flex items-center justify-between h-14">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm">
          {crumbs.map((crumb, i) => (
            <span key={crumb.href} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-slate-300">/</span>}
              {i === crumbs.length - 1 ? (
                <span className="font-semibold text-slate-900">{crumb.label}</span>
              ) : (
                <Link href={crumb.href} className="text-slate-500 hover:text-slate-700">
                  {crumb.label}
                </Link>
              )}
            </span>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <button className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors">
            <Search className="h-4.5 w-4.5" />
          </button>
          <button className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors relative">
            <Bell className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>
    </header>
  );
}
