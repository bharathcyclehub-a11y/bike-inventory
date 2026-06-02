"use client";

import { useState, useEffect, useCallback } from "react";
import { Zap, Check, X, AlertTriangle, Package, Truck, IndianRupee, Warehouse, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface Suggestion {
  id: string;
  source: string;
  sourceId: string | null;
  title: string;
  description: string | null;
  suggestedRole: string;
  urgencyScore: number;
  status: string;
  createdAt: string;
}

const SOURCE_ICONS: Record<string, typeof Zap> = {
  OVERDUE_BILL: IndianRupee,
  STUCK_DELIVERY: Truck,
  LOW_STOCK: Package,
  EXPIRING_CD: AlertTriangle,
  UNBINNED_INBOUND: Warehouse,
};

const SOURCE_COLORS: Record<string, string> = {
  OVERDUE_BILL: "text-red-600 bg-red-50",
  STUCK_DELIVERY: "text-orange-600 bg-orange-50",
  LOW_STOCK: "text-yellow-600 bg-yellow-50",
  EXPIRING_CD: "text-red-600 bg-red-50",
  UNBINNED_INBOUND: "text-blue-600 bg-blue-50",
};

export function TaskSuggestionInbox() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const fetchSuggestions = useCallback(() => {
    fetch("/api/task-suggestions?status=PENDING")
      .then((r) => r.json())
      .then((res) => { if (res.success) setSuggestions(res.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchSuggestions(); }, [fetchSuggestions]);

  const handleAction = async (id: string, action: "accept" | "dismiss") => {
    setActing(id);
    try {
      const res = await fetch("/api/task-suggestions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const data = await res.json();
      if (data.success) {
        setSuggestions((prev) => prev.filter((s) => s.id !== id));
      }
    } catch {
      // silent
    } finally {
      setActing(null);
    }
  };

  if (loading) return null;
  if (suggestions.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <Zap className="h-4 w-4 text-amber-500" />
        <span className="text-xs font-semibold text-slate-700">System Suggestions</span>
        <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">{suggestions.length}</span>
      </div>
      <div className="space-y-2">
        {suggestions.slice(0, 5).map((s) => {
          const Icon = SOURCE_ICONS[s.source] || Zap;
          const colorClass = SOURCE_COLORS[s.source] || "text-slate-600 bg-slate-50";
          const isActing = acting === s.id;

          return (
            <Card key={s.id} className="border-amber-200/50">
              <CardContent className="p-3">
                <div className="flex items-start gap-2.5">
                  <div className={`shrink-0 p-1.5 rounded-lg ${colorClass}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-900 leading-tight">{s.title}</p>
                    {s.description && (
                      <p className="text-[10px] text-slate-500 mt-0.5">{s.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleAction(s.id, "accept")}
                      disabled={isActing}
                      className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors disabled:opacity-50"
                      title="Create task"
                    >
                      {isActing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      onClick={() => handleAction(s.id, "dismiss")}
                      disabled={isActing}
                      className="p-1.5 rounded-lg bg-slate-50 text-slate-400 hover:bg-slate-100 transition-colors disabled:opacity-50"
                      title="Dismiss"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {suggestions.length > 5 && (
          <p className="text-[10px] text-slate-400 text-center">+{suggestions.length - 5} more suggestions</p>
        )}
      </div>
    </div>
  );
}
