"use client";

import Link from "next/link";
import { IndianRupee } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { DeliveryData, formatINR } from "./types";

interface PaymentWarningProps {
  data: DeliveryData;
}

export function PaymentWarning({ data }: PaymentWarningProps) {
  if (!data.paymentStatus?.hasPending) return null;

  return (
    <Card className="mb-3 border-red-200 bg-red-50">
      <CardContent className="p-3">
        <div className="flex items-center gap-2">
          <IndianRupee className="h-4 w-4 text-red-600 shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-semibold text-red-900">Payment Pending</p>
            <p className="text-xs text-red-700">
              Balance: {formatINR(data.paymentStatus.balance)} of{" "}
              {formatINR(data.paymentStatus.totalAmount)}
              {data.paymentStatus.paidAmount > 0 &&
                ` (Paid: ${formatINR(data.paymentStatus.paidAmount)})`}
            </p>
          </div>
          <Link href="/receivables" className="text-xs text-red-600 underline shrink-0">
            View
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
