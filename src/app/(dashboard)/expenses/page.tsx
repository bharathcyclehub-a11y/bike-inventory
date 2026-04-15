"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Plus, Receipt, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ExpenseItem {
  id: string;
  date: string;
  amount: number;
  category: string;
  description: string;
  paidBy: string;
  paymentMode: string;
  recordedBy: { name: string };
}

const CATEGORY_FILTERS = ["ALL", "DELIVERY", "TRANSPORT", "SHOP_MAINTENANCE", "UTILITIES", "SALARY_ADVANCE", "FOOD_TEA", "STATIONERY", "MISCELLANEOUS"];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}

const CATEGORY_COLORS: Record<string, string> = {
  DELIVERY: "bg-blue-100 text-blue-700",
  TRANSPORT: "bg-purple-100 text-purple-700",
  SHOP_MAINTENANCE: "bg-orange-100 text-orange-700",
  UTILITIES: "bg-cyan-100 text-cyan-700",
  SALARY_ADVANCE: "bg-pink-100 text-pink-700",
  FOOD_TEA: "bg-amber-100 text-amber-700",
  STATIONERY: "bg-indigo-100 text-indigo-700",
  MISCELLANEOUS: "bg-slate-100 text-slate-700",
};

export default function ExpensesPage() {
  const { data: session, status: sessionStatus } = useSession();
  const role = (session?.user as { role?: string })?.role || "";
  const canAccess = ["ADMIN", "SUPERVISOR", "MANAGER"].includes(role);

  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [totalAmount, setTotalAmount] = useState(0);
  const [searchText, setSearchText] = useState("");

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "50" });
    if (filter !== "ALL") params.set("category", filter);

    fetch(`/api/expenses?${params}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setExpenses(res.data);
          setTotalAmount(res.data.reduce((sum: number, e: ExpenseItem) => sum + e.amount, 0));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filter]);

  if (sessionStatus === "loading") {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="text-center py-12">
        <p className="text-sm font-medium text-red-600">Access Denied</p>
        <p className="text-xs text-slate-500 mt-1">You do not have permission to view expenses.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-bold text-slate-900">Expenses</h1>
        <Link href="/expenses/new">
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </Link>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search description, paid by..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Total */}
      {expenses.length > 0 && (
        <Card className="bg-slate-50 mb-3">
          <CardContent className="p-3 flex items-center justify-between">
            <span className="text-sm text-slate-500">Total shown</span>
            <span className="text-lg font-bold text-slate-900">{formatCurrency(totalAmount)}</span>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-4 pb-1">
        {CATEGORY_FILTERS.map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === c ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {c === "ALL" ? "All" : c.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {expenses.filter((exp) => {
            if (!searchText) return true;
            const q = searchText.toLowerCase();
            return exp.description.toLowerCase().includes(q) || exp.paidBy.toLowerCase().includes(q);
          }).map((exp) => (
            <Card key={exp.id} className="mb-2">
              <CardContent className="p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="text-sm font-medium text-slate-900">{exp.description}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {new Date(exp.date).toLocaleDateString("en-IN")} | {exp.paidBy} | {exp.paymentMode}
                    </p>
                    <span className={`inline-block mt-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${CATEGORY_COLORS[exp.category] || "bg-slate-100 text-slate-700"}`}>
                      {exp.category.replace(/_/g, " ")}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-slate-900 shrink-0">{formatCurrency(exp.amount)}</p>
                </div>
              </CardContent>
            </Card>
          ))}

          {expenses.length === 0 && (
            <div className="text-center py-12">
              <Receipt className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No expenses found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
