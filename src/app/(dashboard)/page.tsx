"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Package, ArrowDownCircle, ArrowUpCircle, AlertTriangle,
  IndianRupee, Brain, Truck, Clock, CheckCircle2, Flag,
  Users, ShieldAlert,
} from "lucide-react";
import { DashboardCard } from "@/components/dashboard-card";
import { TransactionItem } from "@/components/transaction-item";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatINR, formatTime } from "@/lib/utils";
import type { Role } from "@/types";

interface CEOData {
  // Revenue & Finance
  outstandingPayable: number;
  outstandingReceivable: number;
  overdueBills: number;
  totalStockValue: number;
  // Operations
  totalProducts: number;
  lowStockCount: number;
  todayInwards: number;
  todayOutwards: number;
  // Service
  openTickets: number;
  // Lists
  overdueBillsList: Array<{ id: string; billNo: string; amount: number; paidAmount: number; dueDate: string; vendor: { name: string } }>;
  insights: Array<{ type: string; title: string; severity: string; value: number }>;
  // Health
  people: Array<{ name: string; role: string; pending: number; overdue24h: number; overdue48h: number; overdue72h: number }>;
  todaySummary: { inwardsVerified: number; inwardsPending: number; deliveriesClosed: number; deliveriesPending: number; expensesRecorded: number; posWithoutTracking: number; openServiceTickets: number };
  criticalAlerts: Array<{ type: string; message: string; owner: string; count: number }>;
}

function AdminDashboard() {
  const [data, setData] = useState<CEOData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    const safeFetch = (url: string) => fetch(url).then((r) => r.ok ? r.json() : { success: false }).catch(() => ({ success: false }));

    Promise.all([
      safeFetch("/api/accounts/summary"),
      safeFetch("/api/ai/dashboard-insights"),
      safeFetch(`/api/inventory/inwards?dateFrom=${today}&limit=1`),
      safeFetch(`/api/inventory/outwards?dateFrom=${today}&limit=1`),
      safeFetch("/api/service-tickets/stats"),
      safeFetch("/api/health/summary"),
    ])
      .then(([accountsRes, insightsRes, inwardsRes, outwardsRes, ticketsRes, healthRes]) => {
        const acct = accountsRes.success ? accountsRes.data : null;
        const insightData = insightsRes.success ? insightsRes.data : [];
        const stockValueInsight = insightData.find((i: { type: string }) => i.type === "stock_value");
        const reorderInsight = insightData.find((i: { type: string }) => i.type === "reorder");

        setData({
          outstandingPayable: acct?.stats?.outstandingPayable || 0,
          outstandingReceivable: acct?.stats?.outstandingReceivable || 0,
          overdueBills: acct?.stats?.overdueBills || 0,
          totalStockValue: stockValueInsight?.value || 0,
          totalProducts: inwardsRes.success ? (inwardsRes.pagination?.total || 0) : 0,
          lowStockCount: reorderInsight?.value || 0,
          todayInwards: inwardsRes.success ? (inwardsRes.pagination?.total || 0) : 0,
          todayOutwards: outwardsRes.success ? (outwardsRes.pagination?.total || 0) : 0,
          openTickets: ticketsRes.success ? (ticketsRes.data?.totalOpen || 0) : 0,
          overdueBillsList: acct?.overdueBillsList || [],
          insights: insightData.filter((i: { type: string }) => i.type !== "stock_value" && i.type !== "reorder"),
          people: healthRes.success ? (healthRes.data?.people || []) : [],
          todaySummary: healthRes.success ? (healthRes.data?.today || {}) : {},
          criticalAlerts: healthRes.success ? (healthRes.data?.criticalAlerts || []) : [],
        });
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="p-3 border border-slate-100 rounded-lg space-y-2">
              <div className="h-3 bg-slate-200 rounded w-16" />
              <div className="h-6 bg-slate-200 rounded w-20" />
            </div>
          ))}
        </div>
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
      {/* Financial Overview — Top Priority */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/accounts">
          <Card className="bg-red-50 border-red-200">
            <CardContent className="p-3">
              <p className="text-[10px] text-red-600 font-medium uppercase tracking-wide">Payable</p>
              <p className="text-lg font-bold text-red-700">{formatINR(data.outstandingPayable)}</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/receivables">
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-3">
              <p className="text-[10px] text-blue-600 font-medium uppercase tracking-wide">Receivable</p>
              <p className="text-lg font-bold text-blue-700">{formatINR(data.outstandingReceivable)}</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/stock">
          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-3">
              <p className="text-[10px] text-green-600 font-medium uppercase tracking-wide">Stock Value</p>
              <p className="text-lg font-bold text-green-700">{formatINR(data.totalStockValue)}</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/bills">
          <Card className={data.overdueBills > 0 ? "bg-amber-50 border-amber-300" : ""}>
            <CardContent className="p-3">
              <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Overdue Bills</p>
              <p className={`text-lg font-bold ${data.overdueBills > 0 ? "text-amber-600" : "text-green-600"}`}>
                {data.overdueBills > 0 ? data.overdueBills : "None"}
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Operations + Service Row */}
      <div className="grid grid-cols-3 gap-2 mt-3">
        <Link href="/reorder">
          <Card>
            <CardContent className="p-2.5 text-center">
              <AlertTriangle className="h-4 w-4 text-red-500 mx-auto mb-0.5" />
              <p className="text-base font-bold text-slate-900">{data.lowStockCount}</p>
              <p className="text-[9px] text-slate-500">Low Stock</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/service">
          <Card className={data.openTickets > 0 ? "border-orange-200" : ""}>
            <CardContent className="p-2.5 text-center">
              <Flag className="h-4 w-4 text-orange-500 mx-auto mb-0.5" />
              <p className="text-base font-bold text-slate-900">{data.openTickets}</p>
              <p className="text-[9px] text-slate-500">Open Tickets</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/ai">
          <Card>
            <CardContent className="p-2.5 text-center">
              <Brain className="h-4 w-4 text-purple-500 mx-auto mb-0.5" />
              <p className="text-base font-bold text-slate-900">{data.insights.length}</p>
              <p className="text-[9px] text-slate-500">AI Insights</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Daily Pulse */}
      <div className="flex gap-3 mt-3">
        <Card className="flex-1">
          <CardContent className="p-3 text-center">
            <ArrowDownCircle className="h-4 w-4 text-blue-500 mx-auto mb-1" />
            <p className="text-lg font-bold text-slate-900">{data.todayInwards}</p>
            <p className="text-[10px] text-slate-500">Inwards Today</p>
          </CardContent>
        </Card>
        <Card className="flex-1">
          <CardContent className="p-3 text-center">
            <ArrowUpCircle className="h-4 w-4 text-orange-500 mx-auto mb-1" />
            <p className="text-lg font-bold text-slate-900">{data.todayOutwards}</p>
            <p className="text-[10px] text-slate-500">Outwards Today</p>
          </CardContent>
        </Card>
      </div>

      {/* Smart Insights */}
      {data.insights.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <Brain className="h-4 w-4 text-purple-600" />
              Smart Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.insights.slice(0, 4).map((item) => (
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

      {/* Critical Alerts — 72h+ overdue, needs CEO attention */}
      {data.criticalAlerts.length > 0 && (
        <Card className="mt-4 border-red-300 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5 text-red-700">
              <ShieldAlert className="h-4 w-4" />
              Critical Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.criticalAlerts.map((alert, i) => (
              <div key={i} className="flex items-center justify-between py-1.5">
                <p className="text-xs text-red-700 font-medium">{alert.message}</p>
                <Badge variant="danger" className="text-[9px] animate-pulse">{alert.owner}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Team Health — Per-person accountability */}
      {data.people.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <Users className="h-4 w-4 text-slate-600" />
              Team Health
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.people.map((person) => (
              <div key={person.name} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
                <div>
                  <p className="text-sm font-medium text-slate-900">{person.name}</p>
                  <p className="text-[10px] text-slate-500">{person.role}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  {person.overdue72h > 0 && (
                    <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-red-200 text-red-900 animate-pulse">
                      {person.overdue72h} 72h+
                    </span>
                  )}
                  {person.overdue48h > person.overdue72h && (
                    <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-red-100 text-red-800">
                      {person.overdue48h - person.overdue72h} 48h+
                    </span>
                  )}
                  {person.overdue24h > person.overdue48h && (
                    <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-800">
                      {person.overdue24h - person.overdue48h} 24h+
                    </span>
                  )}
                  <span className="text-xs font-bold text-slate-700">{person.pending}</span>
                  <span className="text-[10px] text-slate-400">pending</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Today's Summary */}
      {data.todaySummary && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-slate-600" />
              Today&apos;s Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Inwards verified</span>
                <span className="font-medium text-green-600">{data.todaySummary.inwardsVerified || 0}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Inwards pending</span>
                <span className={`font-medium ${(data.todaySummary.inwardsPending || 0) > 0 ? "text-amber-600" : "text-green-600"}`}>{data.todaySummary.inwardsPending || 0}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Deliveries closed</span>
                <span className="font-medium text-green-600">{data.todaySummary.deliveriesClosed || 0}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Deliveries pending</span>
                <span className={`font-medium ${(data.todaySummary.deliveriesPending || 0) > 0 ? "text-amber-600" : "text-green-600"}`}>{data.todaySummary.deliveriesPending || 0}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Expenses today</span>
                <span className="font-medium">{data.todaySummary.expensesRecorded || 0}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">POs no tracking</span>
                <span className={`font-medium ${(data.todaySummary.posWithoutTracking || 0) > 0 ? "text-red-600" : "text-green-600"}`}>{data.todaySummary.posWithoutTracking || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overdue Bills */}
      {data.overdueBillsList.length > 0 && (
        <Card className="mt-4">
          <CardHeader><CardTitle className="text-red-600">Overdue Bills</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.overdueBillsList.slice(0, 5).map((bill) => (
              <Link key={bill.id} href={`/bills/${bill.id}`}>
                <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{bill.vendor.name}</p>
                    <p className="text-xs text-slate-500">{bill.billNo} | Due: {new Date(bill.dueDate).toLocaleDateString("en-IN")}</p>
                  </div>
                  <p className="text-sm font-bold text-red-600">{formatINR(bill.amount - bill.paidAmount)}</p>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </>
  );
}

interface SupervisorData {
  outstandingPayable: number;
  outstandingReceivable: number;
  overdueBills: number;
  openIssues: number;
  todayInwards: number;
  todayOutwards: number;
  overdueBillsList: Array<{ id: string; billNo: string; amount: number; paidAmount: number; dueDate: string; vendor: { name: string } }>;
}

function SupervisorDashboard() {
  const [data, setData] = useState<SupervisorData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    const safeFetch = (url: string) => fetch(url).then((r) => r.ok ? r.json() : { success: false }).catch(() => ({ success: false }));

    Promise.all([
      safeFetch("/api/accounts/summary"),
      safeFetch(`/api/inventory/inwards?dateFrom=${today}&limit=50`),
      safeFetch(`/api/inventory/outwards?dateFrom=${today}&limit=50`),
      safeFetch("/api/customer-invoices?status=PENDING&limit=500"),
      safeFetch("/api/vendor-issues?status=OPEN&limit=1"),
    ])
      .then(([accountsRes, inwardsRes, outwardsRes, receivablesRes, issuesRes]) => {
        const acct = accountsRes.success ? accountsRes.data : null;
        const inwards = inwardsRes.success ? inwardsRes.data : [];
        const outwards = outwardsRes.success ? outwardsRes.data : [];
        const inwardQty = inwards.reduce((s: number, t: { quantity: number }) => s + t.quantity, 0);
        const outwardQty = outwards.reduce((s: number, t: { quantity: number }) => s + t.quantity, 0);

        // Calculate total receivable from pending invoices
        const invoices = receivablesRes.success ? receivablesRes.data : [];
        const totalReceivable = invoices.reduce((s: number, inv: { amount: number; paidAmount: number }) => s + (inv.amount - inv.paidAmount), 0);

        setData({
          outstandingPayable: acct?.stats?.outstandingPayable || 0,
          outstandingReceivable: totalReceivable,
          overdueBills: acct?.stats?.overdueBills || 0,
          openIssues: issuesRes.success ? (issuesRes.pagination?.total || 0) : 0,
          todayInwards: inwardQty,
          todayOutwards: outwardQty,
          overdueBillsList: acct?.overdueBillsList || [],
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-3 border border-slate-100 rounded-lg space-y-2">
              <div className="h-3 bg-slate-200 rounded w-16" />
              <div className="h-6 bg-slate-200 rounded w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="h-8 w-8 text-red-400 mx-auto mb-2" />
        <p className="text-sm text-slate-500">Failed to load dashboard.</p>
      </div>
    );
  }

  return (
    <>
      {/* Top Cards — Srinu's priorities */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/accounts">
          <Card className="bg-red-50 border-red-200">
            <CardContent className="p-3">
              <p className="text-[10px] text-red-600 font-medium">Outstanding Payable</p>
              <p className="text-lg font-bold text-red-700">{formatINR(data.outstandingPayable)}</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/receivables">
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-3">
              <p className="text-[10px] text-blue-600 font-medium">Outstanding Receivable</p>
              <p className="text-lg font-bold text-blue-700">{formatINR(data.outstandingReceivable)}</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/bills">
          <Card className={data.overdueBills > 0 ? "bg-red-50 border-red-300" : ""}>
            <CardContent className="p-3">
              <p className="text-[10px] text-slate-500 font-medium">Overdue Bills</p>
              <p className={`text-lg font-bold ${data.overdueBills > 0 ? "text-red-600" : "text-green-600"}`}>
                {data.overdueBills > 0 ? data.overdueBills : "None"}
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/vendor-issues">
          <Card className={data.openIssues > 0 ? "bg-orange-50 border-orange-200" : ""}>
            <CardContent className="p-3">
              <p className="text-[10px] text-slate-500 font-medium">Open Issues</p>
              <p className={`text-lg font-bold ${data.openIssues > 0 ? "text-orange-600" : "text-green-600"}`}>
                {data.openIssues > 0 ? data.openIssues : "None"}
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Daily Pulse */}
      <div className="flex gap-3 mt-3">
        <Card className="flex-1">
          <CardContent className="p-3 text-center">
            <ArrowDownCircle className="h-4 w-4 text-blue-500 mx-auto mb-1" />
            <p className="text-lg font-bold text-slate-900">{data.todayInwards}</p>
            <p className="text-[10px] text-slate-500">Inwards Today</p>
          </CardContent>
        </Card>
        <Card className="flex-1">
          <CardContent className="p-3 text-center">
            <ArrowUpCircle className="h-4 w-4 text-orange-500 mx-auto mb-1" />
            <p className="text-lg font-bold text-slate-900">{data.todayOutwards}</p>
            <p className="text-[10px] text-slate-500">Outwards Today</p>
          </CardContent>
        </Card>
      </div>

      {/* Overdue Bills */}
      {data.overdueBillsList.length > 0 && (
        <Card className="mt-4">
          <CardHeader><CardTitle className="text-red-600">Overdue Bills</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.overdueBillsList.slice(0, 5).map((bill) => (
              <Link key={bill.id} href={`/bills/${bill.id}`}>
                <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{bill.vendor.name}</p>
                    <p className="text-xs text-slate-500">{bill.billNo} | Due: {new Date(bill.dueDate).toLocaleDateString("en-IN")}</p>
                  </div>
                  <p className="text-sm font-bold text-red-600">{formatINR(bill.amount - bill.paidAmount)}</p>
                </div>
              </Link>
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
    return <div className="animate-pulse space-y-3 py-4">{[1,2,3].map(i=><div key={i} className="flex items-center gap-3 py-2 border-b border-slate-100"><div className="h-9 w-9 rounded-full bg-slate-200 shrink-0"/><div className="flex-1 space-y-1.5"><div className="h-4 bg-slate-200 rounded w-2/3"/><div className="h-3 bg-slate-200 rounded w-1/3"/></div></div>)}</div>;
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

function OutwardsClerkDashboard() {
  const [stats, setStats] = useState<{ pending: number; verified: number; scheduled: number; outForDelivery: number; deliveredToday: number; flagged: number; prebooked: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/deliveries/stats")
      .then((r) => r.json())
      .then((res) => { if (res.success) setStats(res.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="animate-pulse space-y-3 py-4"><div className="grid grid-cols-2 gap-3">{[1,2,3,4].map(i=><div key={i} className="p-3 border border-slate-100 rounded-lg space-y-2"><div className="h-3 bg-slate-200 rounded w-16"/><div className="h-6 bg-slate-200 rounded w-20"/></div>)}</div></div>;
  }
  if (!stats) {
    return <div className="text-center py-12"><AlertTriangle className="h-8 w-8 text-red-400 mx-auto mb-2" /><p className="text-sm text-slate-500">Failed to load dashboard.</p></div>;
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Link href="/deliveries">
          <DashboardCard label="Pending Verify" value={stats.pending} icon={Clock} color="bg-amber-100 text-amber-700" />
        </Link>
        <Link href="/deliveries">
          <DashboardCard label="Scheduled" value={stats.scheduled} icon={Truck} color="bg-blue-100 text-blue-700" />
        </Link>
        <Link href="/deliveries/dispatch">
          <DashboardCard label="Out for Delivery" value={stats.outForDelivery} icon={Truck} color="bg-orange-100 text-orange-700" />
        </Link>
        <Link href="/deliveries">
          <DashboardCard label="Delivered Today" value={stats.deliveredToday} icon={CheckCircle2} color="bg-green-100 text-green-700" />
        </Link>
        {stats.flagged > 0 && (
          <Link href="/deliveries">
            <DashboardCard label="Flagged" value={stats.flagged} icon={Flag} color="bg-red-100 text-red-700" />
          </Link>
        )}
        {stats.prebooked > 0 && (
          <Link href="/deliveries">
            <DashboardCard label="Prebooked" value={stats.prebooked} icon={Package} color="bg-purple-100 text-purple-700" />
          </Link>
        )}
      </div>
    </>
  );
}

function PurchaseManagerDashboard() {
  const [stats, setStats] = useState<{ totalProducts: number; lowStock: number; todayInwards: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    const safeFetch = (url: string) => fetch(url).then((r) => r.ok ? r.json() : { success: false }).catch(() => ({ success: false }));
    Promise.all([
      safeFetch("/api/products?limit=1&status=ACTIVE"),
      safeFetch("/api/ai/dashboard-insights"),
      safeFetch(`/api/inventory/inwards?dateFrom=${today}&limit=1`),
    ]).then(([prodRes, insightsRes, inwardsRes]) => {
      const insightData = insightsRes.success ? insightsRes.data : [];
      const reorderInsight = insightData.find((i: { type: string }) => i.type === "reorder");
      setStats({
        totalProducts: prodRes.success ? (prodRes.pagination?.total || 0) : 0,
        lowStock: reorderInsight?.value || 0,
        todayInwards: inwardsRes.success ? (inwardsRes.pagination?.total || 0) : 0,
      });
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="animate-pulse space-y-3 py-4"><div className="grid grid-cols-2 gap-3">{[1,2,3,4].map(i=><div key={i} className="p-3 border border-slate-100 rounded-lg space-y-2"><div className="h-3 bg-slate-200 rounded w-16"/><div className="h-6 bg-slate-200 rounded w-20"/></div>)}</div></div>;
  }
  if (!stats) {
    return <div className="text-center py-12"><AlertTriangle className="h-8 w-8 text-red-400 mx-auto mb-2" /><p className="text-sm text-slate-500">Failed to load dashboard.</p></div>;
  }
  return (
    <div className="grid grid-cols-2 gap-3">
      <DashboardCard label="Total Products" value={stats.totalProducts} icon={Package} color="bg-blue-100 text-blue-700" />
      <Link href="/reorder"><DashboardCard label="Low Stock" value={stats.lowStock} icon={AlertTriangle} color="bg-red-100 text-red-600" /></Link>
      <DashboardCard label="Inwards Today" value={stats.todayInwards} icon={ArrowDownCircle} color="bg-blue-100 text-blue-600" />
      <Link href="/purchase-orders"><DashboardCard label="Pending POs" value="—" icon={Package} color="bg-orange-100 text-orange-600" /></Link>
    </div>
  );
}

function AccountsManagerDashboard() {
  const [stats, setStats] = useState<{ expenses30d: number; payable: number; overdueBills: number; pendingAudits: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const safeFetch = (url: string) => fetch(url).then((r) => r.ok ? r.json() : { success: false }).catch(() => ({ success: false }));
    Promise.all([
      safeFetch("/api/accounts/summary"),
      safeFetch("/api/stock-counts?status=PENDING&limit=1"),
    ])
      .then(([accountsRes, auditsRes]) => {
        const acct = accountsRes.success ? accountsRes.data : null;
        setStats({
          expenses30d: acct?.stats?.totalExpenses30d || 0,
          payable: acct?.stats?.outstandingPayable || 0,
          overdueBills: acct?.stats?.overdueBills || 0,
          pendingAudits: auditsRes.success ? (auditsRes.pagination?.total || 0) : 0,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="animate-pulse space-y-3 py-4">{[1,2,3].map(i=><div key={i} className="flex items-center gap-3 py-2 border-b border-slate-100"><div className="h-9 w-9 rounded-full bg-slate-200 shrink-0"/><div className="flex-1 space-y-1.5"><div className="h-4 bg-slate-200 rounded w-2/3"/><div className="h-3 bg-slate-200 rounded w-1/3"/></div></div>)}</div>;
  }
  if (!stats) {
    return <div className="text-center py-12"><AlertTriangle className="h-8 w-8 text-red-400 mx-auto mb-2" /><p className="text-sm text-slate-500">Failed to load dashboard.</p></div>;
  }
  return (
    <div className="grid grid-cols-2 gap-3">
      <Link href="/expenses"><DashboardCard label="Expenses (30d)" value={formatINR(stats.expenses30d)} icon={IndianRupee} color="bg-green-100 text-green-700" /></Link>
      <Link href="/accounts"><DashboardCard label="Outstanding Payable" value={formatINR(stats.payable)} icon={IndianRupee} color="bg-red-100 text-red-600" /></Link>
      <Link href="/bills"><DashboardCard label="Overdue Bills" value={stats.overdueBills} icon={AlertTriangle} color="bg-amber-100 text-amber-600" /></Link>
      <Link href="/stock-audit"><DashboardCard label="Pending Audits" value={stats.pendingAudits} icon={Package} color="bg-blue-100 text-blue-700" /></Link>
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

      {role === "ADMIN" && <AdminDashboard />}
      {role === "SUPERVISOR" && <SupervisorDashboard />}
      {role === "PURCHASE_MANAGER" && <PurchaseManagerDashboard />}
      {role === "ACCOUNTS_MANAGER" && <AccountsManagerDashboard />}
      {role === "INWARDS_CLERK" && <ClerkDashboard type="inward" />}
      {role === "OUTWARDS_CLERK" && <OutwardsClerkDashboard />}
    </div>
  );
}
