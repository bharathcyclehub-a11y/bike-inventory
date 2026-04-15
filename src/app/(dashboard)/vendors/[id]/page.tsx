"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { ArrowLeft, Phone, MessageSquare, FileText, CreditCard, Building2, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Vendor, PurchaseOrder, VendorBill, VendorCredit } from "@/types";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}

type VendorDetail = Vendor & {
  purchaseOrders: PurchaseOrder[];
  bills: (VendorBill & { payments: Array<{ amount: number }> })[];
  credits: VendorCredit[];
  _count?: { issues: number };
};

export default function VendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [vendor, setVendor] = useState<VendorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "pos" | "bills" | "credits" | "issues">("overview");

  useEffect(() => {
    fetch(`/api/vendors/${id}`)
      .then((r) => r.json())
      .then((res) => { if (res.success) setVendor(res.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-slate-400">Vendor not found</p>
        <Link href="/vendors" className="text-sm text-blue-600 hover:underline mt-2 inline-block">
          Back to Vendors
        </Link>
      </div>
    );
  }

  const whatsappLink = vendor.whatsappNumber
    ? `https://wa.me/91${vendor.whatsappNumber.replace(/\D/g, "").slice(-10)}`
    : null;

  const totalOutstanding = vendor.bills
    .filter((b) => b.status !== "PAID")
    .reduce((sum, b) => sum + (b.amount - b.paidAmount), 0);

  const issueCount = vendor._count?.issues ?? 0;

  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "pos", label: `POs (${vendor.purchaseOrders.length})` },
    { key: "bills", label: `Bills (${vendor.bills.length})` },
    { key: "credits", label: `Credits (${vendor.credits.length})` },
    { key: "issues", label: `Issues (${issueCount})` },
  ] as const;

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Link href="/vendors" className="p-1">
          <ArrowLeft className="h-5 w-5 text-slate-600" />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-slate-900">{vendor.name}</h1>
          <p className="text-xs text-slate-500">{vendor.code}</p>
        </div>
        <Badge variant={vendor.isActive ? "success" : "default"}>
          {vendor.isActive ? "Active" : "Inactive"}
        </Badge>
      </div>

      {/* Contact Actions */}
      <div className="flex gap-2 mb-4">
        {vendor.phone && (
          <a href={`tel:${vendor.phone}`} className="flex-1">
            <Button variant="outline" size="sm" className="w-full">
              <Phone className="h-4 w-4 mr-1" /> Call
            </Button>
          </a>
        )}
        {whatsappLink && (
          <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="flex-1">
            <Button variant="outline" size="sm" className="w-full text-green-600 border-green-300">
              <MessageSquare className="h-4 w-4 mr-1" /> WhatsApp
            </Button>
          </a>
        )}
      </div>

      {/* Outstanding Card */}
      {totalOutstanding > 0 && (
        <Card className="bg-red-50 border-red-200 mb-4">
          <CardContent className="p-3 flex items-center justify-between">
            <span className="text-sm font-medium text-red-700">Outstanding</span>
            <span className="text-lg font-bold text-red-700">{formatCurrency(totalOutstanding)}</span>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-slate-100 rounded-lg p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 text-xs font-medium py-2 rounded-md transition-colors ${
              tab === t.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === "overview" && (
        <div className="space-y-3">
          {vendor.addressLine1 && (
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Address</p>
              <p className="text-sm text-slate-700">
                {vendor.addressLine1}{vendor.city ? `, ${vendor.city}` : ""}{vendor.state ? `, ${vendor.state}` : ""} {vendor.pincode || ""}
              </p>
            </div>
          )}
          {vendor.gstin && (
            <div>
              <p className="text-xs text-slate-500 mb-0.5">GSTIN</p>
              <p className="text-sm text-slate-700 font-mono">{vendor.gstin}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Payment Terms</p>
              <p className="text-sm text-slate-700">{vendor.paymentTermDays} days</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Credit Limit</p>
              <p className="text-sm text-slate-700">{formatCurrency(vendor.creditLimit)}</p>
            </div>
          </div>
          {(vendor.cdTermsDays || vendor.cdPercentage) && (
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Cash Discount</p>
              <p className="text-sm text-slate-700">{vendor.cdPercentage}% within {vendor.cdTermsDays} days</p>
            </div>
          )}
          {vendor.contacts && vendor.contacts.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 mb-1">Contacts</p>
              {vendor.contacts.map((c) => (
                <div key={c.id} className="flex items-center gap-2 py-1">
                  <span className="text-sm text-slate-700">{c.name}</span>
                  {c.designation && <span className="text-xs text-slate-400">({c.designation})</span>}
                  {c.isPrimary && <Badge variant="info">Primary</Badge>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* POs Tab */}
      {tab === "pos" && (
        <div className="space-y-2">
          {vendor.purchaseOrders.map((po) => (
            <Link key={po.id} href={`/purchase-orders/${po.id}`}>
              <Card className="hover:border-slate-300 mb-2">
                <CardContent className="p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{po.poNumber}</p>
                    <p className="text-xs text-slate-500">{new Date(po.orderDate).toLocaleDateString("en-IN")}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-900">{formatCurrency(po.grandTotal)}</p>
                    <Badge variant={po.status === "RECEIVED" ? "success" : po.status === "CANCELLED" ? "danger" : "warning"}>
                      {po.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
          {vendor.purchaseOrders.length === 0 && <p className="text-sm text-slate-400 text-center py-4">No purchase orders</p>}
        </div>
      )}

      {/* Bills Tab */}
      {tab === "bills" && (
        <div className="space-y-2">
          {vendor.bills.map((bill) => {
            const remaining = bill.amount - bill.paidAmount;
            const isOverdue = new Date(bill.dueDate) < new Date() && remaining > 0;
            return (
              <Link key={bill.id} href={`/bills/${bill.id}`}>
                <Card className={`hover:border-slate-300 mb-2 ${isOverdue ? "border-red-200" : ""}`}>
                  <CardContent className="p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{bill.billNo}</p>
                      <p className="text-xs text-slate-500">Due: {new Date(bill.dueDate).toLocaleDateString("en-IN")}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${remaining > 0 ? "text-red-600" : "text-green-600"}`}>
                        {formatCurrency(remaining)}
                      </p>
                      <Badge variant={bill.status === "PAID" ? "success" : isOverdue ? "danger" : "warning"}>
                        {isOverdue ? "OVERDUE" : bill.status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
          {vendor.bills.length === 0 && <p className="text-sm text-slate-400 text-center py-4">No bills</p>}
        </div>
      )}

      {/* Credits Tab */}
      {tab === "credits" && (
        <div className="space-y-2">
          {vendor.credits.map((credit) => (
            <Card key={credit.id} className="mb-2">
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900">{credit.creditNoteNo}</p>
                  <p className="text-xs text-slate-500">{new Date(credit.creditDate).toLocaleDateString("en-IN")}</p>
                  {credit.reason && <p className="text-xs text-slate-400 mt-0.5">{credit.reason}</p>}
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900">{formatCurrency(credit.amount)}</p>
                  <p className="text-xs text-slate-500">Used: {formatCurrency(credit.usedAmount)}</p>
                </div>
              </CardContent>
            </Card>
          ))}
          {vendor.credits.length === 0 && <p className="text-sm text-slate-400 text-center py-4">No credit notes</p>}
        </div>
      )}

      {/* Issues Tab */}
      {tab === "issues" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-slate-500" />
              <p className="text-sm font-medium text-slate-700">
                {issueCount} issue{issueCount !== 1 ? "s" : ""} recorded
              </p>
            </div>
            <Link href={`/vendor-issues?vendorId=${vendor.id}`}>
              <Badge variant="info" className="cursor-pointer">View All</Badge>
            </Link>
          </div>
          <Link href={`/vendor-issues/new`}>
            <Card className="hover:border-slate-300 border-dashed">
              <CardContent className="p-3 text-center">
                <p className="text-sm text-blue-600 font-medium">+ Report New Issue</p>
              </CardContent>
            </Card>
          </Link>
        </div>
      )}
    </div>
  );
}
