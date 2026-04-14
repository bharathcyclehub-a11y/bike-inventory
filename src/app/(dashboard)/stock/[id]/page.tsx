"use client";

import { use, useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ArrowLeft, QrCode, MapPin, Tag, Package, IndianRupee } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TransactionItem } from "@/components/transaction-item";

interface SerialItem {
  id: string;
  serialCode: string;
  status: string;
  condition: string;
  bin: { code: string } | null;
}

interface Transaction {
  id: string;
  type: string;
  quantity: number;
  referenceNo: string | null;
  createdAt: string;
  user: { name: string };
}

interface ProductDetail {
  id: string;
  sku: string;
  name: string;
  type: string;
  status: string;
  condition: string;
  currentStock: number;
  reorderLevel: number;
  maxStock: number;
  costPrice: number;
  sellingPrice: number;
  mrp: number;
  gstRate: number;
  hsnCode: string | null;
  size: string | null;
  tags: string[];
  category: { name: string } | null;
  brand: { name: string } | null;
  bin: { code: string; name: string; location: string } | null;
  serialItems: SerialItem[];
  transactions: Transaction[];
}

function fmt(val: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(val);
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session } = useSession();
  const isAdmin = (session?.user as { role?: string })?.role === "ADMIN";
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/products/${id}`)
      .then((r) => r.json())
      .then((res) => { if (res.success) setProduct(res.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Product not found</p>
        <Link href="/stock" className="text-blue-600 text-sm mt-2 inline-block">Back to Stock</Link>
      </div>
    );
  }

  const inStockSerials = product.serialItems.filter((s) => s.status === "IN_STOCK");

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Link href="/stock" className="p-1"><ArrowLeft className="h-5 w-5 text-slate-600" /></Link>
        <h1 className="text-lg font-bold text-slate-900 truncate">{product.name}</h1>
      </div>

      <div className="bg-slate-100 rounded-xl h-40 flex items-center justify-center mb-4">
        <Package className="h-12 w-12 text-slate-300" />
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <Badge variant="info">{product.sku}</Badge>
        <Badge variant="default">{product.category?.name}</Badge>
        <Badge variant="default">{product.brand?.name}</Badge>
        {product.type === "BICYCLE" && product.size && <Badge variant="default">{product.size}</Badge>}
        {product.condition !== "NEW" && <Badge variant="warning">{product.condition.replace("_", " ")}</Badge>}
      </div>

      <Card className="mb-3">
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-slate-900">{product.currentStock}</p>
              <p className="text-xs text-slate-500">In Stock</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-600">{product.reorderLevel}</p>
              <p className="text-xs text-slate-500">Reorder Level</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-400">{product.maxStock}</p>
              <p className="text-xs text-slate-500">Max Stock</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-3">
        <CardHeader><CardTitle className="flex items-center gap-1.5"><IndianRupee className="h-3.5 w-3.5" /> Pricing</CardTitle></CardHeader>
        <CardContent>
          <div className={`grid ${isAdmin ? "grid-cols-3" : "grid-cols-2"} gap-3 text-sm`}>
            {isAdmin && <div><p className="text-slate-500">Cost</p><p className="font-medium">{fmt(product.costPrice)}</p></div>}
            <div><p className="text-slate-500">Selling</p><p className="font-medium">{fmt(product.sellingPrice)}</p></div>
            <div><p className="text-slate-500">MRP</p><p className="font-medium">{fmt(product.mrp)}</p></div>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            GST: {product.gstRate}% {product.hsnCode && `| HSN: ${product.hsnCode}`}
          </div>
        </CardContent>
      </Card>

      {product.bin && (
        <Card className="mb-3">
          <CardHeader><CardTitle className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Location</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm"><span className="font-mono font-medium">{product.bin.code}</span> — {product.bin.name}</p>
            <p className="text-xs text-slate-500 mt-0.5">{product.bin.location}</p>
          </CardContent>
        </Card>
      )}

      {product.serialItems.length > 0 && (
        <Card className="mb-3">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-1.5"><QrCode className="h-3.5 w-3.5" /> Serial Items ({product.serialItems.length})</CardTitle>
              <Link href={`/stock/${product.id}/serials`}><Button variant="ghost" size="sm">View All</Button></Link>
            </div>
          </CardHeader>
          <CardContent>
            {product.serialItems.slice(0, 5).map((s) => (
              <div key={s.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                <div>
                  <p className="text-sm font-mono font-medium">{s.serialCode}</p>
                  <p className="text-xs text-slate-500">{s.bin?.code || "No bin"} | {s.condition}</p>
                </div>
                <Badge variant={s.status === "IN_STOCK" ? "success" : s.status === "SOLD" ? "info" : "warning"}>
                  {s.status.replace("_", " ")}
                </Badge>
              </div>
            ))}
            {inStockSerials.length > 0 && (
              <Link href={`/stock/${product.id}/barcode`}>
                <Button variant="outline" size="sm" className="w-full mt-3">
                  <QrCode className="h-3.5 w-3.5 mr-1.5" />Generate Barcodes
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      {product.tags.length > 0 && (
        <Card className="mb-3">
          <CardHeader><CardTitle className="flex items-center gap-1.5"><Tag className="h-3.5 w-3.5" /> Tags</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {product.tags.map((tag) => (<Badge key={tag} variant="info">{tag}</Badge>))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="mb-3">
        <CardHeader><CardTitle>Recent Transactions</CardTitle></CardHeader>
        <CardContent>
          {product.transactions.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">No transactions yet</p>
          ) : (
            product.transactions.slice(0, 5).map((t) => (
              <TransactionItem
                key={t.id}
                direction={t.type === "INWARD" ? "in" : "out"}
                productName={product.name}
                sku={product.sku}
                quantity={t.quantity}
                time={formatTime(t.createdAt)}
                reference={t.referenceNo || undefined}
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
