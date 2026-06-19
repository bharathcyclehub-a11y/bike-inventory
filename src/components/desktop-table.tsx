"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export interface Column<T> {
  header: string;
  cell: (row: T) => React.ReactNode;
  /** extra classes for the <td>/<th> (e.g. text-right, w-32, hidden xl:table-cell) */
  className?: string;
  /** header-only classes (defaults to className) */
  headClassName?: string;
}

interface DesktopTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** make each row navigate on click */
  rowHref?: (row: T) => string;
  /** or a custom click handler */
  onRowClick?: (row: T) => void;
  className?: string;
  emptyText?: string;
}

// A clean desktop table. Render it with `className="hidden lg:block"` and keep the
// existing mobile card list wrapped in `lg:hidden` — so mobile is untouched and
// desktop gets a dense, scannable table.
export function DesktopTable<T>({
  columns,
  rows,
  rowKey,
  rowHref,
  onRowClick,
  className,
  emptyText = "Nothing to show",
}: DesktopTableProps<T>) {
  const router = useRouter();
  const clickable = !!rowHref || !!onRowClick;

  const handleClick = (row: T) => {
    if (onRowClick) return onRowClick(row);
    if (rowHref) router.push(rowHref(row));
  };

  return (
    <div className={cn("overflow-x-auto rounded-xl border border-slate-200 bg-white", className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80">
            {columns.map((c, i) => (
              <th
                key={i}
                className={cn(
                  "px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500",
                  c.headClassName ?? c.className
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-8 text-center text-sm text-slate-400">
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={clickable ? () => handleClick(row) : undefined}
                className={cn("transition-colors", clickable && "cursor-pointer hover:bg-slate-50")}
              >
                {columns.map((c, i) => (
                  <td key={i} className={cn("px-3 py-2.5 align-middle text-slate-700", c.className)}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
