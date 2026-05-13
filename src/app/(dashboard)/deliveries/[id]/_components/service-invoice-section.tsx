"use client";

import { useState } from "react";
import { Wrench, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { DeliveryData } from "./types";

interface ServiceInvoiceSectionProps {
  data: DeliveryData;
  deliveryId: string;
  onMarked: () => void;
}

export function ServiceInvoiceSection({ data, deliveryId, onMarked }: ServiceInvoiceSectionProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const markAsService = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/deliveries/${deliveryId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceType: "SERVICE" }),
      });
      const result = await res.json();
      if (result.success) {
        onMarked();
      }
    } catch { /* silent */ }
    setLoading(false);
    setShowConfirm(false);
  };

  return (
    <>
      {/* Service invoice banner */}
      {data.invoiceType === "SERVICE" && (
        <Card className="border-purple-200 bg-purple-50 mb-3">
          <CardContent className="p-3 text-center">
            <Wrench className="h-6 w-6 text-purple-600 mx-auto mb-1" />
            <p className="text-sm font-medium text-purple-900">Service Invoice</p>
            <p className="text-xs text-purple-700">No delivery required. Service billing only.</p>
          </CardContent>
        </Card>
      )}

      {/* Mark as Service button (PENDING only, not already tagged) */}
      {data.status === "PENDING" && data.invoiceType !== "SERVICE" && !showConfirm && (
        <button
          onClick={() => setShowConfirm(true)}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-purple-100 text-purple-700 border border-purple-200 py-2.5 rounded-lg text-sm font-medium mb-3"
        >
          <Wrench className="h-4 w-4" /> Mark as Service Invoice
        </button>
      )}

      {/* Confirmation dialog */}
      {showConfirm && (
        <Card className="border-amber-300 bg-amber-50 mb-3">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-900">Mark as Service Invoice?</p>
                <p className="text-xs text-amber-700 mt-1">
                  This invoice will be moved to the Service section and removed from deliveries. This
                  action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={markAsService}
                disabled={loading}
                className="flex-1 bg-purple-600 text-white py-2 rounded-lg text-xs font-medium disabled:opacity-50"
              >
                {loading ? "Saving..." : "Yes, it's a Service Invoice"}
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 bg-white text-slate-700 border border-slate-200 py-2 rounded-lg text-xs font-medium"
              >
                Cancel
              </button>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
