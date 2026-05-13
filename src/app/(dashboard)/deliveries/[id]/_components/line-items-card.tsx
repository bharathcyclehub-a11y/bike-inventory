"use client";

import { Card, CardContent } from "@/components/ui/card";
import { LineItem, formatINR } from "./types";

interface LineItemsCardProps {
  lineItems: LineItem[] | null;
}

export function LineItemsCard({ lineItems }: LineItemsCardProps) {
  if (!lineItems || lineItems.length === 0) return null;

  return (
    <Card className="mb-3">
      <CardContent className="p-3">
        <p className="text-xs font-semibold text-slate-700 mb-2">Items</p>
        <div className="space-y-1.5">
          {lineItems.map((item, i) => (
            <div key={i} className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-900">{item.name}</p>
                <p className="text-xs text-slate-400">{item.sku} | Qty: {item.quantity}</p>
              </div>
              {item.rate > 0 && (
                <p className="text-xs font-medium text-slate-700">
                  {formatINR(item.rate * item.quantity)}
                </p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
