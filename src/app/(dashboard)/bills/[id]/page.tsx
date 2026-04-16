"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { ArrowLeft, CreditCard, Phone, MessageSquare, Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface BillDetail {
  id: string;
  billNo: string;
  vendorId: string;
  amount: number;
  paidAmount: number;
  status: string;
  billDate: string;
  dueDate: string;
  lastFollowedUp?: string;
  nextFollowUpDate?: string;
  followUpNotes?: string;
  notes?: string;
  vendor: { name: string; code: string; phone?: string; whatsappNumber?: string };
  vendorBalance?: number;
  payments: Array<{
    id: string;
    amount: number;
    cdDiscountAmount?: number;
    paymentMode: string;
    paymentDate: string;
    referenceNo?: string;
  }>;
}

interface CdEligibility {
  eligible: boolean;
  reason?: string;
  cdPercentage?: number;
  daysRemaining?: number;
  discountAmount?: number;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}

export default function BillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [bill, setBill] = useState<BillDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpNotes, setFollowUpNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [cdInfo, setCdInfo] = useState<CdEligibility | null>(null);

  useEffect(() => {
    fetch(`/api/bills/${id}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setBill(res.data);
          if (res.data.nextFollowUpDate) setFollowUpDate(res.data.nextFollowUpDate.split("T")[0]);
          if (res.data.followUpNotes) setFollowUpNotes(res.data.followUpNotes);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    // Fetch CD eligibility
    fetch(`/api/bills/${id}/cd-eligibility`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setCdInfo(res.data);
      })
      .catch(() => {});
  }, [id]);

  async function saveFollowUp() {
    setSaving(true);
    try {
      const res = await fetch(`/api/bills/${id}/follow-up`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nextFollowUpDate: followUpDate, followUpNotes }),
      });
      const data = await res.json();
      if (data.success) {
        setBill((prev) => prev ? { ...prev, ...data.data } : prev);
        setShowFollowUp(false);
      }
    } catch {}
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!bill) return (
    <div className="text-center py-12">
      <p className="text-sm text-slate-400">Bill not found</p>
      <Link href="/bills" className="text-sm text-blue-600 hover:underline mt-2 inline-block">
        Back to Bills
      </Link>
    </div>
  );

  const remaining = bill.amount - bill.paidAmount;
  const isOverdue = new Date(bill.dueDate) < new Date() && remaining > 0;
  const paidPercent = Math.min(100, (bill.paidAmount / bill.amount) * 100);

  const whatsappLink = bill.vendor.whatsappNumber
    ? `https://wa.me/91${bill.vendor.whatsappNumber.replace(/\D/g, "").slice(-10)}?text=${encodeURIComponent(
        `Reminder: Bill ${bill.billNo} for ${formatCurrency(remaining)} is ${isOverdue ? "overdue" : "pending"}. Due: ${new Date(bill.dueDate).toLocaleDateString("en-IN")}. Please arrange payment. Thank you.`
      )}`
    : null;

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Link href="/bills" className="p-1">
          <ArrowLeft className="h-5 w-5 text-slate-600" />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-slate-900">{bill.billNo}</h1>
          <p className="text-xs text-slate-500">{bill.vendor.name}</p>
          {bill.vendorBalance !== undefined && (
            <p className={`text-xs font-medium ${bill.vendorBalance > 0 ? "text-red-600" : "text-green-600"}`}>
              Balance: {formatCurrency(bill.vendorBalance)}
            </p>
          )}
        </div>
        <Badge variant={bill.status === "PAID" ? "success" : isOverdue ? "danger" : "warning"}>
          {isOverdue ? "OVERDUE" : bill.status.replace(/_/g, " ")}
        </Badge>
      </div>

      {/* CD Status */}
      {cdInfo && cdInfo.eligible && (
        <div className="mb-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 flex items-center justify-between">
          <span className="text-xs font-medium text-green-800">
            CD: {cdInfo.cdPercentage}% ({cdInfo.daysRemaining}d left)
          </span>
          <span className="text-xs text-green-600">
            Save {formatCurrency(cdInfo.discountAmount || 0)}
          </span>
        </div>
      )}
      {cdInfo && !cdInfo.eligible && !cdInfo.reason && (
        <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <span className="text-xs text-slate-500">CD Expired</span>
        </div>
      )}

      {/* Amount Card */}
      <Card className={`mb-4 ${isOverdue ? "border-red-200 bg-red-50/50" : ""}`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500">Total Amount</span>
            <span className="text-lg font-bold text-slate-900">{formatCurrency(bill.amount)}</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2 mb-2">
            <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${paidPercent}%` }} />
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-green-600">Paid: {formatCurrency(bill.paidAmount)}</span>
            <span className={remaining > 0 ? "text-red-600 font-medium" : "text-green-600"}>
              {remaining > 0 ? `Due: ${formatCurrency(remaining)}` : "Fully Paid"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      {remaining > 0 && (
        <div className="flex gap-2 mb-4">
          <Link href={`/payments/new?vendorId=${bill.vendorId}&billId=${bill.id}`} className="flex-1">
            <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700">
              <CreditCard className="h-4 w-4 mr-1" /> Record Payment
            </Button>
          </Link>
          {whatsappLink && (
            <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="text-green-600 border-green-300">
                <MessageSquare className="h-4 w-4" />
              </Button>
            </a>
          )}
          {bill.vendor.phone && (
            <a href={`tel:${bill.vendor.phone}`}>
              <Button variant="outline" size="sm">
                <Phone className="h-4 w-4" />
              </Button>
            </a>
          )}
        </div>
      )}

      {/* Bill Info */}
      <Card className="mb-4">
        <CardContent className="p-3 grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-slate-500">Bill Date</span>
            <p className="font-medium">{new Date(bill.billDate).toLocaleDateString("en-IN")}</p>
          </div>
          <div>
            <span className="text-slate-500">Due Date</span>
            <p className={`font-medium ${isOverdue ? "text-red-600" : ""}`}>{new Date(bill.dueDate).toLocaleDateString("en-IN")}</p>
          </div>
        </CardContent>
      </Card>

      {/* Follow-up Section */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-slate-900">Follow-up</h2>
          <button onClick={() => setShowFollowUp(!showFollowUp)} className="text-xs text-blue-600 font-medium">
            {showFollowUp ? "Cancel" : "Update"}
          </button>
        </div>
        {bill.lastFollowedUp && (
          <p className="text-xs text-slate-500 mb-1">
            Last followed up: {new Date(bill.lastFollowedUp).toLocaleDateString("en-IN")}
          </p>
        )}
        {bill.nextFollowUpDate && !showFollowUp && (
          <Card className="bg-amber-50 border-amber-200">
            <CardContent className="p-2 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-amber-600" />
              <span className="text-xs text-amber-700">
                Next: {new Date(bill.nextFollowUpDate).toLocaleDateString("en-IN")}
                {bill.followUpNotes ? ` - ${bill.followUpNotes}` : ""}
              </span>
            </CardContent>
          </Card>
        )}
        {showFollowUp && (
          <Card>
            <CardContent className="p-3 space-y-2">
              <Input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} />
              <textarea
                placeholder="Follow-up notes..."
                value={followUpNotes}
                onChange={(e) => setFollowUpNotes(e.target.value)}
                rows={2}
                className="flex w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
              <Button size="sm" onClick={saveFollowUp} disabled={saving} className="w-full">
                {saving ? "Saving..." : "Save Follow-up"}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Payment History */}
      <h2 className="text-sm font-semibold text-slate-900 mb-2">Payments ({bill.payments.length})</h2>
      <div className="space-y-2">
        {bill.payments.map((p) => (
          <Card key={p.id} className="mb-2">
            <CardContent className="p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-700">
                  {formatCurrency(p.amount)}
                  {p.cdDiscountAmount && p.cdDiscountAmount > 0 && (
                    <span className="text-xs text-green-500 ml-1">
                      + {formatCurrency(p.cdDiscountAmount)} CD
                    </span>
                  )}
                </p>
                <p className="text-xs text-slate-500">
                  {p.paymentMode} | {new Date(p.paymentDate).toLocaleDateString("en-IN")}
                  {p.referenceNo ? ` | Ref: ${p.referenceNo}` : ""}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
        {bill.payments.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-4">No payments recorded</p>
        )}
      </div>
    </div>
  );
}
