"use client";

import { useState, useEffect } from "react";

interface BottomSheetAction {
  label: string;
  onClick: () => void;
  variant: "danger" | "primary" | "secondary";
  loading?: boolean;
  disabled?: boolean;
}

interface BottomSheetModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  actions: BottomSheetAction[];
}

const VARIANT_STYLES: Record<BottomSheetAction["variant"], string> = {
  danger: "bg-red-600 text-white disabled:opacity-50",
  primary: "bg-slate-900 text-white disabled:opacity-50",
  secondary: "bg-slate-100 text-slate-700",
};

export function BottomSheetModal({
  open,
  onClose,
  title,
  description,
  children,
  actions,
}: BottomSheetModalProps) {
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (open) {
      setVisible(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setAnimating(true));
      });
    } else {
      setAnimating(false);
      const timer = setTimeout(() => setVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${
          animating ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />
      <div
        className={`absolute bottom-0 left-0 right-0 flex justify-center transition-transform duration-300 ease-out ${
          animating ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="w-full max-w-md bg-white rounded-t-2xl p-5 pb-safe shadow-xl">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          {description && (
            <p className="text-sm text-slate-600 mt-1">{description}</p>
          )}
          {children && <div className="mt-3">{children}</div>}
          <div className="flex gap-2 mt-4">
            {actions.map((action) => (
              <button
                key={action.label}
                onClick={action.onClick}
                disabled={action.disabled || action.loading}
                className={`flex-1 h-12 rounded-xl font-semibold ${VARIANT_STYLES[action.variant]}`}
              >
                {action.loading ? "..." : action.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export type { BottomSheetModalProps, BottomSheetAction };
