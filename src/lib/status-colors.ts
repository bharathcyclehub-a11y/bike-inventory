// Standardized RAG status color system for warehouse operations
// Used across deliveries, inbound, transfers, stock-audit pages

export const STATUS_COLORS: Record<string, string> = {
  // Green — completed/success
  DELIVERED: "bg-green-100 text-green-700 border-green-200",
  RECEIVED: "bg-green-100 text-green-700 border-green-200",
  COMPLETED: "bg-green-100 text-green-700 border-green-200",
  WALK_OUT: "bg-green-100 text-green-700 border-green-200",
  APPROVED: "bg-green-100 text-green-700 border-green-200",
  RESOLVED: "bg-green-100 text-green-700 border-green-200",

  // Amber — awaiting action
  PENDING: "bg-amber-100 text-amber-700 border-amber-200",
  IN_TRANSIT: "bg-amber-100 text-amber-700 border-amber-200",
  OPEN: "bg-amber-100 text-amber-700 border-amber-200",
  IN_PROGRESS: "bg-amber-100 text-amber-700 border-amber-200",

  // Red — urgent/error/flagged
  FLAGGED: "bg-red-100 text-red-700 border-red-200",
  REJECTED: "bg-red-100 text-red-700 border-red-200",
  SHORTAGE: "bg-red-100 text-red-700 border-red-200",
  CANCELLED: "bg-red-100 text-red-700 border-red-200",

  // Blue — info/scheduled/verified
  VERIFIED: "bg-blue-100 text-blue-700 border-blue-200",
  SCHEDULED: "bg-blue-100 text-blue-700 border-blue-200",
  SHIPPED: "bg-blue-100 text-blue-700 border-blue-200",
  OUT_FOR_DELIVERY: "bg-blue-100 text-blue-700 border-blue-200",

  // Orange — needs inspection/damaged
  DAMAGED: "bg-orange-100 text-orange-700 border-orange-200",
  PACKED: "bg-orange-100 text-orange-700 border-orange-200",
  PARTIAL: "bg-orange-100 text-orange-700 border-orange-200",

  // Purple — pre-booked/waiting
  PREBOOKED: "bg-purple-100 text-purple-700 border-purple-200",
};

export function getStatusColor(status: string): string {
  return STATUS_COLORS[status] || "bg-slate-100 text-slate-600 border-slate-200";
}

export function getStatusLabel(status: string): string {
  const LABELS: Record<string, string> = {
    PENDING: "Pending",
    VERIFIED: "Verified",
    SCHEDULED: "Scheduled",
    PACKED: "Packed",
    SHIPPED: "Shipped",
    IN_TRANSIT: "In Transit",
    OUT_FOR_DELIVERY: "Out for Delivery",
    DELIVERED: "Delivered",
    WALK_OUT: "Walk Out",
    FLAGGED: "Flagged",
    PREBOOKED: "Pre-booked",
    APPROVED: "Approved",
    REJECTED: "Rejected",
    COMPLETED: "Completed",
    PARTIAL: "Partial",
    RECEIVED: "Received",
    OPEN: "Open",
    IN_PROGRESS: "In Progress",
    RESOLVED: "Resolved",
    CANCELLED: "Cancelled",
    DAMAGED: "Damaged",
    SHORTAGE: "Shortage",
  };
  return LABELS[status] || status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " ");
}
