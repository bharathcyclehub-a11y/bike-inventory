"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Package, ArrowDownCircle, ArrowUpCircle, AlertTriangle,
  IndianRupee, Brain,
} from "lucide-react";
import { DashboardCard } from "@/components/dashboard-card";
import { TransactionItem } from "@/components/transaction-item";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatINR, formatTime } from "@/lib/utils";
import type { Role } from "@/types";

interface DashboardData {
  totalProducts: number;
  totalStockValue: number;
  todayInwards: number;
  todayOutwards: number;
  lowStockCount: number;
  pendingAudits: number;
  recentTransactions: Array<{
    id: string; type: string; quantity: number; createdAt: string;
    referenceNo?: string; product: { name: string; sku: string };
  }>;
}

interface Insight { type: string; title: string; severity: string; value: number; }

function useDashboardData() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    const safeFetch = (url: string) => fetch(url).then((r) => r.ok ? r.json() : { success: false }).catch(() => ({ success: false }));

    Promise.all([
      safeFetch("/api/products?limit=1"),
      safeFetch(`/api/inventory/inwards?dateFrom=${today}&limit=50`),
      safeFetch(`/api/inventory/outwards?dateFrom=${today}&limit=50`),
      safeFetch("/api/ai/dashboard-insights"),
    ])
      .then(([productsRes, inwardsRes, outwardsRes, insightsRes]) => {
        const inwards = inwardsRes.success ? inwardsRes.data : [];
        const outwards = outwardsRes.success ? outwardsRes.data : [];
        const allRecent = [...inwards, ...outwards]
          .sort((a: { createdAt: string }, b: { createdAt: string }) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 5);

        const inwardQty = inwards.reduce((s: number, t: { quantity: number }) => s + t.quantity, 0);
        const outwardQty = outwards.reduce((s: number, t: { quantity: number }) => s + t.quantity, 0);

        const insightData = insightsRes.success ? insightsRes.data : [];
        const stockValueInsight = insightData.find((i: Insight) => i.type === "stock_value");
        const reorderInsight = insightData.find((i: Insight) => i.type === "reorder");

        setData({
          totalProducts: productsRes.success ? (productsRes.pagination?.total || 0) : 0,
          totalStockValue: stockValueInsight?.value || 0,
          todayInwards: inwardQty,
          todayOutwards: outwardQty,
          lowStockCount: reorderInsight?.value || 0,
          pendingAudits: 0,
          recentTransactions: allRecent,
        });

        setInsights(insightData.filter((i: Insight) => i.type !== "stock_value" && i.type !== "reorder"));
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return { data, insights, loading, error };
}

function AdminDashboard() {
  const { data, insights, loading, error } = useDashboardData();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="h-8 w-8 text-red-400 mx-auto mb-2" />
        <p className="text-sm text-slate-500">Failed to load dashboard. Pull down to retry.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <DashboardCard label="Stock Value" value={formatINR(data.totalStockValue)} icon={IndianRupee} color="bg-green-100 text-green-700" />
        <DashboardCard label="Total Products" value={data.totalProducts} icon={Package} color="bg-blue-100 text-blue-700" />
        <DashboardCard label="Inwards Today" value={data.todayInwards} icon={ArrowDownCircle} color="bg-blue-100 text-blue-600" />
        <DashboardCard label="Outwards Today" value={data.todayOutwards} icon={ArrowUpCircle} color="bg-orange-100 text-orange-600" />
        <DashboardCard label="Low Stock" value={data.lowStockCount} icon={AlertTriangle} color="bg-red-100 text-red-600" />
        <Link href="/ai">
          <DashboardCard label="AI Insights" value={insights.length} icon={Brain} color="bg-purple-100 text-purple-700" />
        </Link>
      </div>

      {/* AI Insight Cards */}
      {insights.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <Brain className="h-4 w-4 text-purple-600" />
              Smart Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {insights.slice(0, 4).map((item) => (
              <div key={item.type} className="flex items-center gap-2">
                <Badge variant={item.severity === "danger" ? "danger" : item.severity === "warning" ? "warning" : item.severity === "success" ? "success" : "info"} className="text-[9px] shrink-0">
                  {item.severity === "danger" ? "!" : item.severity === "warning" ? "~" : "i"}
                </Badge>
                <p className="text-xs text-slate-700">{item.title}</p>
              </div>
            ))}
            <Link href="/ai" className="text-xs text-blue-600 font-medium block pt-1">View all insights</Link>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      {data.recentTransactions.length > 0 && (
        <Card className="mt-4">
          <CardHeader><CardTitle>Recent Activity</CardTitle></CardHeader>
          <CardContent>
            {data.recentTransactions.map((t) => (
              <TransactionItem
                key={t.id}
                direction={t.type === "INWARD" ? "in" : "out"}
                productName={t.product?.name || "Unknown"}
                sku={t.product?.sku || ""}
                quantity={t.quantity}
                time={formatTime(t.createdAt)}
                reference={t.referenceNo}
              />
            ))}
          </CardContent>
        </Card>
      )}
    </>
  );
}

function ClerkDashboard({ type }: { type: "inward" | "outward" }) {
  const [transactions, setTransactions] = useState<Array<{ id: string; type: string; quantity: number; createdAt: string; referenceNo?: string; product: { name: string; sku: string } }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    const endpoint = type === "inward" ? "/api/inventory/inwards" : "/api/inventory/outwards";
    fetch(`${endpoint}?dateFrom=${today}&limit=50`)
      .then((r) => r.json())
      .then((res) => { if (res.success) setTransactions(res.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [type]);

  if (loading) {
    return <div className="flex items-center justify-center py-12"><div className="h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>;
  }

  const totalQty = transactions.reduce((s, t) => s + t.quantity, 0);
  const label = type === "inward" ? "Inwards" : "Outwards";
  const Icon = type === "inward" ? ArrowDownCircle : ArrowUpCircle;

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <DashboardCard label={`My ${label} Today`} value={totalQty} icon={Icon} trend={{ direction: "up", value: `${transactions.length} entries` }} color={type === "inward" ? "bg-blue-100 text-blue-600" : "bg-orange-100 text-orange-600"} />
        <DashboardCard label="Total Entries" value={transactions.length} icon={Package} color="bg-slate-100 text-slate-700" />
      </div>
      {transactions.length > 0 && (
        <Card className="mt-4">
          <CardHeader><CardTitle>Today&apos;s {label}</CardTitle></CardHeader>
          <CardContent>
            {transactions.map((t) => (
              <TransactionItem key={t.id} direction={type === "inward" ? "in" : "out"} productName={t.product?.name || "Unknown"} sku={t.product?.sku || ""} quantity={t.quantity} time={formatTime(t.createdAt)} reference={t.referenceNo} />
            ))}
          </CardContent>
        </Card>
      )}
    </>
  );
}

function ManagerDashboard() {
  const { data, loading, error } = useDashboardData();
  if (loading) {
    return <div className="flex items-center justify-center py-12"><div className="h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>;
  }
  if (error || !data) {
    return <div className="text-center py-12"><AlertTriangle className="h-8 w-8 text-red-400 mx-auto mb-2" /><p className="text-sm text-slate-500">Failed to load dashboard.</p></div>;
  }
  return (
    <div className="grid grid-cols-2 gap-3">
      <DashboardCard label="Total Products" value={data.totalProducts} icon={Package} color="bg-blue-100 text-blue-700" />
      <DashboardCard label="Low Stock" value={data.lowStockCount} icon={AlertTriangle} color="bg-red-100 text-red-600" />
      <DashboardCard label="Inwards Today" value={data.todayInwards} icon={ArrowDownCircle} color="bg-blue-100 text-blue-600" />
      <DashboardCard label="Outwards Today" value={data.todayOutwards} icon={ArrowUpCircle} color="bg-orange-100 text-orange-600" />
    </div>
  );
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const role = ((session?.user as { role?: string })?.role || "INWARDS_CLERK") as Role;
  const userName = session?.user?.name || "User";

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-lg font-bold text-slate-900">Hello, {userName}</h1>
        <p className="text-sm text-slate-500">
          {new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {(role === "ADMIN" || role === "SUPERVISOR") && <AdminDashboard />}
      {role === "MANAGER" && <ManagerDashboard />}
      {role === "INWARDS_CLERK" && <ClerkDashboard type="inward" />}
      {role === "OUTWARDS_CLERK" && <ClerkDashboard type="outward" />}
    </div>
  );
}
