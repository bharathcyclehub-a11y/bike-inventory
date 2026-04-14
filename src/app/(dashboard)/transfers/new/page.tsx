"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, ArrowRightLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

interface Product {
  id: string;
  name: string;
  sku: string;
  currentStock: number;
  bin: { id: string; code: string; location: string } | null;
}

interface Bin {
  id: string;
  code: string;
  name: string;
  location: string;
}

export default function NewTransferPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const isAdmin = (session?.user as { role?: string })?.role === "ADMIN";

  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [bins, setBins] = useState<Bin[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState("");
  const [fromBinId, setFromBinId] = useState("");
  const [toBinId, setToBinId] = useState("");
  const [notes, setNotes] = useState("");
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

  function selectProduct(p: Product) {
    setSelectedProduct(p);
    setSearch("");
    setProducts([]);
    if (p.bin?.id) setFromBinId(p.bin.id);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const qty = parseInt(quantity, 10);
    if (!selectedProduct || !qty || qty <= 0 || !fromBinId || !toBinId) return;

    if (fromBinId === toBinId) {
      setError("Source and destination bins must be different.");
      return;
    }

    if (qty > selectedProduct.currentStock) {
      setError(`Insufficient stock. Available: ${selectedProduct.currentStock}`);
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selectedProduct.id,
          quantity: qty,
          fromBinId,
          toBinId,
          notes: notes || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) router.push("/transfers");
      else setError(data.error || "Failed to create transfer.");
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Link href="/transfers" className="p-1"><ArrowLeft className="h-5 w-5 text-slate-600" /></Link>
        <h1 className="text-lg font-bold text-slate-900">New Transfer</h1>
      </div>

      {!isAdmin && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
          <p className="text-xs text-amber-700">Transfers created by non-admin users require admin approval before stock is moved.</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Product Search */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Product *</label>
          {selectedProduct ? (
            <Card className="bg-purple-50 border-purple-200">
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900">{selectedProduct.name}</p>
                  <p className="text-xs text-slate-500">
                    {selectedProduct.sku} | Stock: {selectedProduct.currentStock}
                    {selectedProduct.bin ? ` | Bin: ${selectedProduct.bin.code}` : ""}
                  </p>
                </div>
                <button type="button" onClick={() => { setSelectedProduct(null); setSearch(""); setFromBinId(""); }}
                  className="text-xs text-purple-600 font-medium">Change</button>
              </CardContent>
            </Card>
          ) : (
            <div className="relative">
              <Input placeholder="Search by name or SKU..." value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
              {products.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {products.map((p) => (
                    <button key={p.id} type="button" onClick={() => selectProduct(p)}
                      className="w-full text-left px-3 py-2.5 hover:bg-slate-50 border-b border-slate-100 last:border-0">
                      <p className="text-sm font-medium text-slate-900">{p.name}</p>
                      <p className="text-xs text-slate-500">{p.sku} | Stock: {p.currentStock}{p.bin ? ` | Bin: ${p.bin.code}` : ""}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quantity */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Quantity *</label>
          <Input type="number" placeholder="0" value={quantity} onChange={(e) => setQuantity(e.target.value)}
            min="1" max={selectedProduct?.currentStock || undefined} className="text-lg" />
          {selectedProduct && (
            <p className="text-xs text-slate-400 mt-1">Available: {selectedProduct.currentStock}</p>
          )}
        </div>

        {/* From Bin */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">From Bin (Source) *</label>
          <select value={fromBinId} onChange={(e) => setFromBinId(e.target.value)}
            className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-600">
            <option value="">Select source bin...</option>
            {bins.map((b) => (
              <option key={b.id} value={b.id}>{b.code} - {b.location} ({b.name})</option>
            ))}
          </select>
          {selectedProduct?.bin && (
            <p className="text-xs text-slate-400 mt-1">Current bin: {selectedProduct.bin.code} ({selectedProduct.bin.location})</p>
          )}
        </div>

        {/* To Bin */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">To Bin (Destination) *</label>
          <select value={toBinId} onChange={(e) => setToBinId(e.target.value)}
            className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-600">
            <option value="">Select destination bin...</option>
            {bins.filter((b) => b.id !== fromBinId).map((b) => (
              <option key={b.id} value={b.id}>{b.code} - {b.location} ({b.name})</option>
            ))}
          </select>
        </div>

        {/* Transfer Preview */}
        {fromBinId && toBinId && (
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-slate-700">
                {bins.find((b) => b.id === fromBinId)?.code || "—"}
              </span>
              <ArrowRightLeft className="h-4 w-4 text-purple-500 shrink-0" />
              <span className="font-medium text-slate-700">
                {bins.find((b) => b.id === toBinId)?.code || "—"}
              </span>
            </div>
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
          <textarea placeholder="Reason for transfer..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
            className="flex w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-600" />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button type="submit" size="lg"
          disabled={!selectedProduct || !quantity || !fromBinId || !toBinId || submitting}
          className="w-full bg-purple-600 hover:bg-purple-700">
          {submitting ? "Creating..." : isAdmin ? "Transfer Now" : "Request Transfer"}
        </Button>
      </form>
    </div>
  );
}
