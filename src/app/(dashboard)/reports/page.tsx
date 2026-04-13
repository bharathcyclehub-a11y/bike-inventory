"use client";

import Link from "next/link";
import { Package, TrendingUp, ShoppingCart, Receipt, Calendar, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const reports = [
  {
    title: "Stock Value",
    description: "Total inventory value by category, brand, or type",
    href: "/reports/stock-value",
    icon: Package,
    color: "bg-blue-50 text-blue-600 border-blue-200",
    iconBg: "bg-blue-100",
  },
  {
    title: "Movement Analysis",
    description: "Fast, slow, and dead stock identification",
    href: "/reports/movement",
    icon: TrendingUp,
    color: "bg-green-50 text-green-600 border-green-200",
    iconBg: "bg-green-100",
  },
  {
    title: "Purchase Report",
    description: "Vendor-wise purchase summary",
    href: "/reports/purchase",
    icon: ShoppingCart,
    color: "bg-purple-50 text-purple-600 border-purple-200",
    iconBg: "bg-purple-100",
  },
  {
    title: "Expense Summary",
    description: "Category-wise expense breakdown",
    href: "/reports/expense-summary",
    icon: Receipt,
    color: "bg-orange-50 text-orange-600 border-orange-200",
    iconBg: "bg-orange-100",
  },
  {
    title: "Daily Activity",
    description: "Today's inwards, outwards, payments, expenses",
    href: "/reports/daily",
    icon: Calendar,
    color: "bg-slate-50 text-slate-600 border-slate-200",
    iconBg: "bg-slate-100",
  },
];

export default function ReportsPage() {
  return (
    <div>
      <h1 className="text-lg font-bold text-slate-900 mb-3">Reports</h1>

      <div className="grid grid-cols-1 gap-2">
        {reports.map((report) => {
          const Icon = report.icon;
          return (
            <Link key={report.href} href={report.href}>
              <Card className={`hover:shadow-md transition-shadow ${report.color}`}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-lg ${report.iconBg} flex items-center justify-center shrink-0`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{report.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{report.description}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
