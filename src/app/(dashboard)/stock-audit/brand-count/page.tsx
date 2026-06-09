"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ArrowLeft, Package, MapPin, Check, Loader2, ChevronDown, ChevronRight, Send } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface Brand { id: string; name: string; _count: { products: number } }
interface BinOption { id: string; code: string; name: string; location: string }
interface ProductItem {
  id: string; sku: string; name: string; type: string; size: string | null;
  currentStock: number; reorderLevel: number; reorderQty: number;
  category: { name: string } | null; brand: { name: string } | null;
}

type Step = "brand" | "bin" | "count" | "review" | "submitted";

export default function BrandCountPage() {
  const { data: session } = useSession();
  const userName = (session?.user as { name?: string })?.name || "You";

  const [step, setStep] = useState<Step>("brand");
  const [brands, setBrands] = useState<Brand[]>([]);
  const [bins, setBins] = useState<BinOption[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [selectedBin, setSelectedBin] = useState<BinOption | null>(null);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [counts, setCounts] = useState<Record<string, { qty: number | null; reorder: number | null }>>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [resultId, setResultId] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    Promise.all([
      fetch("/api/brands").then((r) => r.json()),
      fetch("/api/bins").then((r) => r.json()),
    ]).then(([brandsRes, binsRes]) => {
      if (brandsRes.success) setBrands(brandsRes.data.filter((b: Brand) => b._count.products > 0));
      if (binsRes.success) setBins(binsRes.data);
    }).catch(() => {});
  }, []);

  const loadProducts = useCallback(async (brandId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/products?brandId=${brandId}&status=ACTIVE&limit=500`);
      const json = await res.json();
      if (json.success) {
        const items = (json.data || []) as ProductItem[];
        setProducts(items);
        const initial: Record<string, { qty: number | null; reorder: number | null }> = {};
        items.forEach((p) => { initial[p.id] = { qty: null, reorder: p.reorderLevel || null }; });
        setCounts(initial);
        setExpandedCategories(new Set(items.map((p) => p.category?.name || "Uncategorized")));
      }
    } catch { setError("Failed to load products"); }
    finally { setLoading(false); }
  }, []);

  const handleSelectBrand = (brand: Brand) => {
    setSelectedBrand(brand);
    loadProducts(brand.id);
    setStep("bin");
  };

  const handleSelectBin = (bin: BinOption) => {
    setSelectedBin(bin);
    setStep("count");
  };

  const updateCount = (productId: string, field: "qty" | "reorder", value: number | null) => {
    setCounts((prev) => ({ ...prev, [productId]: { ...prev[productId], [field]: value } }));
  };

  const countedCount = Object.values(counts).filter((c) => c.qty !== null).length;
  const totalProducts = products.length;

  const handleSubmit = async () => {
    if (!selectedBrand || !selectedBin) return;
    const counted = Object.entries(counts).filter(([, c]) => c.qty !== null);
    if (counted.length === 0) { setError("Count at least one item"); return; }

    setSubmitting(true);
    setError("");

    try {
      // Create stock count with pre-counted items
      const title = `${selectedBrand.name} @ ${selectedBin.name} — Brand Count`;
      const res = await fetch("/api/stock-counts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          binId: selectedBin.id,
          location: selectedBin.location,
          productIds: products.map((p) => p.id),
          assignedToId: (session?.user as { userId?: string })?.userId,
          dueDate: new Date().toISOString(),
        }),
      });
      const createJson = await res.json();
      if (!res.ok || !createJson.success) {
        setError(createJson.error || "Failed to create count");
        return;
      }

      const countId = createJson.data.id;

      // Batch update counted quantities + reorder levels
      const items = await fetch(`/api/stock-counts/${countId}`).then((r) => r.json());
      if (!items.success) { setError("Failed to load count items"); return; }

      const stockCountItems = items.data.items as Array<{ id: string; productId: string }>;

      for (const sci of stockCountItems) {
        const c = counts[sci.productId];
        if (!c || c.qty === null) continue;

        await fetch(`/api/stock-counts/${countId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: [{ id: sci.id, countedQty: c.qty, notes: c.reorder !== null ? `Reorder: ${c.reorder}` : undefined }],
          }),
        });
      }

      // Update reorder levels on products
      const reorderUpdates = Object.entries(counts)
        .filter(([, c]) => c.reorder !== null && c.qty !== null)
        .map(([productId, c]) => ({ id: productId, reorderLevel: c.reorder! }));

      if (reorderUpdates.length > 0) {
        await fetch("/api/reorder/update-levels", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: reorderUpdates }),
        });
      }

      // Mark as COMPLETED
      await fetch(`/api/stock-counts/${countId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED" }),
      });

      setResultId(countId);
      setStep("submitted");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  };

  // Group products by category
  const filtered = products.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
  });

  const groups: Record<string, ProductItem[]> = {};
  for (const p of filtered) {
    const cat = p.category?.name || "Uncategorized";
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(p);
  }

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  // Warehouse bins only
  const warehouseBins = bins.filter((b) => b.location.toLowerCase().includes("warehouse"));
  const otherBins = bins.filter((b) => !b.location.toLowerCase().includes("warehouse"));

  return (
    <div className="pb-32">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/stock-audit" className="p-1"><ArrowLeft className="h-5 w-5 text-slate-600" /></Link>
        <div>
          <h1 className="text-lg font-bold text-slate-900">Brand Stock Count</h1>
          <p className="text-[10px] text-slate-500">
            {step === "brand" && "Step 1: Select brand"}
            {step === "bin" && `Step 2: ${selectedBrand?.name} — Select bin`}
            {step === "count" && `Step 3: Count ${selectedBrand?.name} items in ${selectedBin?.name}`}
            {step === "review" && "Step 4: Review & submit"}
            {step === "submitted" && "Done! Waiting for approval"}
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 mb-3 text-xs text-red-700">
          {error}<button onClick={() => setError("")} className="ml-2 underline">dismiss</button>
        </div>
      )}

      {/* ── STEP 1: Select Brand ── */}
      {step === "brand" && (
        <div className="space-y-2">
          <p className="text-xs text-slate-600 mb-2">Which brand are you counting?</p>
          {brands.map((b) => (
            <button key={b.id} onClick={() => handleSelectBrand(b)}
              className="w-full flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg hover:border-blue-400 transition-colors text-left">
              <div>
                <p className="text-sm font-medium text-slate-900">{b.name}</p>
                <p className="text-[10px] text-slate-500">{b._count.products} products</p>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </button>
          ))}
        </div>
      )}

      {/* ── STEP 2: Select Bin ── */}
      {step === "bin" && (
        <div className="space-y-2">
          <p className="text-xs text-slate-600 mb-2">Where are the {selectedBrand?.name} items stored?</p>

          {warehouseBins.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] font-semibold text-slate-500 uppercase mb-1">Warehouse Bins</p>
              {warehouseBins.map((b) => (
                <button key={b.id} onClick={() => handleSelectBin(b)}
                  className="w-full flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg hover:border-blue-400 transition-colors text-left mb-1.5">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-blue-500" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">{b.name}</p>
                      <p className="text-[10px] text-slate-500">{b.code} · {b.location}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </button>
              ))}
            </div>
          )}

          {otherBins.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-slate-500 uppercase mb-1">Store Bins</p>
              {otherBins.map((b) => (
                <button key={b.id} onClick={() => handleSelectBin(b)}
                  className="w-full flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition-colors text-left mb-1.5">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-slate-400" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">{b.name}</p>
                      <p className="text-[10px] text-slate-500">{b.code} · {b.location}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </button>
              ))}
            </div>
          )}

          <button onClick={() => { setStep("brand"); setSelectedBrand(null); }}
            className="text-xs text-blue-600 mt-2 underline">← Change brand</button>
        </div>
      )}

      {/* ── STEP 3: Count Items ── */}
      {step === "count" && (
        <div>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : (
            <>
              {/* Progress */}
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-slate-600">{countedCount} of {totalProducts} counted</p>
                <div className="w-32 bg-slate-200 rounded-full h-2">
                  <div className="bg-green-500 h-2 rounded-full transition-all"
                    style={{ width: `${totalProducts > 0 ? (countedCount / totalProducts) * 100 : 0}%` }} />
                </div>
              </div>

              {/* Search */}
              <Input placeholder="Search by name or SKU..." value={search}
                onChange={(e) => setSearch(e.target.value)} className="mb-3" />

              {/* Items grouped by category */}
              {Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([cat, items]) => (
                <div key={cat} className="mb-3">
                  <button onClick={() => toggleCategory(cat)}
                    className="flex items-center gap-1.5 w-full text-left py-1.5">
                    {expandedCategories.has(cat) ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
                    <span className="text-xs font-semibold text-slate-700 uppercase">{cat}</span>
                    <span className="text-[10px] text-slate-400">{items.length}</span>
                  </button>

                  {expandedCategories.has(cat) && (
                    <div className="space-y-1.5 mt-1">
                      {items.map((p) => {
                        const c = counts[p.id] || { qty: null, reorder: null };
                        const isCounted = c.qty !== null;
                        return (
                          <Card key={p.id} className={isCounted ? "border-green-200 bg-green-50/30" : ""}>
                            <CardContent className="p-2.5">
                              <div className="flex items-start justify-between mb-1.5">
                                <div className="flex-1 min-w-0 mr-2">
                                  <p className="text-xs font-medium text-slate-900 leading-tight">{p.name}</p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[10px] text-slate-400 font-mono">{p.sku}</span>
                                    {p.size && <Badge className="text-[9px] px-1 py-0 bg-slate-100 text-slate-600">{p.size}</Badge>}
                                    <Badge className="text-[9px] px-1 py-0 bg-blue-50 text-blue-600">{p.type.replace("_", " ")}</Badge>
                                  </div>
                                </div>
                                {isCounted && <Check className="h-4 w-4 text-green-600 shrink-0" />}
                              </div>

                              <div className="flex items-center gap-2 mt-2">
                                <div className="flex-1">
                                  <label className="text-[9px] text-slate-500 block mb-0.5">Count</label>
                                  <input type="number" min="0" inputMode="numeric"
                                    value={c.qty === null ? "" : c.qty}
                                    onChange={(e) => updateCount(p.id, "qty", e.target.value === "" ? null : parseInt(e.target.value) || 0)}
                                    placeholder="Qty"
                                    className="w-full text-center text-sm font-medium border border-slate-300 rounded-lg py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500" />
                                </div>
                                <div className="flex-1">
                                  <label className="text-[9px] text-slate-500 block mb-0.5">Reorder Level</label>
                                  <input type="number" min="0" inputMode="numeric"
                                    value={c.reorder === null ? "" : c.reorder}
                                    onChange={(e) => updateCount(p.id, "reorder", e.target.value === "" ? null : parseInt(e.target.value) || 0)}
                                    placeholder="Min"
                                    className="w-full text-center text-sm border border-slate-200 rounded-lg py-2 focus:ring-2 focus:ring-blue-500" />
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}

              <button onClick={() => { setStep("bin"); setSelectedBin(null); }}
                className="text-xs text-blue-600 mt-2 underline">← Change bin</button>
            </>
          )}
        </div>
      )}

      {/* ── STEP 4: Submitted ── */}
      {step === "submitted" && (
        <div className="text-center py-8 space-y-4">
          <Check className="h-12 w-12 text-green-600 mx-auto" />
          <div>
            <p className="text-lg font-bold text-green-900">Count Submitted!</p>
            <p className="text-sm text-slate-600 mt-1">
              {countedCount} items counted for {selectedBrand?.name} in {selectedBin?.name}
            </p>
            <p className="text-xs text-slate-500 mt-2">
              Waiting for Srinu's approval. Once approved, these become the actual stock levels.
            </p>
          </div>
          <div className="flex gap-2 justify-center mt-4">
            <Link href={`/stock-audit/${resultId}/review`}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">
              View Count
            </Link>
            <button onClick={() => { setStep("brand"); setSelectedBrand(null); setSelectedBin(null); setProducts([]); setCounts({}); setSearch(""); setResultId(""); }}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium">
              Count Another Brand
            </button>
          </div>
        </div>
      )}

      {/* ── Sticky Submit Bar ── */}
      {step === "count" && countedCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-3 z-50 max-w-screen-sm mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-600"><strong>{countedCount}</strong> of {totalProducts} counted</p>
              <p className="text-[10px] text-slate-400">by {userName} · {selectedBrand?.name} · {selectedBin?.code}</p>
            </div>
            <button onClick={handleSubmit} disabled={submitting}
              className="flex items-center gap-1.5 bg-green-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Submit for Approval
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
