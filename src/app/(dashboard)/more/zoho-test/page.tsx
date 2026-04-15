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
  const [result, setResult] = useState<{ totalActiveItems: number; willBeImported: number; samples: Array<Record<string, unknown>> } | null>(null);
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ zohoTotal: number; activeWithStock: number; imported: number; failed: number; importedItems: Array<Record<string, unknown>> } | null>(null);
  const [importError, setImportError] = useState("");
  const [enriching, setEnriching] = useState(false);
  const [enrichResult, setEnrichResult] = useState<{ processed: number; updated: number; failed: number; remaining: number; enriched: Array<{ name: string; brand: string; gst: number }>; errors?: string[] } | null>(null);
  const [enrichError, setEnrichError] = useState("");
  const [enrichTotal, setEnrichTotal] = useState(0);
  const [autoEnriching, setAutoEnriching] = useState(false);
  const [autoEnrichLog, setAutoEnrichLog] = useState<string[]>([]);
  const [stopRequested, setStopRequested] = useState(false);

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

      {/* ---- STEP 3: Brand Enrichment ---- */}
      <Card className="mb-4 border-blue-200">
        <CardContent className="p-3">
          <p className="text-sm font-semibold text-slate-900 mb-1">Step 3: Enrich Brands from Zoho</p>
          <div className="text-xs text-slate-500 mb-3">
            <p>Fetches brand, manufacturer & GST from Zoho detail API for &quot;Unbranded&quot; items.</p>
            <p>15 items per batch with throttling. Use &quot;Auto-Enrich All&quot; to run hands-free.</p>
          </div>

          {enrichError && (
            <Card className="mb-3 border-red-200 bg-red-50">
              <CardContent className="p-2">
                <p className="text-xs text-red-700 font-medium">Error: {enrichError}</p>
              </CardContent>
            </Card>
          )}

          {enrichResult && (
            <Card className="mb-3 border-blue-200 bg-blue-50">
              <CardContent className="p-2">
                <p className="text-xs font-semibold text-blue-800 mb-1">
                  {autoEnriching ? "Auto-Enriching..." : "Batch Complete"}
                </p>
                <div className="grid grid-cols-2 gap-1 text-xs text-blue-700">
                  <div>Processed: <span className="font-medium">{enrichResult.processed}</span></div>
                  <div>Updated: <span className="font-medium">{enrichResult.updated}</span></div>
                  <div>Failed: <span className="font-medium">{enrichResult.failed}</span></div>
                  <div>Remaining: <span className="font-medium text-orange-600">{enrichResult.remaining}</span></div>
                  {enrichTotal > 0 && <div className="col-span-2">Total enriched so far: <span className="font-medium text-green-600">{enrichTotal}</span></div>}
                </div>
                {enrichResult.errors && enrichResult.errors.length > 0 && (
                  <div className="mt-2 space-y-0.5">
                    <p className="text-[10px] font-medium text-red-600">Errors:</p>
                    {enrichResult.errors.map((e, i) => (
                      <p key={i} className="text-[10px] text-red-500 truncate">{e}</p>
                    ))}
                  </div>
                )}
                {enrichResult.enriched.length > 0 && !autoEnriching && (
                  <div className="mt-2 space-y-0.5">
                    <p className="text-[10px] font-medium text-blue-800">This batch:</p>
                    {enrichResult.enriched.map((e, i) => (
                      <p key={i} className="text-[10px] text-blue-700 truncate">
                        {e.name} → <span className="font-medium">{e.brand}</span> {e.gst > 0 && `(GST: ${e.gst}%)`}
                      </p>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Auto-enrich log */}
          {autoEnrichLog.length > 0 && (
            <Card className="mb-3 border-slate-200 bg-slate-50">
              <CardContent className="p-2 max-h-32 overflow-y-auto">
                <p className="text-[10px] font-medium text-slate-600 mb-1">Log:</p>
                {autoEnrichLog.map((log, i) => (
                  <p key={i} className="text-[10px] text-slate-500">{log}</p>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1"
              disabled={enriching || autoEnriching}
              onClick={async () => {
                setEnriching(true);
                setEnrichError("");
                try {
                  const res = await fetch("/api/zoho/import/enrich-brands", { method: "POST" });
                  const data = await res.json();
                  if (data.success) {
                    setEnrichResult(data.data);
                    setEnrichTotal((prev) => prev + (data.data.updated || 0));
                  } else {
                    setEnrichError(data.error || "Enrichment failed");
                  }
                } catch (err) {
                  setEnrichError(err instanceof Error ? err.message : "Failed");
                } finally {
                  setEnriching(false);
                }
              }}
            >
              {enriching ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enriching...</> : "Next 15"}
            </Button>

            {!autoEnriching ? (
              <Button
                size="sm"
                variant="default"
                className="flex-1 bg-green-600 hover:bg-green-700"
                disabled={enriching}
                onClick={async () => {
                  setAutoEnriching(true);
                  setStopRequested(false);
                  setAutoEnrichLog([]);
                  setEnrichError("");
                  let batch = 1;
                  let totalUpdated = enrichTotal;
                  let remaining = Infinity;

                  while (remaining > 0) {
                    // Check stop flag via a ref-like pattern
                    // We use a hidden input to communicate stop
                    const stopEl = document.getElementById("stop-flag") as HTMLInputElement | null;
                    if (stopEl?.value === "true") {
                      setAutoEnrichLog((prev) => [...prev, `Stopped by user after batch ${batch - 1}`]);
                      break;
                    }

                    try {
                      const res = await fetch("/api/zoho/import/enrich-brands", { method: "POST" });
                      const data = await res.json();
                      if (data.success) {
                        const d = data.data;
                        remaining = d.remaining;
                        totalUpdated += d.updated || 0;
                        setEnrichResult(d);
                        setEnrichTotal(totalUpdated);
                        setAutoEnrichLog((prev) => [
                          ...prev,
                          `Batch ${batch}: ${d.updated} updated, ${d.remaining} remaining`,
                        ]);
                        batch++;

                        if (remaining === 0) {
                          setAutoEnrichLog((prev) => [...prev, "All done! No items remaining."]);
                          break;
                        }

                        // Wait 3s between batches to be safe with rate limits
                        await new Promise((r) => setTimeout(r, 3000));
                      } else {
                        setEnrichError(data.error || "Batch failed");
                        setAutoEnrichLog((prev) => [...prev, `Error at batch ${batch}: ${data.error}`]);
                        // Wait longer on error, then retry
                        await new Promise((r) => setTimeout(r, 10000));
                      }
                    } catch (err) {
                      const msg = err instanceof Error ? err.message : "Network error";
                      setAutoEnrichLog((prev) => [...prev, `Error at batch ${batch}: ${msg}. Retrying in 15s...`]);
                      await new Promise((r) => setTimeout(r, 15000));
                    }
                  }

                  setAutoEnriching(false);
                }}
              >
                Auto-Enrich All
              </Button>
            ) : (
              <Button
                size="sm"
                variant="destructive"
                className="flex-1"
                onClick={() => {
                  const stopEl = document.getElementById("stop-flag") as HTMLInputElement | null;
                  if (stopEl) stopEl.value = "true";
                  setStopRequested(true);
                }}
              >
                {stopRequested ? "Stopping..." : "Stop"}
              </Button>
            )}
          </div>
          <input type="hidden" id="stop-flag" value="false" />
        </CardContent>
      </Card>

      {/* ---- Sample Results ---- */}
      {result && (
        <div className="space-y-3">
          <Card className="mb-3 border-blue-200 bg-blue-50">
            <CardContent className="p-2">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-center">
                  <p className="text-2xl font-bold text-slate-900">{result.totalActiveItems}</p>
                  <p className="text-[10px] text-slate-500">Total Active in Zoho</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">{result.willBeImported}</p>
                  <p className="text-[10px] text-slate-500">Will Be Imported (stock &gt; 0)</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <p className="text-xs font-medium text-slate-700 mb-2">
            Showing {result.samples.length} samples with full detail:
          </p>

          {(result.samples || []).map((item, i) => (
            <Card key={i}>
              <CardContent className="p-3">
                <p className="text-sm font-medium text-slate-900 mb-1">{String(item.name)}</p>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <div><span className="text-slate-500">SKU:</span> {String(item.sku || "—")}</div>
                  <div><span className="text-slate-500">Cost:</span> {String(item.cost_price || "—")}</div>
                  <div><span className="text-slate-500">Selling:</span> {String(item.selling_price || "—")}</div>
                  <div><span className="text-slate-500">Stock:</span> <span className="font-medium text-green-600">{String(item.stock_on_hand || "—")}</span></div>
                  <div><span className="text-slate-500">HSN:</span> {String(item.hsn || "—")}</div>
                </div>
                <div className="mt-2 p-2 bg-blue-50 rounded text-xs space-y-0.5">
                  <p className="font-semibold text-blue-800 text-[10px]">DETAIL API FIELDS (fetched per item)</p>
                  <div><span className="text-slate-500">Brand:</span> <span className="font-bold text-blue-600">{String(item.detail_brand || "—")}</span></div>
                  <div><span className="text-slate-500">Manufacturer:</span> <span className="font-bold text-blue-600">{String(item.detail_manufacturer || "—")}</span></div>
                  <div><span className="text-slate-500">Category:</span> <span className="font-bold text-purple-600">{String(item.detail_category || "—")}</span></div>
                </div>
                <details className="mt-2">
                  <summary className="text-[10px] text-slate-400 cursor-pointer">Full raw detail from Zoho</summary>
                  <pre className="mt-1 text-[10px] bg-slate-50 p-2 rounded overflow-x-auto max-h-60 whitespace-pre-wrap">
                    {JSON.stringify(item._raw_detail || item._raw, null, 2)}
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
