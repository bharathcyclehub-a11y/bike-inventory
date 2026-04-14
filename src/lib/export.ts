"use client";

export interface ExportColumn {
  header: string;
  key: string;
  format?: (value: unknown, row: Record<string, unknown>) => string;
}

function resolveValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce((o: unknown, k) => {
    if (o && typeof o === "object") return (o as Record<string, unknown>)[k];
    return undefined;
  }, obj);
}

export async function exportToExcel(
  data: Record<string, unknown>[],
  columns: ExportColumn[],
  filename: string
) {
  const XLSX = await import("xlsx");
  const rows = data.map((item) => {
    const row: Record<string, unknown> = {};
    for (const col of columns) {
      const val = resolveValue(item, col.key);
      row[col.header] = col.format ? col.format(val, item) : (val ?? "");
    }
    return row;
  });
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export async function exportToPDF(
  title: string,
  data: Record<string, unknown>[],
  columns: ExportColumn[],
  filename: string
) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const doc = new jsPDF({
    orientation: columns.length > 5 ? "landscape" : "portrait",
  });

  doc.setFontSize(14);
  doc.text(title, 14, 15);
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(
    `Generated: ${new Date().toLocaleDateString("en-IN")} | ${data.length} records`,
    14,
    22
  );

  const headers = columns.map((c) => c.header);
  const rows = data.map((item) =>
    columns.map((col) => {
      const val = resolveValue(item, col.key);
      return col.format ? col.format(val, item) : String(val ?? "");
    })
  );

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 28,
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [30, 41, 59], fontSize: 7 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  doc.save(`${filename}.pdf`);
}
