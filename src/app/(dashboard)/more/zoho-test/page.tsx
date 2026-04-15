"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ArrowLeft, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function ZohoTestPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role || "";
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ totalItemsInPage: number; hasMore: boolean; samples: Array<Record<string, unknown>> } | null>(null);
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<Record<string, unknown> | null>(null);
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
        <h1 className="text-lg font-bold text-slate-900">Zoho Test Pull</h1>
      </div>

      <p className="text-sm text-slate-500 mb-4">
        Pulls 5 sample items from Zoho and shows ALL raw fields. Use this to verify what data is available before doing a full import.
      </p>

      <Button onClick={fetchTest} disabled={loading} className="w-full mb-4">
        {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Pulling from Zoho...</> : "Pull 5 Sample Items"}
      </Button>

      {error && (
        <Card className="mb-4 border-red-200 bg-red-50">
          <CardContent className="p-3">
            <p className="text-sm text-red-700 font-medium">Error: {error}</p>
          </CardContent>
        </Card>
      )}

      {result && (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            Total items in first page: {result.totalItemsInPage} | Has more: {String(result.hasMore)}
          </p>

          {(result.samples || []).map((item, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{String(item.name)}</CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <div><span className="text-slate-500">SKU:</span> {String(item.sku || "—")}</div>
                  <div><span className="text-slate-500">Brand:</span> <span className="font-medium text-blue-600">{String(item.brand || "—")}</span></div>
                  <div><span className="text-slate-500">Manufacturer:</span> <span className="font-medium text-blue-600">{String(item.manufacturer || "—")}</span></div>
                  <div><span className="text-slate-500">Cost:</span> {String(item.cost_price || "—")}</div>
                  <div><span className="text-slate-500">Selling:</span> {String(item.selling_price || "—")}</div>
                  <div><span className="text-slate-500">GST:</span> {String(item.gst || "—")}%</div>
                  <div><span className="text-slate-500">HSN:</span> {String(item.hsn || "—")}</div>
                  <div><span className="text-slate-500">Stock:</span> {String(item.stock_on_hand || "—")}</div>
                  <div><span className="text-slate-500">Type:</span> {String(item.product_type || "—")}</div>
                  <div><span className="text-slate-500">Item Type:</span> {String(item.item_type || "—")}</div>
                </div>

                <details className="mt-2">
                  <summary className="text-[10px] text-slate-400 cursor-pointer">Raw Zoho fields</summary>
                  <pre className="mt-1 text-[10px] bg-slate-50 p-2 rounded overflow-x-auto max-h-48 whitespace-pre-wrap">
                    {JSON.stringify(item._raw, null, 2)}
                  </pre>
                </details>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {/* Clean Import Section */}
      <div className="mt-6 pt-6 border-t border-slate-200">
        <h2 className="text-base font-bold text-slate-900 mb-2">Clean Import from Zoho</h2>
        <Card className="mb-3 border-yellow-200 bg-yellow-50">
          <CardContent className="p-3">
            <div className="flex gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
              <div className="text-xs text-yellow-800">
                <p className="font-semibold mb-1">This will:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>DELETE all products, transactions, serial items, stock count items</li>
                  <li>Re-import ONLY items from Zoho with stock &gt; 0</li>
                  <li>Create brands from Zoho brand/manufacturer field</li>
                </ul>
                <p className="mt-1 font-semibold">Safe: Users, vendors, POs, bills, payments, bins, expenses</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {importError && (
          <Card className="mb-3 border-red-200 bg-red-50">
            <CardContent className="p-3">
              <p className="text-sm text-red-700 font-medium">Error: {importError}</p>
            </CardContent>
          </Card>
        )}

        {importResult && (
          <Card className="mb-3 border-green-200 bg-green-50">
            <CardContent className="p-3">
              <p className="text-sm font-semibold text-green-800 mb-1">Import Complete</p>
              <div className="grid grid-cols-2 gap-1 text-xs text-green-700">
                <div>Zoho Total: <span className="font-medium">{String(importResult.zohoTotal)}</span></div>
                <div>Active with Stock: <span className="font-medium">{String(importResult.activeWithStock)}</span></div>
                <div>Imported: <span className="font-medium">{String(importResult.imported)}</span></div>
                <div>Failed: <span className="font-medium">{String(importResult.failed)}</span></div>
              </div>
            </CardContent>
          </Card>
        )}

        <Button
          variant="destructive"
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
          {importing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Importing... (this may take a few minutes)</> : "Delete All & Re-Import from Zoho"}
        </Button>
      </div>
    </div>
  );
}
