import * as XLSX from "xlsx";

export interface ParsedItem {
  rawSku: string | null;
  rawName: string;
  rawCategory: string | null;
  brandAvailableQty: number;
  brandPrice: number | null;
  brandMrp: number | null;
  rawSize: string | null;
}

interface ColumnMap {
  sku: number | null;
  name: number | null;
  category: number | null;
  qty: number | null;
  price: number | null;
  mrp: number | null;
  size: number | null;
}

const HEADER_KEYWORDS: Record<keyof ColumnMap, string[]> = {
  sku: ["sku", "item code", "product code", "article", "part no", "part number", "code", "article no"],
  name: ["name", "product", "item", "description", "particular", "particulars", "model", "item name", "product name"],
  category: ["category", "group", "type", "segment", "class"],
  qty: ["qty", "quantity", "stock", "available", "avail", "bal", "balance", "in stock", "on hand"],
  price: ["price", "rate", "cost", "dp", "dealer price", "dealer", "net price", "basic"],
  mrp: ["mrp", "retail", "rsp", "retail price", "m.r.p", "m.r.p."],
  size: ["size", "wheel", "wheel size", "frame"],
};

function detectHeaderRow(rows: unknown[][]): number {
  let bestRow = 0;
  let bestScore = 0;

  for (let i = 0; i < Math.min(rows.length, 8); i++) {
    const row = rows[i];
    if (!row || !Array.isArray(row)) continue;
    let score = 0;
    for (const cell of row) {
      const val = String(cell || "").toLowerCase().trim();
      for (const keywords of Object.values(HEADER_KEYWORDS)) {
        if (keywords.some((kw) => val.includes(kw))) {
          score++;
          break;
        }
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestRow = i;
    }
  }
  return bestRow;
}

function mapColumns(headers: string[]): ColumnMap {
  const map: ColumnMap = { sku: null, name: null, category: null, qty: null, price: null, mrp: null, size: null };

  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].toLowerCase().trim();
    if (!h) continue;

    for (const [key, keywords] of Object.entries(HEADER_KEYWORDS)) {
      if (map[key as keyof ColumnMap] !== null) continue;
      if (keywords.some((kw) => h.includes(kw))) {
        map[key as keyof ColumnMap] = i;
        break;
      }
    }
  }

  return map;
}

function toNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  const n = Number(String(val).replace(/[₹,\s]/g, ""));
  return isNaN(n) ? null : n;
}

export function parseExcelBuffer(buffer: ArrayBuffer, fileName: string): ParsedItem[] {
  const isCSV = fileName.toLowerCase().endsWith(".csv");

  let workbook;
  if (isCSV) {
    const decoder = new TextDecoder("utf-8");
    const text = decoder.decode(buffer);
    workbook = XLSX.read(text, { type: "string" });
  } else {
    workbook = XLSX.read(buffer, { type: "array" });
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("No sheets found in file");

  const sheet = workbook.Sheets[sheetName];
  const rawData: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  if (rawData.length < 2) throw new Error("File has fewer than 2 rows");

  const headerRowIndex = detectHeaderRow(rawData);
  const headers = (rawData[headerRowIndex] as string[]).map((h) => String(h || "").trim());
  const colMap = mapColumns(headers);

  if (colMap.name === null) {
    throw new Error("Could not detect a product name column. Make sure your sheet has a column with 'Name', 'Product', 'Item', or 'Description' in the header.");
  }

  const items: ParsedItem[] = [];
  for (let i = headerRowIndex + 1; i < Math.min(rawData.length, 1000); i++) {
    const row = rawData[i] as unknown[];
    if (!row) continue;

    const rawName = String(row[colMap.name!] || "").trim();
    if (!rawName) continue;

    const qty = colMap.qty !== null ? toNumber(row[colMap.qty]) : null;
    if (qty !== null && qty <= 0) continue;

    items.push({
      rawSku: colMap.sku !== null ? String(row[colMap.sku] || "").trim() || null : null,
      rawName,
      rawCategory: colMap.category !== null ? String(row[colMap.category] || "").trim() || null : null,
      brandAvailableQty: qty ?? 0,
      brandPrice: colMap.price !== null ? toNumber(row[colMap.price]) : null,
      brandMrp: colMap.mrp !== null ? toNumber(row[colMap.mrp]) : null,
      rawSize: colMap.size !== null ? String(row[colMap.size] || "").trim() || null : null,
    });
  }

  if (items.length === 0) throw new Error("No valid data rows found after header detection");

  return items;
}
