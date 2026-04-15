"use client";

import { use, useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ArrowLeft, QrCode, MapPin, Tag, Package, IndianRupee, Pencil, Save, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const role = (session?.user as { role?: string })?.role || "";
  const isAdmin = role === "ADMIN";
  const canEdit = ["ADMIN", "MANAGER"].includes(role);
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editData, setEditData] = useState({ name: "", color: "", size: "", sellingPrice: 0, mrp: 0, reorderLevel: 0 });

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

  function startEdit() {
    setEditData({
      name: product!.name,
      color: (product as unknown as Record<string, string>).color || "",
      size: product!.size || "",
      sellingPrice: product!.sellingPrice,
      mrp: product!.mrp,
      reorderLevel: product!.reorderLevel,
    });
    setEditing(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editData),
      });
      const data = await res.json();
      if (data.success) {
        setProduct({ ...product!, ...editData });
        setEditing(false);
      }
    } catch { /* */ }
    finally { setSaving(false); }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Link href="/stock" className="p-1"><ArrowLeft className="h-5 w-5 text-slate-600" /></Link>
        <h1 className="text-lg font-bold text-slate-900 truncate flex-1">{product.name}</h1>
        {canEdit && !editing && (
          <button onClick={startEdit} className="p-2 rounded-lg hover:bg-slate-100">
            <Pencil className="h-4 w-4 text-slate-500" />
          </button>
        )}
      </div>

      {editing && (
        <Card className="mb-4 border-blue-200 bg-blue-50">
          <CardContent className="p-3 space-y-2">
            <p className="text-xs font-semibold text-blue-800 mb-1">Edit Product</p>
            <div>
              <label className="text-[10px] text-slate-500">Name</label>
              <Input value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-500">Size</label>
                <Input value={editData.size} onChange={(e) => setEditData({ ...editData, size: e.target.value })} placeholder='e.g. 26"' />
              </div>
              <div>
                <label className="text-[10px] text-slate-500">Color</label>
                <Input value={editData.color} onChange={(e) => setEditData({ ...editData, color: e.target.value })} placeholder="e.g. Red" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-slate-500">Selling Price</label>
                <Input type="number" value={editData.sellingPrice} onChange={(e) => setEditData({ ...editData, sellingPrice: Number(e.target.value) })} />
              </div>
              <div>
                <label className="text-[10px] text-slate-500">MRP</label>
                <Input type="number" value={editData.mrp} onChange={(e) => setEditData({ ...editData, mrp: Number(e.target.value) })} />
              </div>
              <div>
                <label className="text-[10px] text-slate-500">Reorder Level</label>
                <Input type="number" value={editData.reorderLevel} onChange={(e) => setEditData({ ...editData, reorderLevel: Number(e.target.value) })} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700">
                <Save className="h-3.5 w-3.5 mr-1" />{saving ? "Saving..." : "Save"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(false)} className="flex-1">
                <X className="h-3.5 w-3.5 mr-1" />Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Identity badges */}
      <div className="flex flex-wrap gap-2 mb-3">
        <Badge variant="info">{product.sku}</Badge>
        {product.brand && <Badge variant="default" className="font-semibold">{product.brand.name}</Badge>}
        {product.category && <Badge variant="default">{product.category.name}</Badge>}
        {product.type === "BICYCLE" && product.size && <Badge variant="default">{product.size}</Badge>}
        {product.condition !== "NEW" && <Badge variant="warning">{product.condition.replace("_", " ")}</Badge>}
      </div>

      {/* Stock + Location combined card (most important info first) */}
      <Card className="mb-3">
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-4 text-center mb-3">
            <div>
              <p className={`text-2xl font-bold ${
                product.currentStock <= 0 ? "text-red-600" :
                product.reorderLevel > 0 && product.currentStock <= product.reorderLevel ? "text-yellow-600" : "text-green-600"
              }`}>{product.currentStock}</p>
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
          {product.bin ? (
            <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
              <MapPin className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-sm font-medium text-slate-900">
                  <span className="font-mono">{product.bin.code}</span> — {product.bin.name}
                </p>
                <p className="text-xs text-slate-500">{product.bin.location}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
              <MapPin className="h-4 w-4 text-slate-300" />
              <p className="text-xs text-slate-400">No bin assigned</p>
            </div>
          )}
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
