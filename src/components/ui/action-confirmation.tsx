"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface ActionConfirmationProps {
  open: boolean;
  onClose: () => void;
  type: "success" | "warning" | "error" | "info";
  title: string;
  referenceId: string;
  timestamp?: Date;
  performedBy?: string;
  items?: Array<{ label: string; value: string }>;
  details?: string;
  children?: React.ReactNode;
}

const TYPE_CONFIG = {
  success: {
    badge: "SUCCESS ✓",
    badgeClass: "bg-green-100 text-green-700",
    buttonClass: "bg-green-600 hover:bg-green-700 text-white",
  },
  warning: {
    badge: "WARNING ⚠",
    badgeClass: "bg-yellow-100 text-yellow-700",
    buttonClass: "bg-amber-600 hover:bg-amber-700 text-white",
  },
  error: {
    badge: "FAILED ✗",
    badgeClass: "bg-red-100 text-red-700",
    buttonClass: "bg-red-600 hover:bg-red-700 text-white",
  },
  info: {
    badge: "INFO ℹ",
    badgeClass: "bg-blue-100 text-blue-700",
    buttonClass: "bg-blue-600 hover:bg-blue-700 text-white",
  },
} as const;

function formatTimestamp(date: Date): string {
  const day = date.getDate();
  const month = date.toLocaleString("en-IN", { month: "short" });
  const year = date.getFullYear();
  const time = date.toLocaleString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${day} ${month} ${year}, ${time}`;
}

function ActionConfirmation({
  open,
  onClose,
  type,
  title,
  referenceId,
  timestamp,
  performedBy,
  items,
  details,
  children,
}: ActionConfirmationProps) {
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (open) {
      setVisible(true);
      // Trigger animation on next frame
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setAnimating(true);
        });
      });
    } else {
      setAnimating(false);
      const timer = setTimeout(() => setVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  if (!visible) return null;

  const config = TYPE_CONFIG[type];
  const ts = timestamp ?? new Date();

  return (
    <div className="fixed inset-0 z-[60]">
      {/* Backdrop */}
      <div
        className={cn(
          "absolute inset-0 bg-black/40 transition-opacity duration-200",
          animating ? "opacity-100" : "opacity-0"
        )}
      />

      {/* Modal */}
      <div
        className={cn(
          "absolute bottom-0 left-0 right-0 flex justify-center transition-transform duration-300 ease-out",
          animating ? "translate-y-0" : "translate-y-full"
        )}
      >
        <div className="w-full max-w-md rounded-t-2xl bg-white px-5 pb-6 pt-5 shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">
              Bharath Cycle Hub
            </span>
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                config.badgeClass
              )}
            >
              {config.badge}
            </span>
          </div>

          {/* Title */}
          <h2 className="mt-3 text-xl font-semibold text-slate-900">
            {title}
          </h2>

          {/* Reference ID */}
          <p className="mt-1 font-mono text-2xl font-bold text-slate-900">
            {referenceId}
          </p>

          {/* Timestamp */}
          <p className="mt-2 text-sm text-slate-500">
            {formatTimestamp(ts)}
          </p>

          {/* Performed by */}
          {performedBy && (
            <p className="mt-0.5 text-sm text-slate-500">
              By: {performedBy}
            </p>
          )}

          {/* Divider */}
          {(items?.length || details || children) && (
            <hr className="my-4 border-slate-200" />
          )}

          {/* Items table */}
          {items && items.length > 0 && (
            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">{item.label}</span>
                  <span className="text-sm font-medium text-slate-900">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Details */}
          {details && (
            <p className="mt-3 text-sm text-slate-600">{details}</p>
          )}

          {/* Children */}
          {children && <div className="mt-3">{children}</div>}

          {/* Screenshot hint */}
          <p className="mt-4 text-center text-xs text-slate-400">
            📸 Screenshot this for your records
          </p>

          {/* Done button */}
          <button
            onClick={onClose}
            className={cn(
              "mt-3 h-12 w-full rounded-xl font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2",
              config.buttonClass
            )}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export { ActionConfirmation };
export type { ActionConfirmationProps };
