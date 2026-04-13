"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, QrCode } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface SerialItem {
  id: string;
  serialCode: string;
  status: string;
  condition: string;
  receivedAt: string;
  soldAt: string | null;
  customerName: string | null;
  saleInvoiceNo: string | null;
  product: { name: string; sku: string };
  bin: { code: string; location: string } | null;
}

export default function SerialsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [serials, setSerials] = useState<SerialItem[]>([]);
  const [productName, setProductName] = useState("");
  const [productSku, setProductSku] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/serials?productId=${id}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setSerials(res.data);
          if (res.data.length > 0) {
            setProductName(res.data[0].product.name);
            setProductSku(res.data[0].product.sku);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const inStock = serials.filter((s) => s.status === "IN_STOCK").length;
  const sold = serials.filter((s) => s.status === "SOLD").length;

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Link href={`/stock/${id}`} className="p-1"><ArrowLeft className="h-5 w-5 text-slate-600" /></Link>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-slate-900">Serial Items</h1>
          <p className="text-xs text-slate-500">{productName} ({productSku})</p>
        </div>
        <Link href={`/stock/${id}/barcode`}>
          <Button variant="outline" size="sm"><QrCode className="h-3.5 w-3.5 mr-1" />Barcodes</Button>
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-slate-100 rounded-lg p-2.5 text-center">
          <p className="text-lg font-bold text-slate-900">{serials.length}</p>
          <p className="text-[10px] text-slate-500">Total</p>
        </div>
        <div className="bg-green-50 rounded-lg p-2.5 text-center">
          <p className="text-lg font-bold text-green-600">{inStock}</p>
          <p className="text-[10px] text-slate-500">In Stock</p>
        </div>
        <div className="bg-blue-50 rounded-lg p-2.5 text-center">
          <p className="text-lg font-bold text-blue-600">{sold}</p>
          <p className="text-[10px] text-slate-500">Sold</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {serials.map((s) => (
            <Card key={s.id}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-mono font-medium">{s.serialCode}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Received: {new Date(s.receivedAt).toLocaleDateString("en-IN")}
                      {s.soldAt && ` | Sold: ${new Date(s.soldAt).toLocaleDateString("en-IN")}`}
                    </p>
                    {s.customerName && (
                      <p className="text-xs text-slate-500">Customer: {s.customerName} | Inv: {s.saleInvoiceNo}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <Badge variant={s.status === "IN_STOCK" ? "success" : s.status === "SOLD" ? "info" : s.status === "DAMAGED" ? "danger" : "warning"}>
                      {s.status.replace("_", " ")}
                    </Badge>
                    <p className="text-[10px] text-slate-400 mt-1">{s.condition}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && serials.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm text-slate-400">No serial items for this product</p>
        </div>
      )}
    </div>
  );
}
