"use client";

interface ImportableInvoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  phone?: string;
  date: string;
  total: number;
  alreadyImported: boolean;
  appStatus?: string | null;
  lineItems?: Array<{ name: string; quantity: number }>;
}

interface ZohoImportResultsProps {
  results: ImportableInvoice[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
}

function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  VERIFIED: "Verified",
  SCHEDULED: "Scheduled",
  OUT_FOR_DELIVERY: "Out",
  DELIVERED: "Delivered",
  FLAGGED: "Flagged",
  PREBOOKED: "Prebooked",
  PACKED: "Packed",
  SHIPPED: "Shipped",
  IN_TRANSIT: "In Transit",
  WALK_OUT: "Walk-out",
};

export function ZohoImportResults({
  results,
  selected,
  onToggle,
  onSelectAll,
}: ZohoImportResultsProps) {
  const selectable = results.filter((r) => !r.alreadyImported);
  const allSelected = selectable.length > 0 && selectable.every((r) => selected.has(r.id));

  return (
    <div>
      {/* Select all toggle */}
      {selectable.length > 1 && (
        <div className="flex items-center justify-between mb-2">
          <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={onSelectAll}
              className="rounded"
            />
            Select all ({selectable.length})
          </label>
          <span className="text-xs text-slate-400">
            {selected.size} selected
          </span>
        </div>
      )}

      {/* Results list */}
      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        {results.map((r) => (
          <label
            key={r.id}
            className={`flex items-start gap-2 p-2 rounded-lg transition-colors ${
              r.alreadyImported
                ? "bg-slate-100 border border-slate-200 opacity-60"
                : selected.has(r.id)
                  ? "bg-blue-100 border border-blue-300 cursor-pointer"
                  : "bg-white border border-slate-200 cursor-pointer"
            }`}
          >
            {!r.alreadyImported && (
              <input
                type="checkbox"
                checked={selected.has(r.id)}
                onChange={() => onToggle(r.id)}
                className="mt-0.5 rounded"
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-900">
                  {r.invoiceNumber}
                </span>
                <span className="text-xs font-semibold text-slate-700">
                  {formatINR(r.total)}
                </span>
              </div>
              <p className="text-xs text-slate-600">
                {r.customerName}
                {r.phone ? ` | ${r.phone}` : ""}
              </p>
              <p className="text-xs text-slate-400">
                {r.date}
                {r.alreadyImported && (
                  <span className="text-green-600 font-medium ml-1">
                    Imported - {STATUS_LABELS[r.appStatus || ""] || r.appStatus || "Unknown"}
                  </span>
                )}
              </p>
              {r.lineItems && r.lineItems.length > 0 && (
                <p className="text-xs text-slate-400 mt-0.5">
                  {r.lineItems
                    .slice(0, 2)
                    .map((li) => `${li.name} x${li.quantity}`)
                    .join(" | ")}
                  {r.lineItems.length > 2 && ` +${r.lineItems.length - 2}`}
                </p>
              )}
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

export type { ImportableInvoice };
