import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { useState, useEffect } from "react";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatINR(amount: number): string {
  const val = typeof amount === "number" && !isNaN(amount) ? amount : 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(val);
}

export function formatTime(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Returns relative time string and aging level for accountability badges */
export function getAging(dateStr: string): { text: string; level: "ok" | "warning" | "danger" | "critical"; hours: number } {
  const ms = Date.now() - new Date(dateStr).getTime();
  const hours = ms / (1000 * 60 * 60);
  const days = Math.floor(hours / 24);

  let text: string;
  if (hours < 1) text = "Just now";
  else if (hours < 24) text = `${Math.floor(hours)}h ago`;
  else if (days === 1) text = "1 day ago";
  else text = `${days}d ago`;

  let level: "ok" | "warning" | "danger" | "critical";
  if (hours < 24) level = "ok";
  else if (hours < 48) level = "warning";
  else if (hours < 72) level = "danger";
  else level = "critical";

  return { text, level, hours };
}

export const AGING_COLORS = {
  ok: "",
  warning: "bg-yellow-50 border-yellow-200",
  danger: "bg-red-50 border-red-200",
  critical: "bg-red-100 border-red-300",
} as const;

export const AGING_BADGE = {
  ok: "",
  warning: "bg-yellow-100 text-yellow-800",
  danger: "bg-red-100 text-red-800",
  critical: "bg-red-200 text-red-900 animate-pulse",
} as const;

export function useDebounce<T>(value: T, delay = 300): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
