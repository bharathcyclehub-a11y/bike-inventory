"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { Header } from "@/components/header";
import { BottomNav } from "@/components/bottom-nav";
import { X, ClipboardCheck } from "lucide-react";
import type { Role } from "@/types";

const BASELINE_START = new Date("2026-04-14T00:00:00+05:30");
const BASELINE_END = new Date("2026-04-19T23:59:59+05:30");

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const [bannerDismissed, setBannerDismissed] = useState(false);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    redirect("/login");
  }

  const userRole = (session?.user as { role?: string })?.role;
  if (!userRole) {
    redirect("/login");
  }

  const role = userRole as Role;
  const now = new Date();
  const isBaselinePeriod = now >= BASELINE_START && now <= BASELINE_END;
  const daysLeft = isBaselinePeriod ? Math.ceil((BASELINE_END.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0;

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      {isBaselinePeriod && !bannerDismissed && (
        <div className="bg-amber-50 border-b border-amber-200">
          <div className="max-w-lg mx-auto px-4 py-2.5 flex items-start gap-2.5">
            <ClipboardCheck className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-amber-800">Stock Count Baseline — {daysLeft} day{daysLeft !== 1 ? "s" : ""} left</p>
              <p className="text-[11px] text-amber-700 mt-0.5">
                All stock counts are treated as inwards until Apr 19. After that, inwards &amp; outwards will happen only via Zoho. The app becomes a verification gate.
              </p>
            </div>
            <button onClick={() => setBannerDismissed(true)} className="p-0.5 text-amber-500 hover:text-amber-700 shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      <main className="flex-1 pb-nav">
        <div className="max-w-lg mx-auto px-4 py-4">{children}</div>
      </main>
      <BottomNav role={role} />
    </div>
  );
}
