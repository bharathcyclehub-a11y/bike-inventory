"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, QrCode } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Product {
  id: string;
  name: string;
  sku: string;
  currentStock: number;
}

interface SerialItem {
  id: string;
  serialCode: string;
  status: string;
  condition: string;
}

export default function NewOutwardPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [notes, setNotes] = useState("");
  const [availableSerials, setAvailableSerials] = useState<SerialItem[]>([]);
  const [selectedSerials, setSelectedSerials] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (search.length < 2) { setProducts([]); return; }
    fetch(`/api/products?search=${encodeURIComponent(search)}&limit=10`)
      .then((r) => r.json())
      .then((res) => { if (res.success) setProducts(res.data); })
      .catch(() => {});
  }, [search]);

  useEffect(() => {
    if (!selectedProduct) { setAvailableSerials([]); return; }
    fetch(`/api/serials?productId=${selectedProduct.id}&status=IN_STOCK`)
      .then((r) => r.json())
      .then((res) => { if (res.success) setAvailableSerials(res.data); })
      .catch(() => {});
  }, [selectedProduct]);

  function toggleSerial(serialCode: string) {
    setSelectedSerials((prev) =>
      prev.includes(serialCode) ? prev.filter((c) => c !== serialCode) : [...prev, serialCode]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProduct || !quantity) return;

    const qty = parseInt(quantity, 10);
    if (qty > selectedProduct.currentStock) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/inventory/outwards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selectedProduct.id,
          quantity: qty,
          referenceNo: referenceNo || undefined,
          notes: notes || undefined,
          customerName: customerName || undefined,
          serialCodes: selectedSerials.length > 0 ? selectedSerials : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) router.push("/outwards");
    } catch {
      // handle silently
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Link href="/outwards" className="p-1"><ArrowLeft className="h-5 w-5 text-slate-600" /></Link>
        <h1 className="text-lg font-bold text-slate-900">Record Outward</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Product *</label>
          {selectedProduct ? (
            <Card className="bg-orange-50 border-orange-200">
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900">{selectedProduct.name}</p>
                  <p className="text-xs text-slate-500">{selectedProduct.sku} | Available: <span className="font-semibold text-green-600">{selectedProduct.currentStock}</span></p>
                </div>
                <button type="button" onClick={() => { setSelectedProduct(null); setSearch(""); setSelectedSerials([]); setAvailableSerials([]); }} className="text-xs text-orange-600 font-medium">Change</button>
              </CardContent>
            </Card>
          ) : (
            <div className="relative">
              <Input placeholder="Search by name or SKU..." value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
              {products.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {products.map((p) => (
                    <button key={p.id} type="button" onClick={() => { setSelectedProduct(p); setSearch(""); setProducts([]); }}
                      className="w-full text-left px-3 py-2.5 hover:bg-slate-50 border-b border-slate-100 last:border-0">
                      <p className="text-sm font-medium text-slate-900">{p.name}</p>
                      <p className="text-xs text-slate-500">{p.sku} | Available: {p.currentStock}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Quantity *</label>
          <Input type="number" placeholder="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} min="1" max={selectedProduct?.currentStock} className="text-lg" />
          {selectedProduct && quantity && parseInt(quantity) > selectedProduct.currentStock && (
            <p className="mt-1 text-xs text-red-600">Exceeds available stock ({selectedProduct.currentStock})</p>
          )}
        </div>

        {availableSerials.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              <QrCode className="h-3.5 w-3.5 inline mr-1" />Select Serial Items
            </label>
            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {availableSerials.map((s) => (
                <button key={s.id} type="button" onClick={() => toggleSerial(s.serialCode)}
                  className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                    selectedSerials.includes(s.serialCode) ? "border-orange-400 bg-orange-50" : "border-slate-200 bg-white"
                  }`}>
                  <span className="font-mono text-xs">{s.serialCode}</span>
                  <Badge variant={s.condition === "NEW" ? "success" : "warning"} className="ml-2">{s.condition}</Badge>
                </button>
              ))}
            </div>
            {selectedSerials.length > 0 && (
              <p className="mt-1 text-xs text-orange-600">{selectedSerials.length} serial items selected</p>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Customer Name</label>
          <Input placeholder="Customer name (optional)" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Sale Invoice / Reference</label>
          <Input placeholder="SALE-XXXX" value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
          <textarea placeholder="Any additional notes..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
            className="flex w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900" />
        </div>

        <Button type="submit" size="lg" disabled={!selectedProduct || !quantity || submitting} className="w-full bg-orange-500 hover:bg-orange-600">
          {submitting ? "Recording..." : "Record Outward"}
        </Button>
      </form>
    </div>
  );
}
