// Shared AI calculation utilities — pure functions, no DB access

export function calcSalesVelocity(totalSold: number, days: number): number {
  if (days <= 0) return 0;
  return totalSold / days;
}

export function calcReorderPoint(avgDailySales: number, leadTimeDays: number, bufferDays = 3): number {
  const safetyStock = avgDailySales * bufferDays;
  return Math.ceil((avgDailySales * leadTimeDays) + safetyStock);
}

export function calcDaysUntilStockout(currentStock: number, avgDailySales: number): number {
  if (avgDailySales <= 0) return 999; // effectively infinite
  return Math.round(currentStock / avgDailySales);
}

export function classifyDemand(salesCount30d: number): "FAST" | "MEDIUM" | "SLOW" | "DEAD" {
  if (salesCount30d > 10) return "FAST";
  if (salesCount30d >= 3) return "MEDIUM";
  if (salesCount30d >= 1) return "SLOW";
  return "DEAD";
}

export function calcTrend(rate30d: number, rate90d: number): "INCREASING" | "DECREASING" | "STABLE" {
  if (rate90d === 0 && rate30d === 0) return "STABLE";
  if (rate90d === 0) return "INCREASING";
  const ratio = rate30d / rate90d;
  if (ratio > 1.2) return "INCREASING";
  if (ratio < 0.8) return "DECREASING";
  return "STABLE";
}

export function calcPriorityScore(deficit: number, salesVelocity: number): number {
  return Math.round((deficit * 2) + (salesVelocity * 10));
}

export function classifyPriority(score: number): "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" {
  if (score > 50) return "CRITICAL";
  if (score > 20) return "HIGH";
  if (score > 5) return "MEDIUM";
  return "LOW";
}

export function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}
