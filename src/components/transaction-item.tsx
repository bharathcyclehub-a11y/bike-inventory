"use client";

import { ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface TransactionItemProps {
  direction: "in" | "out";
  productName: string;
  sku: string;
  quantity: number;
  time: string;
  reference?: string;
}

export function TransactionItem({
  direction,
  productName,
  sku,
  quantity,
  time,
  reference,
}: TransactionItemProps) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-slate-100 last:border-0">
      <div
        className={cn("rounded-full p-2", {
          "bg-blue-50": direction === "in",
          "bg-orange-50": direction === "out",
        })}
      >
        {direction === "in" ? (
          <ArrowDownCircle className="h-5 w-5 text-blue-600" />
        ) : (
          <ArrowUpCircle className="h-5 w-5 text-orange-500" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900">
          {productName}
        </p>
        <p className="text-xs text-slate-500">
          {sku} {reference ? `| ${reference}` : ""}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p
          className={cn("text-sm font-semibold", {
            "text-blue-600": direction === "in",
            "text-orange-500": direction === "out",
          })}
        >
          {direction === "in" ? "+" : "-"}
          {quantity}
        </p>
        <p className="text-xs text-slate-400">{time}</p>
      </div>
    </div>
  );
}
