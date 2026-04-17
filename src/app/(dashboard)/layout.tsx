"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { Header } from "@/components/header";
import { BottomNav } from "@/components/bottom-nav";
import type { Role } from "@/types";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();

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

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 pb-nav">
        <div className="max-w-lg mx-auto px-4 py-4">{children}</div>
      </main>
      <BottomNav role={role} />
    </div>
  );
}
