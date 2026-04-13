"use client";

import { Card } from "@/components/ui/card";
import {
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DashboardCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    direction: "up" | "down" | "neutral";
    value: string;
  };
  color?: string;
}

export function DashboardCard({
  label,
  value,
  icon: Icon,
  trend,
  color = "bg-slate-100 text-slate-700",
}: DashboardCardProps) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-500 truncate">{label}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
          {trend && (
            <div className="mt-1 flex items-center gap-1">
              {trend.direction === "up" && (
                <ArrowUpRight className="h-3.5 w-3.5 text-green-600" />
              )}
              {trend.direction === "down" && (
                <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
              )}
              {trend.direction === "neutral" && (
                <Minus className="h-3.5 w-3.5 text-slate-400" />
              )}
              <span
                className={cn("text-xs font-medium", {
                  "text-green-600": trend.direction === "up",
                  "text-red-500": trend.direction === "down",
                  "text-slate-400": trend.direction === "neutral",
                })}
              >
                {trend.value}
              </span>
            </div>
          )}
        </div>
        <div className={cn("rounded-lg p-2.5", color)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}
