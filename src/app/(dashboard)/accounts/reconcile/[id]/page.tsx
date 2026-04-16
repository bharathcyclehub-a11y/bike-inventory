"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import {
  ArrowLeft, CheckCircle2, AlertTriangle, XCircle, Building2,
  FileText, Loader2, Eye, EyeOff, CreditCard, Receipt,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface BankTxn {
  id: string;
  date: string;
  description: string;
  reference: string | null;
  amount: number;
  type: "CREDIT" | "DEBIT";
  balance: number | null;
  matchStatus: string;
  flagReason: string | null;
  suggestedCategory: string | null;
  confidence: number | null;
  suggestedVendor: { id: string; name: string } | null;
  suggestedBill: { id: string; billNo: string; amount: number; paidAmount: number } | null;
  confirmedVendorId: string | null;
  confirmedPaymentId: string | null;
  confirmedExpenseId: string | null;
  processedAt: string | null;
}

interface Statement {
  id: string;
  bank: string;
  fileName: string;
  fromDate: string | null;
  toDate: string | null;
  totalCredits: number;
  totalDebits: number;
  txnCount: number;
  matchedCount: number;
  flaggedCount: number;
  uploadedBy: { name: string };
  transactions: BankTxn[];
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

type FilterKey = "ALL" | "UNMATCHED" | "MATCHED" | "FLAGGED" | "EXPENSE" | "IGNORED";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "UNMATCHED", label: "Pending" },
  { key: "MATCHED", label: "Matched" },
  { key: "FLAGGED", label: "Flagged" },
  { key: "EXPENSE", label: "Expenses" },
  { key: "IGNORED", label: "Ignored" },
];

export default function ReconcilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [statement, setStatement] = useState<Statement | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("UNMATCHED");
  const [processing, setProcessing] = useState<string>("");

  const fetchData = () => {
    setLoading(true);
    fetch(`/api/bank-statements/${id}/review`)
      .then((r) => r.json())
      .then((res) => { if (res.success) setStatement(res.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [id]);

  const handleAction = async (txnId: string, action: string, extra?: Record<string, unknown>) => {
    setProcessing(txnId);
    try {
      const res = await fetch(`/api/bank-statements/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txnId, action, ...extra }),
      }).then(r => r.json());
      if (res.success) fetchData();
    } catch {} finally { setProcessing(""); }
  };

  const filtered = statement?.transactions.filter(
    (t) => filter === "ALL" || t.matchStatus === filter
  ) || [];

  const counts = {
    ALL: statement?.transactions.length || 0,
    UNMATCHED: statement?.transactions.filter(t => t.matchStatus === "UNMATCHED").length || 0,
    MATCHED: statement?.transactions.filter(t => t.matchStatus === "MATCHED").length || 0,
    FLAGGED: statement?.transactions.filter(t => t.matchStatus === "FLAGGED").length || 0,
    EXPENSE: statement?.transactions.filter(t => t.matchStatus === "EXPENSE").length || 0,
    IGNORED: statement?.transactions.filter(t => t.matchStatus === "IGNORED").length || 0,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!statement) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-slate-400">Statement not found</p>
        <Link href="/accounts/bank-upload" className="text-sm text-blue-600 underline mt-2 inline-block">Back</Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <Link href="/accounts/bank-upload" className="p-1">
          <ArrowLeft className="h-5 w-5 text-slate-600" />
        </Link>
        <div className="flex-1">
          <h1 className="text-base font-bold text-slate-900">Reconcile</h1>
          <p className="text-[10px] text-slate-500">
            {statement.bank} | {statement.fileName} | {statement.txnCount} transactions
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-1.5 mb-3">
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-2 text-center">
            <p className="text-sm font-bold text-green-700">{formatCurrency(statement.totalCredits)}</p>
            <p className="text-[9px] text-green-600">Credits</p>
          </CardContent>
        </Card>
        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-2 text-center">
            <p className="text-sm font-bold text-red-700">{formatCurrency(statement.totalDebits)}</p>
            <p className="text-[9px] text-red-600">Debits</p>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-2 text-center">
            <p className="text-sm font-bold text-blue-700">{counts.UNMATCHED}</p>
            <p className="text-[9px] text-blue-600">To Review</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide mb-3 pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`shrink-0 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === f.key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            {f.label}{counts[f.key] > 0 ? ` (${counts[f.key]})` : ""}
          </button>
        ))}
      </div>

      {/* Transactions */}
      <div className="space-y-2">
        {filtered.map((txn) => {
          const isDebit = txn.type === "DEBIT";
          const isProcessing = processing === txn.id;
          const isProcessed = !!txn.processedAt;

          return (
            <Card key={txn.id} className={`${
              txn.matchStatus === "FLAGGED" ? "border-red-200 bg-red-50/30" :
              txn.matchStatus === "MATCHED" ? "border-green-200 bg-green-50/30" :
              txn.matchStatus === "EXPENSE" ? "border-purple-200 bg-purple-50/30" :
              txn.matchStatus === "IGNORED" ? "border-slate-200 opacity-50" : ""
            }`}>
              <CardContent className="p-3">
                {/* Header */}
                <div className="flex items-start justify-between mb-1">
                  <div className="flex-1 min-w-0 mr-2">
                    <p className="text-xs text-slate-500">
                      {new Date(txn.date).toLocaleDateString("en-IN")}
                      {txn.reference && ` | ${txn.reference}`}
                    </p>
                    <p className="text-sm text-slate-700 line-clamp-2 mt-0.5">{txn.description}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-bold ${isDebit ? "text-red-600" : "text-green-600"}`}>
                      {isDebit ? "-" : "+"}{formatCurrency(txn.amount)}
                    </p>
                    {txn.balance !== null && (
                      <p className="text-[10px] text-slate-400">Bal: {formatCurrency(txn.balance)}</p>
                    )}
                  </div>
                </div>

                {/* AI Suggestion */}
                {txn.suggestedVendor && txn.matchStatus !== "IGNORED" && (
                  <div className="bg-blue-50 rounded-md p-2 mb-2 text-[11px]">
                    <div className="flex items-center gap-1 mb-0.5">
                      <Building2 className="h-3 w-3 text-blue-500" />
                      <span className="font-medium text-blue-800">AI suggests: {txn.suggestedVendor.name}</span>
                      {txn.confidence && (
                        <Badge variant="info" className="text-[9px] px-1 py-0">{Math.round(txn.confidence * 100)}%</Badge>
                      )}
                    </div>
                    {txn.suggestedBill && (
                      <p className="text-blue-600 ml-4">
                        Bill {txn.suggestedBill.billNo} — Balance: {formatCurrency(txn.suggestedBill.amount - txn.suggestedBill.paidAmount)}
                      </p>
                    )}
                  </div>
                )}

                {/* Flag Reason */}
                {txn.flagReason && (
                  <div className="bg-red-50 rounded-md p-2 mb-2 text-[11px] flex items-start gap-1">
                    <AlertTriangle className="h-3 w-3 text-red-500 shrink-0 mt-0.5" />
                    <span className="text-red-700">{txn.flagReason}</span>
                  </div>
                )}

                {/* Status Badge */}
                {isProcessed && (
                  <div className="flex items-center gap-1 mb-1">
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                    <span className="text-[10px] text-green-600">
                      {txn.matchStatus === "MATCHED" ? "Payment recorded" :
                       txn.matchStatus === "EXPENSE" ? "Expense recorded" :
                       txn.matchStatus === "IGNORED" ? "Ignored" : "Processed"}
                    </span>
                  </div>
                )}

                {/* Action Buttons (only for unmatched/flagged debits) */}
                {!isProcessed && isDebit && (
                  <div className="flex gap-1.5 mt-2">
                    {txn.suggestedVendor && (
                      <button
                        onClick={() => handleAction(txn.id, "confirm_payment", {
                          vendorId: txn.suggestedVendor!.id,
                          billId: txn.suggestedBill?.id,
                        })}
                        disabled={isProcessing}
                        className="flex-1 flex items-center justify-center gap-1 bg-green-600 text-white py-1.5 rounded-md text-[11px] font-medium disabled:opacity-50"
                      >
                        {isProcessing ? <Loader2 className="h-3 w-3 animate-spin" /> : <CreditCard className="h-3 w-3" />}
                        Confirm Payment
                      </button>
                    )}
                    <button
                      onClick={() => handleAction(txn.id, "confirm_expense", {
                        category: txn.suggestedCategory || "EXPENSE_OTHER",
                      })}
                      disabled={isProcessing}
                      className="flex items-center gap-1 bg-purple-600 text-white px-3 py-1.5 rounded-md text-[11px] font-medium disabled:opacity-50"
                    >
                      <Receipt className="h-3 w-3" /> Expense
                    </button>
                    <button
                      onClick={() => handleAction(txn.id, "ignore")}
                      disabled={isProcessing}
                      className="flex items-center gap-1 bg-slate-200 text-slate-600 px-3 py-1.5 rounded-md text-[11px] font-medium disabled:opacity-50"
                    >
                      <XCircle className="h-3 w-3" /> Skip
                    </button>
                  </div>
                )}

                {/* Category tag */}
                {txn.suggestedCategory && !isProcessed && !isDebit && (
                  <div className="mt-1">
                    <Badge variant="default" className="text-[9px]">{txn.suggestedCategory.replace(/_/g, " ")}</Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-8">
            <CheckCircle2 className="h-6 w-6 text-slate-300 mx-auto mb-1" />
            <p className="text-xs text-slate-400">
              {filter === "UNMATCHED" ? "All transactions processed!" : "No transactions in this category"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
