"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ArrowLeft, QrCode } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

interface Product {
  id: string;
  name: string;
  sku: string;
  currentStock: number;
  bin: { code: string } | null;
}

interface Bin {
  id: string;
  code: string;
  name: string;
  location: string;
}

export default function NewInwardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const role = (session?.user as { role?: string })?.role || "";

  // Only ADMIN can manually record inwards — staff use Zoho verification flow
  useEffect(() => {
    if (session && role !== "ADMIN") router.replace("/inwards");
  }, [session, role, router]);

  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [bins, setBins] = useState<Bin[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [binId, setBinId] = useState("");
  const [notes, setNotes] = useState("");
  const [serialTracking, setSerialTracking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/bins")
      .then((r) => r.json())
      .then((res) => { if (res.success) setBins(res.data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (search.length < 1) { setProducts([]); return; }
    fetch(`/api/products?search=${encodeURIComponent(search)}&limit=10`)
      .then((r) => r.json())
      .then((res) => { if (res.success) setProducts(res.data); })
      .catch(() => {});
  }, [search]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const qty = parseInt(quantity, 10);
    if (!selectedProduct || !qty || qty <= 0) return;

    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/inventory/inwards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selectedProduct.id,
          quantity: qty,
          referenceNo: referenceNo || undefined,
          notes: notes || undefined,
          serialTracking,
          binId: binId || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) router.push("/inwards");
      else setError(data.error || "Failed to record inward. Please try again.");
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Link href="/inwards" className="p-1"><ArrowLeft className="h-5 w-5 text-slate-600" /></Link>
        <h1 className="text-lg font-bold text-slate-900">Record Inward</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Product *</label>
          {selectedProduct ? (
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900">{selectedProduct.name}</p>
                  <p className="text-xs text-slate-500">{selectedProduct.sku} | Stock: {selectedProduct.currentStock} | Bin: {selectedProduct.bin?.code || "Unassigned"}</p>
                </div>
                <button type="button" onClick={() => { setSelectedProduct(null); setSearch(""); }} className="text-xs text-blue-600 font-medium">Change</button>
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
                      <p className="text-xs text-slate-500">{p.sku} | Stock: {p.currentStock}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Quantity *</label>
          <Input type="number" placeholder="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} min="1" className="text-lg" />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Invoice / Challan No</label>
          <Input placeholder="INV-2024-XXXX" value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Bin Location</label>
          <select value={binId} onChange={(e) => setBinId(e.target.value)}
            className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900">
            <option value="">Select bin...</option>
            {bins.map((b) => (<option key={b.id} value={b.id}>{b.code} - {b.location} ({b.name})</option>))}
          </select>
        </div>

        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-2">
            <QrCode className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-medium text-slate-700">Serial Tracking</span>
          </div>
          <button type="button" onClick={() => setSerialTracking(!serialTracking)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${serialTracking ? "bg-blue-600" : "bg-slate-300"}`}>
            <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${serialTracking ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>

        {serialTracking && (
          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-xs text-blue-700 mb-1 font-medium">Serial codes will be auto-generated</p>
            <p className="text-xs text-blue-600">Format: {selectedProduct?.sku || "SKU"}-0001, {selectedProduct?.sku || "SKU"}-0002, ...</p>
            <p className="text-xs text-blue-600 mt-1">{quantity ? `${quantity} serial items will be created` : "Enter quantity first"}</p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
          <textarea placeholder="Any additional notes..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
            className="flex w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900" />
        </div>

        {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
        <Button type="submit" size="lg" disabled={!selectedProduct || !quantity || submitting} className="w-full bg-blue-600 hover:bg-blue-700">
          {submitting ? "Recording..." : "Record Inward"}
        </Button>
      </form>
    </div>
  );
}
