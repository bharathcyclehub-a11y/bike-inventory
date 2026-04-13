"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ArrowLeft, Search, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface Product {
  id: string;
  name: string;
  sku: string;
  currentStock: number;
}

export default function NewStockAuditPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const user = session?.user as { userId?: string } | undefined;

  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [allProducts, setAllProducts] = useState(true);
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!allProducts) {
      fetch(`/api/products?limit=200`)
        .then((r) => r.json())
        .then((res) => { if (res.success) setProducts(res.data); })
        .catch(() => {});
    }
  }, [allProducts]);

  const filtered = products.filter(
    (p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase())
  );

  const toggleProduct = (id: string) => {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const handleSubmit = async () => {
    if (!title || !dueDate) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/stock-counts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          dueDate,
          notes: notes || undefined,
          assignedToId: user?.userId || undefined,
          productIds: allProducts ? [] : selected,
        }),
      });
      const data = await res.json();
      if (data.success) router.push(`/stock-audit/${data.data.id}`);
    } catch {
      // handle silently
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Link href="/stock-audit" className="p-1">
          <ArrowLeft className="h-5 w-5 text-slate-600" />
        </Link>
        <h1 className="text-lg font-bold text-slate-900">New Stock Audit</h1>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Title *</label>
          <Input placeholder="e.g. Monthly Stock Check - April" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div>
          <label className="text-xs text-slate-500 mb-1 block">Due Date *</label>
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>

        <div>
          <label className="text-xs text-slate-500 mb-1 block">Notes</label>
          <textarea
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 min-h-[80px]"
            placeholder="Any additional notes..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs text-slate-500 mb-2 block">Products to Count</label>
          <div className="flex gap-2">
            <button
              onClick={() => { setAllProducts(true); setSelected([]); }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                allProducts ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
              }`}>
              All Products
            </button>
            <button
              onClick={() => setAllProducts(false)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                !allProducts ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
              }`}>
              Select Products
            </button>
          </div>
        </div>

        {!allProducts && (
          <Card>
            <CardContent className="p-3">
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  className="pl-9"
                  placeholder="Search products..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {selected.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {selected.map((id) => {
                    const p = products.find((x) => x.id === id);
                    return p ? (
                      <span key={id} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded-full">
                        {p.sku}
                        <button onClick={() => toggleProduct(id)}><X className="h-3 w-3" /></button>
                      </span>
                    ) : null;
                  })}
                </div>
              )}

              <div className="max-h-48 overflow-y-auto space-y-1">
                {filtered.slice(0, 50).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => toggleProduct(p.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      selected.includes(p.id) ? "bg-blue-50 text-blue-700" : "hover:bg-slate-50"
                    }`}>
                    <span className="font-medium">{p.name}</span>
                    <span className="text-xs text-slate-500 ml-2">{p.sku} | Stock: {p.currentStock}</span>
                  </button>
                ))}
                {filtered.length === 0 && <p className="text-xs text-slate-400 text-center py-4">No products found</p>}
              </div>

              <p className="text-xs text-slate-400 mt-2">{selected.length} products selected</p>
            </CardContent>
          </Card>
        )}

        <button
          onClick={handleSubmit}
          disabled={!title || !dueDate || submitting}
          className="w-full bg-slate-900 text-white py-3 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">
          {submitting ? "Creating..." : "Create Stock Audit"}
        </button>
      </div>
    </div>
  );
}
