"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, CheckCircle2, Phone, ShoppingBag, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useDebounce } from "@/lib/utils";

interface WalkoutDelivery {
  id: string;
  invoiceNo: string;
  invoiceDate: string;
  invoiceAmount: number;
  customerName: string;
  customerPhone: string | null;
  status: string;
  lineItems: Array<{ name: string; quantity: number }> | null;
  salesPerson: string | null;
  deliveredAt: string | null;
}

function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

export default function WalkoutPage() {
  const router = useRouter();
  const [deliveries, setDeliveries] = useState<WalkoutDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: "WALK_OUT", limit: "100" });
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await fetch(`/api/deliveries?${params}`).then(r => r.json());
      if (res.success) setDeliveries(res.data);
    } catch { /* ignore */ }
    setLoading(false);
  }, [debouncedSearch]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="pb-20">
      <div className="flex items-center gap-2 mb-3">
        <Link href="/deliveries">
          <ArrowLeft className="h-5 w-5 text-slate-600" />
        </Link>
        <h1 className="text-lg font-bold text-slate-900">Walk-out Deliveries</h1>
        <Badge variant="default" className="ml-auto text-xs">{deliveries.length}</Badge>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
        <input
          type="text"
          placeholder="Search customer, invoice..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
      ) : deliveries.length === 0 ? (
        <div className="text-center py-12">
          <ShoppingBag className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No walk-out deliveries</p>
        </div>
      ) : (
        <div className="space-y-2">
          {deliveries.map((d) => (
            <Card key={d.id} className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => router.push(`/deliveries/${d.id}`)}>
              <CardContent className="p-3.5">
                <div className="flex items-start justify-between mb-1">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{d.customerName}</p>
                    <p className="text-xs text-slate-500">{d.invoiceNo}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="success" className="text-[10px]">
                      <CheckCircle2 className="h-3 w-3 mr-0.5" /> Walk-out
                    </Badge>
                  </div>
                </div>

                {d.lineItems && d.lineItems.length > 0 && (
                  <p className="text-xs text-slate-700 mb-1">
                    {d.lineItems.map(li => li.name).join(", ")}
                  </p>
                )}

                <div className="flex items-center justify-between mt-1.5">
                  <div className="flex items-center gap-2 text-[10px] text-slate-500">
                    <span>{formatINR(d.invoiceAmount)}</span>
                    {d.salesPerson && <span>👤 {d.salesPerson}</span>}
                    {d.deliveredAt && <span>{new Date(d.deliveredAt).toLocaleDateString("en-IN")}</span>}
                  </div>
                  {d.customerPhone && (
                    <a href={`tel:${d.customerPhone}`} onClick={(e) => e.stopPropagation()}
                      className="p-1 rounded-full bg-green-100 text-green-700">
                      <Phone className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
