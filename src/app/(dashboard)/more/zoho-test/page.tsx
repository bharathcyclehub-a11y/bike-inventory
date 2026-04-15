"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function ZohoTestPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role || "";
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ totalItemsInPage: number; hasMore: boolean; samples: Array<Record<string, unknown>> } | null>(null);
  const [error, setError] = useState("");

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
    </div>
  );
}
