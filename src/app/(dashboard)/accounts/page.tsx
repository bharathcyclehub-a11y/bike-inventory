"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Building2,
  FileText,
  AlertTriangle,
  CreditCard,
  IndianRupee,
  Receipt,
  ShoppingCart,
  ChevronRight,
  TrendingDown,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface AccountsSummary {
  stats: {
    totalVendors: number;
    activeVendors: number;
    pendingBills: number;
    overdueBills: number;
    outstandingPayable: number;
    totalPaid30d: number;
    totalExpenses30d: number;
    pendingPOs: number;
  };
  recentPayments: Array<{
    id: string;
    amount: number;
    paymentDate: string;
    vendor: { name: string };
    bill?: { billNo: string } | null;
  }>;
  overdueBillsList: Array<{
    id: string;
    billNo: string;
    amount: number;
    paidAmount: number;
    dueDate: string;
    vendor: { name: string };
  }>;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}

export default function AccountsPage() {
  const [data, setData] = useState<AccountsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/accounts/summary")
      .then((r) => r.json())
      .then((res) => { if (res.success) setData(res.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const s = data?.stats;

  const quickLinks = [
    { label: "Vendors", href: "/vendors", icon: Building2, count: s?.activeVendors },
    { label: "Purchase Orders", href: "/purchase-orders", icon: ShoppingCart, count: s?.pendingPOs },
    { label: "Bills", href: "/bills", icon: FileText, count: s?.pendingBills },
    { label: "Expenses", href: "/expenses", icon: Receipt },
  ];

  return (
    <div>
      <h1 className="text-lg font-bold text-slate-900 mb-3">Accounts</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <IndianRupee className="h-4 w-4 text-red-600" />
              <span className="text-xs text-red-600 font-medium">Outstanding</span>
            </div>
            <p className="text-lg font-bold text-red-700">
              {formatCurrency(s?.outstandingPayable || 0)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span className="text-xs text-amber-600 font-medium">Overdue</span>
            </div>
            <p className="text-lg font-bold text-amber-700">
              {s?.overdueBills || 0} bills
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="h-4 w-4 text-green-600" />
              <span className="text-xs text-slate-500 font-medium">Paid (30d)</span>
            </div>
            <p className="text-lg font-bold text-green-700">
              {formatCurrency(s?.totalPaid30d || 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="h-4 w-4 text-slate-500" />
              <span className="text-xs text-slate-500 font-medium">Expenses (30d)</span>
            </div>
            <p className="text-lg font-bold text-slate-700">
              {formatCurrency(s?.totalExpenses30d || 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="space-y-1 mb-4">
        {quickLinks.map((link) => {
          const Icon = link.icon;
          return (
            <Link key={link.href} href={link.href}>
              <div className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-slate-50 transition-colors">
                <Icon className="h-5 w-5 text-slate-500" />
                <span className="flex-1 text-sm font-medium text-slate-700">{link.label}</span>
                {link.count !== undefined && (
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{link.count}</span>
                )}
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </div>
            </Link>
          );
        })}
        <Link href="/payments/new">
          <div className="flex items-center gap-3 px-3 py-3 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors">
            <CreditCard className="h-5 w-5 text-blue-600" />
            <span className="flex-1 text-sm font-semibold text-blue-700">Record Payment</span>
            <ChevronRight className="h-4 w-4 text-blue-400" />
          </div>
        </Link>
      </div>

      {/* Overdue Bills */}
      {data?.overdueBillsList && data.overdueBillsList.length > 0 && (
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-slate-900 mb-2">Overdue Bills</h2>
          <div className="space-y-2">
            {data.overdueBillsList.map((bill) => (
              <Link key={bill.id} href={`/bills/${bill.id}`}>
                <Card className="border-red-200 hover:border-red-300 mb-2">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{bill.vendor.name}</p>
                        <p className="text-xs text-slate-500">{bill.billNo} | Due: {new Date(bill.dueDate).toLocaleDateString("en-IN")}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-red-600">
                          {formatCurrency(bill.amount - bill.paidAmount)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent Payments */}
      {data?.recentPayments && data.recentPayments.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-900 mb-2">Recent Payments</h2>
          <div className="space-y-2">
            {data.recentPayments.map((payment) => (
              <Card key={payment.id} className="mb-2">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{payment.vendor.name}</p>
                      <p className="text-xs text-slate-500">
                        {payment.bill?.billNo || "Advance"} | {new Date(payment.paymentDate).toLocaleDateString("en-IN")}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-green-600">{formatCurrency(payment.amount)}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
