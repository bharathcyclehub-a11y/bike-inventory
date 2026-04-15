"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ArrowLeft, Loader2, AlertTriangle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { exportToExcel, type ExportColumn } from "@/lib/export";

const IMPORT_COLS: ExportColumn[] = [
  { header: "SKU", key: "sku" },
  { header: "Product Name", key: "name" },
  { header: "Brand", key: "brand" },
  { header: "Cost Price", key: "costPrice" },
  { header: "Selling Price", key: "sellingPrice" },
  { header: "Stock", key: "stock" },
  { header: "GST %", key: "gst" },
  { header: "HSN", key: "hsn" },
  { header: "Type", key: "type" },
];

export default function ZohoTestPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role || "";
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ totalActiveInPage: number; activeWithStock: number; hasMore: boolean; samples: Array<Record<string, unknown>> } | null>(null);
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ zohoTotal: number; activeWithStock: number; imported: number; failed: number; importedItems: Array<Record<string, unknown>> } | null>(null);
  const [importError, setImportError] = useState("");

  if (role !== "ADMIN") {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Admin access required</p>
      </div>
    );
  }

  async function fetchTest() {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/zoho/test-items");
      const data = await res.json();
      if (data.success) {
        setResult(data.data);
      } else {
        setError(data.error || "Unknown error");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Link href="/more/zoho" className="p-1"><ArrowLeft className="h-5 w-5 text-slate-600" /></Link>
        <h1 className="text-lg font-bold text-slate-900">Zoho Import</h1>
      </div>

      {/* ---- STEP 1: Test Pull ---- */}
      <Card className="mb-4">
        <CardContent className="p-3">
          <p className="text-sm font-semibold text-slate-900 mb-1">Step 1: Preview</p>
          <p className="text-xs text-slate-500 mb-3">
            Pulls 5 sample items from Zoho (stock &gt; 0 only) to verify available fields.
          </p>
          <Button onClick={fetchTest} disabled={loading} size="sm" className="w-full">
            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Pulling...</> : "Pull 5 Samples (stock > 0)"}
          </Button>
        </CardContent>
      </Card>

      {error && (
        <Card className="mb-3 border-red-200 bg-red-50">
          <CardContent className="p-3">
            <p className="text-sm text-red-700 font-medium">Error: {error}</p>
          </CardContent>
        </Card>
      )}

      {/* ---- STEP 2: Clean Import ---- */}
      <Card className="mb-4 border-yellow-200">
        <CardContent className="p-3">
          <p className="text-sm font-semibold text-slate-900 mb-1">Step 2: Clean Import</p>
          <div className="flex gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
            <div className="text-xs text-yellow-800">
              <p>Deletes ALL products, transactions, serial items, stock counts.</p>
              <p>Re-imports ONLY items with stock &gt; 0. Creates brands automatically.</p>
              <p className="font-semibold mt-1">Safe: Users, vendors, POs, bills, payments, bins</p>
            </div>
          </div>

          {importError && (
            <Card className="mb-3 border-red-200 bg-red-50">
              <CardContent className="p-2">
                <p className="text-xs text-red-700 font-medium">Error: {importError}</p>
              </CardContent>
            </Card>
          )}

          {importResult && (
            <Card className="mb-3 border-green-200 bg-green-50">
              <CardContent className="p-2">
                <p className="text-xs font-semibold text-green-800 mb-1">Import Complete</p>
                <div className="grid grid-cols-2 gap-1 text-xs text-green-700">
                  <div>Zoho Total: <span className="font-medium">{importResult.zohoTotal}</span></div>
                  <div>Active (stock&gt;0): <span className="font-medium">{importResult.activeWithStock}</span></div>
                  <div>Imported: <span className="font-medium">{importResult.imported}</span></div>
                  <div>Failed: <span className="font-medium">{importResult.failed}</span></div>
                </div>
                {importResult.importedItems?.length > 0 && (
                  <Button variant="outline" size="sm" className="w-full mt-2"
                    onClick={() => exportToExcel(importResult.importedItems, IMPORT_COLS, `zoho-import-${new Date().toISOString().slice(0, 10)}`)}>
                    <Download className="h-3.5 w-3.5 mr-1" /> Download Import Log (Excel)
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          <Button
            variant="destructive"
            size="sm"
            className="w-full"
            disabled={importing}
            onClick={async () => {
              if (!confirm("DELETE all products and re-import from Zoho? This cannot be undone.")) return;
              if (!confirm("Are you SURE? All stock counts, transactions, and serial items will be deleted.")) return;
              setImporting(true);
              setImportError("");
              setImportResult(null);
              try {
                const res = await fetch("/api/zoho/import/clean", { method: "POST" });
                const data = await res.json();
                if (data.success) {
                  setImportResult(data.data);
                } else {
                  setImportError(data.error || "Import failed");
                }
              } catch (err) {
                setImportError(err instanceof Error ? err.message : "Failed");
              } finally {
                setImporting(false);
              }
            }}
          >
            {importing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Importing... (may take minutes)</> : "Delete All & Re-Import from Zoho"}
          </Button>
        </CardContent>
      </Card>

      {/* ---- Sample Results ---- */}
      {result && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-slate-700">
            Active in page: {result.totalActiveInPage} | With stock: {result.activeWithStock} | Showing {result.samples.length} samples
          </p>

          {(result.samples || []).map((item, i) => (
            <Card key={i}>
              <CardContent className="p-3">
                <p className="text-sm font-medium text-slate-900 mb-1">{String(item.name)}</p>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <div><span className="text-slate-500">SKU:</span> {String(item.sku || "—")}</div>
                  <div><span className="text-slate-500">Brand:</span> <span className="font-medium text-blue-600">{String(item.brand || "—")}</span></div>
                  <div><span className="text-slate-500">Manufacturer:</span> <span className="font-medium text-blue-600">{String(item.manufacturer || "—")}</span></div>
                  <div><span className="text-slate-500">Cost:</span> {String(item.cost_price || "—")}</div>
                  <div><span className="text-slate-500">Selling:</span> {String(item.selling_price || "—")}</div>
                  <div><span className="text-slate-500">Stock:</span> <span className="font-medium text-green-600">{String(item.stock_on_hand || "—")}</span></div>
                  <div><span className="text-slate-500">GST:</span> {String(item.gst || "—")}%</div>
                  <div><span className="text-slate-500">HSN:</span> {String(item.hsn || "—")}</div>
                </div>
                <details className="mt-2">
                  <summary className="text-[10px] text-slate-400 cursor-pointer">All raw Zoho fields</summary>
                  <pre className="mt-1 text-[10px] bg-slate-50 p-2 rounded overflow-x-auto max-h-48 whitespace-pre-wrap">
                    {JSON.stringify(item._raw, null, 2)}
                  </pre>
                </details>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
