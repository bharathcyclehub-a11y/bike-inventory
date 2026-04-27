"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bike, LogOut } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { getPrimaryTabs, getDesktopExtraTabs, desktopHref } from "@/lib/nav-config";
import type { Role } from "@/types";

interface SidebarProps {
  role: Role;
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const userName = session?.user?.name || "User";
  const initials = userName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  const primaryTabs = getPrimaryTabs(role);
  const extraTabs = getDesktopExtraTabs(role);

  // Filter out "More" from primary since desktop shows all pages
  const mainTabs = primaryTabs.filter((t) => t.key !== "more");
  // Filter out items already in mainTabs from extraTabs
  const mainKeys = new Set(mainTabs.map((t) => t.key));
  const secondaryTabs = extraTabs.filter((t) => !mainKeys.has(t.key) && t.key !== "settings");
  const settingsTab = extraTabs.find((t) => t.key === "settings");

  function isActive(href: string) {
    const dHref = desktopHref(href);
    if (dHref === "/desktop") return pathname === "/desktop";
    return pathname.startsWith(dHref);
  }

  return (
    <aside className="w-60 h-screen bg-white border-r border-slate-200 flex flex-col shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-slate-100">
        <div className="bg-slate-900 rounded-lg p-1.5">
          <Bike className="h-5 w-5 text-white" />
        </div>
        <span className="text-base font-bold text-slate-900">Bike Inventory</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-3">
        <div className="space-y-0.5">
          {mainTabs.map((tab) => {
            const active = isActive(tab.href);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.key}
                href={desktopHref(tab.href)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  active
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
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
                const active = isActive(tab.href);
                const Icon = tab.icon;
                return (
                  <Link
                    key={tab.key}
                    href={desktopHref(tab.href)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                      active
                        ? "bg-slate-900 text-white"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    )}
                  >
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
            <Link
              href={desktopHref(settingsTab.href)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive(settingsTab.href)
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              <settingsTab.icon className="h-4.5 w-4.5 shrink-0" />
              {settingsTab.label}
            </Link>
          </>
        )}
      </nav>

      {/* User */}
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
