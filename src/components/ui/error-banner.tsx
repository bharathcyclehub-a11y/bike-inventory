"use client";

import { AlertCircle, WifiOff, RefreshCw, X } from "lucide-react";

interface ErrorBannerProps {
  message: string;
  type?: "error" | "warning" | "offline";
  onRetry?: () => void;
  onDismiss?: () => void;
}

export function ErrorBanner({ message, type = "error", onRetry, onDismiss }: ErrorBannerProps) {
  const styles = {
    error: "bg-red-50 border-red-200 text-red-700",
    warning: "bg-amber-50 border-amber-200 text-amber-700",
    offline: "bg-slate-700 border-slate-600 text-white",
  };

  const Icon = type === "offline" ? WifiOff : AlertCircle;

  return (
    <div className={`rounded-lg border p-3 mb-3 flex items-center gap-2 ${styles[type]}`}>
      <Icon className="h-4 w-4 shrink-0" />
      <p className="text-sm flex-1">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-white/20 hover:bg-white/30 transition-colors"
        >
          <RefreshCw className="h-3 w-3" />
          Retry
        </button>
      )}
      {onDismiss && (
        <button onClick={onDismiss} className="p-0.5 hover:opacity-70">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
