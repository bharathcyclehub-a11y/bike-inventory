"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, ArrowRight, Search, Plus, Trash2, Package, Loader2 } from "lucide-react";
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

interface TransferItem {
  product: Product;
  quantity: number;
  fromBinId: string;
  toBinId: string;
}

const STORAGE_KEY = "transfer-order-draft";

interface DraftData {
  items: TransferItem[];
  notes: string;
}

function saveDraft(items: TransferItem[], notes: string) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ items, notes }));
  } catch { /* ignore */ }
}

function loadDraft(): DraftData | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DraftData;
  } catch { return null; }
}

function clearDraft() {
  try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

export default function NewTransferOrderPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const isAdmin = (session?.user as { role?: string })?.role === "ADMIN";

  const [bins, setBins] = useState<Bin[]>([]);
  const [items, setItems] = useState<TransferItem[]>([]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Item search state
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);

  // Load draft on mount
  useEffect(() => {
    const draft = loadDraft();
    if (draft) {
      if (draft.items?.length > 0) setItems(draft.items);
      if (draft.notes) setNotes(draft.notes);
    }
  }, []);

  // Auto-save on changes
  useEffect(() => {
    if (items.length > 0 || notes) {
      saveDraft(items, notes);
    }
  }, [items, notes]);

  useEffect(() => {
    fetch("/api/bins")
      .then((r) => r.json())
      .then((res) => { if (res.success) setBins(res.data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (search.length < 1) { setSearchResults([]); return; }
    setSearching(true);
    const timer = setTimeout(() => {
      fetch(`/api/products?search=${encodeURIComponent(search)}&limit=10`)
        .then((r) => r.json())
        .then((res) => { if (res.success) setSearchResults(res.data); })
        .catch(() => {})
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  function addItem(product: Product) {
    // Don't add duplicate product
    if (items.some((i) => i.product.id === product.id)) {
      setError(`${product.name} is already in the list`);
      setTimeout(() => setError(""), 2000);
      return;
    }
    setItems((prev) => [
      ...prev,
      {
        product,
        quantity: 1,
        fromBinId: product.bin?.id || "",
        toBinId: "",
      },
    ]);
    setSearch("");
    setSearchResults([]);
  }

  function updateItem(index: number, field: keyof TransferItem, value: string | number) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function getBinLabel(binId: string) {
    const bin = bins.find((b) => b.id === binId);
    return bin ? `${bin.code} (${bin.name})` : "";
  }

  const isValid = items.length > 0 && items.every(
    (i) => i.fromBinId && i.toBinId && i.fromBinId !== i.toBinId && i.quantity > 0 && i.quantity <= i.product.currentStock
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;

    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/transfer-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({
            productId: i.product.id,
            quantity: i.quantity,
            fromBinId: i.fromBinId,
            toBinId: i.toBinId,
          })),
          notes: notes || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) { clearDraft(); router.push("/transfers"); }
      else setError(data.error || "Failed to create transfer order.");
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="pb-32">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/transfers" className="p-1"><ArrowLeft className="h-5 w-5 text-slate-600" /></Link>
        <div>
          <h1 className="text-lg font-bold text-slate-900">New Transfer Order</h1>
          <p className="text-xs text-slate-500">
            {isAdmin ? "Auto-approved (Admin)" : "Will need Admin/Supervisor approval"}
          </p>
        </div>
      </div>

      {!isAdmin && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 mb-3">
          <p className="text-xs text-amber-700">This transfer order will be submitted for approval.</p>
        </div>
      )}

      {/* Search & Add Items */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-700 mb-1">Search & Add Items</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search product name or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 animate-spin" />
          )}

          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
              {searchResults.map((p) => (
                <button key={p.id} type="button" onClick={() => addItem(p)}
                  className="w-full text-left px-3 py-2.5 hover:bg-purple-50 border-b border-slate-100 last:border-0 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{p.name}</p>
                    <p className="text-xs text-slate-500">
                      {p.sku} | Stock: {p.currentStock}
                      {p.bin ? ` | Bin: ${p.bin.code}` : " | No bin"}
                    </p>
                  </div>
                  <Plus className="h-4 w-4 text-purple-500 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Items List */}
      {items.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-lg mb-4">
          <Package className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-400">Search and add items to transfer</p>
        </div>
      ) : (
        <div className="space-y-3 mb-4">
          <p className="text-xs font-medium text-slate-500">{items.length} item{items.length !== 1 ? "s" : ""} to transfer</p>
          {items.map((item, index) => (
            <Card key={item.product.id} className="border-purple-100">
              <CardContent className="p-3">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0 mr-2">
                    <p className="text-sm font-medium text-slate-900">{item.product.name}</p>
                    <p className="text-xs text-slate-500">{item.product.sku} | Stock: {item.product.currentStock}</p>
                  </div>
                  <button type="button" onClick={() => removeItem(index)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Quantity */}
                <div className="mb-2">
                  <label className="text-xs text-slate-500 mb-0.5 block">Qty</label>
                  <div className="flex items-center gap-2">
                    <button type="button"
                      onClick={() => updateItem(index, "quantity", Math.max(1, item.quantity - 1))}
                      disabled={item.quantity <= 1}
                      className="h-8 w-8 rounded-lg border border-slate-300 bg-white text-slate-700 text-lg font-bold flex items-center justify-center disabled:opacity-30">
                      −
                    </button>
                    <span className="h-8 min-w-[3rem] rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center text-sm font-semibold text-slate-900">
                      {item.quantity}
                    </span>
                    <button type="button"
                      onClick={() => updateItem(index, "quantity", Math.min(item.product.currentStock, item.quantity + 1))}
                      disabled={item.quantity >= item.product.currentStock}
                      className="h-8 w-8 rounded-lg border border-purple-300 bg-purple-50 text-purple-700 text-lg font-bold flex items-center justify-center disabled:opacity-30">
                      +
                    </button>
                    <span className="text-[10px] text-slate-400">/ {item.product.currentStock}</span>
                  </div>
                  {item.quantity > item.product.currentStock && (
                    <p className="text-[10px] text-red-500 mt-0.5">Exceeds available stock</p>
                  )}
                </div>

                {/* From → To Bins */}
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-slate-500 mb-0.5 block">From</label>
                    <select value={item.fromBinId} onChange={(e) => updateItem(index, "fromBinId", e.target.value)}
                      className="w-full h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-600">
                      <option value="">Select...</option>
                      {bins.map((b) => (
                        <option key={b.id} value={b.id}>{b.code} — {b.name}</option>
                      ))}
                    </select>
                  </div>
                  <ArrowRight className="h-4 w-4 text-purple-500 shrink-0 mt-4" />
                  <div className="flex-1">
                    <label className="text-xs text-slate-500 mb-0.5 block">To</label>
                    <select value={item.toBinId} onChange={(e) => updateItem(index, "toBinId", e.target.value)}
                      className="w-full h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-600">
                      <option value="">Select...</option>
                      {bins.filter((b) => b.id !== item.fromBinId).map((b) => (
                        <option key={b.id} value={b.id}>{b.code} — {b.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Route Preview */}
                {item.fromBinId && item.toBinId && item.fromBinId !== item.toBinId && (
                  <div className="bg-purple-50 rounded-lg p-1.5 mt-2 text-center">
                    <p className="text-[10px] text-purple-700 font-medium">
                      {getBinLabel(item.fromBinId)} → {getBinLabel(item.toBinId)}
                    </p>
                  </div>
                )}
                {item.fromBinId && item.toBinId && item.fromBinId === item.toBinId && (
                  <p className="text-[10px] text-red-500 mt-1">Source and destination must be different</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Notes */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-700 mb-1">Notes (optional)</label>
        <textarea placeholder="Reason for transfer..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
          className="flex w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-600" />
      </div>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      {/* Submit - fixed at bottom */}
      <div className="fixed bottom-16 left-0 right-0 bg-white border-t border-slate-200 p-4 z-50">
        <Button type="button" size="lg" disabled={!isValid || submitting} onClick={handleSubmit}
          className="w-full bg-purple-600 hover:bg-purple-700">
          {submitting ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating...</>
          ) : isAdmin ? (
            `Transfer ${items.length} Item${items.length !== 1 ? "s" : ""} Now`
          ) : (
            `Submit ${items.length} Item${items.length !== 1 ? "s" : ""} for Approval`
          )}
        </Button>
      </div>
    </div>
  );
}
