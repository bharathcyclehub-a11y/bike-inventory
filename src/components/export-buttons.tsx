"use client";

import { FileSpreadsheet, FileDown } from "lucide-react";

interface ExportButtonsProps {
  onExcel: () => void;
  onPDF: () => void;
}

export function ExportButtons({ onExcel, onPDF }: ExportButtonsProps) {
  return (
    <div className="flex gap-1.5">
      <button
        onClick={onExcel}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-medium hover:bg-green-100 transition-colors"
      >
        <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
      </button>
      <button
        onClick={onPDF}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 text-red-700 text-xs font-medium hover:bg-red-100 transition-colors"
      >
        <FileDown className="h-3.5 w-3.5" /> PDF
      </button>
    </div>
  );
}
