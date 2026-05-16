"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Truck, CheckCircle2, Loader2, MapPin, Navigation, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface ScheduledDelivery {
  id: string;
  invoiceNo: string;
  customerName: string;
  customerPhone: string | null;
  customerArea: string | null;
  customerAddress: string | null;
  customerPincode: string | null;
  scheduledDate: string | null;
  invoiceAmount: number;
  lineItems: Array<{ name: string; quantity: number }> | null;
  mapsLink: string | null;
}

function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

// ─── Pincode coordinates (lat, lng) for Bangalore pincodes ──────────────────
// Source: approximate centroid of each postal area
// BCH is at 560064 — Yelahanka New Town: 13.1007, 77.5963
const BCH_COORDS: [number, number] = [13.1007, 77.5963];
const BCH_ADDRESS = "Yelahanka New Town, Bangalore 560064";

const PINCODE_COORDS: Record<string, [number, number]> = {
  "560064": [13.1007, 77.5963], // Yelahanka New Town (BCH)
  "560063": [13.0986, 77.5851], // Yelahanka Old Town
  "560065": [13.1146, 77.6169], // Jakkur
  "560062": [13.2421, 77.7116], // Devanahalli / Airport
  "560106": [13.0735, 77.6269], // Thanisandra north
  "560094": [13.0269, 77.5729], // Sanjay Nagar
  "560024": [13.0220, 77.5936], // RT Nagar
  "560032": [13.0452, 77.5976], // Hebbal
  "560045": [13.0060, 77.6474], // Banaswadi
  "560107": [13.0271, 77.6596], // Horamavu
  "560013": [13.0302, 77.5481], // Mathikere
  "560037": [13.0474, 77.5307], // Jalahalli
  "560019": [13.0070, 77.5213], // Nandini Layout
  "560020": [13.0283, 77.5098], // Peenya
  "560092": [13.0120, 77.5511], // Mahalakshmipuram
  "560043": [13.0296, 77.6466], // HBR Layout
  "560052": [13.0143, 77.6413], // Kammanahalli
  "560003": [12.9898, 77.5565], // Rajajinagar
  "560010": [12.9938, 77.5421], // Rajajinagar west
  "560004": [13.0063, 77.5737], // Malleshwaram
  "560015": [12.9978, 77.5699], // Malleshwaram
  "560016": [13.0080, 77.5815], // Sadashivanagar
  "560021": [13.0475, 77.5553], // Bangalore North
  "560007": [12.9872, 77.6119], // Benson Town / Fraser Town
  "560008": [12.9791, 77.5993], // Shivajinagar
  "560002": [12.9747, 77.6009], // Shivajinagar
  "560009": [12.9771, 77.6206], // Ulsoor
  "560034": [13.0114, 77.6540], // CV Raman Nagar
  "560038": [12.9784, 77.6408], // Indiranagar
  "560046": [12.9247, 77.6019], // Bannerghatta Road north
  "560001": [12.9716, 77.5946], // MG Road
  "560006": [12.9852, 77.5461], // Rajajinagar far
  "560017": [12.9867, 77.5403], // Rajajinagar
  "560005": [12.9421, 77.5765], // Basavangudi
  "560011": [12.9298, 77.5832], // Jayanagar
  "560012": [12.9266, 77.5930], // Jayanagar
  "560025": [12.9239, 77.5869], // Jayanagar
  "560029": [12.9514, 77.5848], // Lalbagh
  "560041": [12.9700, 77.5213], // Vijayanagar
  "560026": [12.9352, 77.6245], // Koramangala
  "560027": [12.9279, 77.6304], // Koramangala
  "560072": [12.9601, 77.6446], // Domlur
  "560071": [12.9600, 77.6041], // Richmond Town
  "560076": [12.9698, 77.7499], // Whitefield
  "560048": [12.9566, 77.6978], // KR Puram / Marathahalli
  "560078": [12.9304, 77.6784], // Bellandur
  "560083": [12.9493, 77.7010], // Marathahalli
  "560059": [12.9063, 77.5913], // JP Nagar
  "560068": [12.9168, 77.6101], // BTM Layout
  "560070": [12.8601, 77.6010], // Bannerghatta
  "560100": [12.8540, 77.6054], // Bannerghatta Road far
  "560061": [12.8534, 77.5965], // Anjanapura
  "560066": [12.8416, 77.6602], // Electronic City
  "560105": [12.8360, 77.6760], // Electronic City Phase 2
  "560067": [12.9088, 77.4878], // Kengeri
  "560060": [12.9360, 77.5019], // Nayandahalli
  "560085": [12.9618, 77.5150], // Vijayanagar outer
  "560056": [12.9527, 77.5071], // Mysuru Road
  "560033": [13.0226, 77.4975], // Tumkur Road / Peenya far
  "560098": [12.9411, 77.7581], // Varthur / Whitefield far
};

// Haversine straight-line distance in km between two [lat, lng] points
function haversineKm([lat1, lon1]: [number, number], [lat2, lon2]: [number, number]): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getPincodeCoords(pincode: string | null): [number, number] | null {
  if (!pincode) return null;
  return PINCODE_COORDS[pincode.trim()] ?? null;
}

// Nearest-neighbour TSP: from BCH, always go to the closest unvisited stop next.
// Deliveries with unknown pincode are appended at the end in original order.
function sortByRoute(deliveries: ScheduledDelivery[]): ScheduledDelivery[] {
  const known = deliveries.filter((d) => getPincodeCoords(d.customerPincode) !== null);
  const unknown = deliveries.filter((d) => getPincodeCoords(d.customerPincode) === null);

  const unvisited = [...known];
  const route: ScheduledDelivery[] = [];
  let current: [number, number] = BCH_COORDS;

  while (unvisited.length > 0) {
    let nearestIdx = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < unvisited.length; i++) {
      const coords = getPincodeCoords(unvisited[i].customerPincode)!;
      const dist = haversineKm(current, coords);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = i;
      }
    }
    const next = unvisited.splice(nearestIdx, 1)[0];
    route.push(next);
    current = getPincodeCoords(next.customerPincode)!;
  }

  return [...route, ...unknown];
}

// Total estimated straight-line distance for the route (BCH → stop1 → stop2 → ... → last)
function totalRouteKm(sorted: ScheduledDelivery[]): number {
  let total = 0;
  let prev: [number, number] = BCH_COORDS;
  for (const d of sorted) {
    const coords = getPincodeCoords(d.customerPincode);
    if (coords) {
      total += haversineKm(prev, coords);
      prev = coords;
    }
  }
  return Math.round(total);
}

// Build Google Maps multi-stop direction URL (addresses as waypoints)
function buildMapsUrl(sorted: ScheduledDelivery[]): string {
  const stops = sorted
    .map((d) => {
      const addr = d.customerAddress || "";
      const pin = d.customerPincode ? `, Bangalore ${d.customerPincode}` : ", Bangalore";
      return encodeURIComponent((addr + pin).trim());
    })
    .filter(Boolean);
  const origin = encodeURIComponent(BCH_ADDRESS);
  return `https://www.google.com/maps/dir/${origin}/${stops.join("/")}`;
}

export default function DispatchPage() {
  const [deliveries, setDeliveries] = useState<ScheduledDelivery[]>([]);
  const [outDeliveries, setOutDeliveries] = useState<ScheduledDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectedOut, setSelectedOut] = useState<Set<string>>(new Set());
  const [dispatching, setDispatching] = useState(false);
  const [delivering, setDelivering] = useState(false);
  const [actionError, setActionError] = useState("");
  const [tab, setTab] = useState<"dispatch" | "return">("dispatch");
  const [routeMode, setRouteMode] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/deliveries?status=SCHEDULED&limit=100&sortBy=scheduledDate").then((r) => r.json()),
      fetch("/api/deliveries?status=OUT_FOR_DELIVERY&limit=100").then((r) => r.json()),
    ])
      .then(([schedRes, outRes]) => {
        if (schedRes.success) setDeliveries(schedRes.data);
        if (outRes.success) setOutDeliveries(outRes.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectOut = (id: string) => {
    setSelectedOut((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleDispatch = async () => {
    if (selected.size === 0) return;
    setDispatching(true);
    try {
      await fetch("/api/deliveries/batch", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryIds: Array.from(selected), action: "OUT_FOR_DELIVERY" }),
      });
      setDeliveries((prev) => prev.filter((d) => !selected.has(d.id)));
      setSelected(new Set());
    } catch (e) { setActionError(e instanceof Error ? e.message : "Dispatch failed"); }
    finally { setDispatching(false); }
  };

  const handleDelivered = async () => {
    if (selectedOut.size === 0) return;
    setDelivering(true);
    try {
      await fetch("/api/deliveries/batch", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryIds: Array.from(selectedOut), action: "DELIVERED" }),
      });
      setOutDeliveries((prev) => prev.filter((d) => !selectedOut.has(d.id)));
      setSelectedOut(new Set());
    } catch (e) { setActionError(e instanceof Error ? e.message : "Mark delivered failed"); }
    finally { setDelivering(false); }
  };

  // ── Route computation for selected deliveries ──
  const selectedDeliveries = deliveries.filter((d) => selected.has(d.id));
  const routeSorted = sortByRoute(selectedDeliveries);
  const missingPincode = routeSorted.filter((d) => !d.customerPincode);
  const missingMaps = routeSorted.filter((d) => !d.mapsLink);
  const canGenerateRoute = selected.size > 0 && missingPincode.length === 0 && missingMaps.length === 0;

  // Sequence map: delivery id → position in route (1-based)
  const routeSequence: Record<string, number> = {};
  routeSorted.forEach((d, i) => { routeSequence[d.id] = i + 1; });

  // Display list — when routeMode is on and deliveries are selected, show sorted; otherwise group by area
  const displayList = tab === "dispatch" ? deliveries : outDeliveries;

  const areaGroups: Record<string, ScheduledDelivery[]> = {};
  for (const d of displayList) {
    const area = d.customerArea || "No Area";
    if (!areaGroups[area]) areaGroups[area] = [];
    areaGroups[area].push(d);
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="pb-36">
      {actionError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 mb-3 text-xs text-red-700">
          {actionError}
          <button onClick={() => setActionError("")} className="ml-2 underline">dismiss</button>
        </div>
      )}

      <div className="flex items-center gap-3 mb-3">
        <Link href="/deliveries" className="p-1"><ArrowLeft className="h-5 w-5 text-slate-600" /></Link>
        <h1 className="text-lg font-bold text-slate-900">Batch Dispatch</h1>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-100 rounded-lg p-0.5 mb-3">
        <button onClick={() => setTab("dispatch")}
          className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === "dispatch" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>
          Dispatch ({deliveries.length})
        </button>
        <button onClick={() => setTab("return")}
          className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === "return" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>
          Mark Delivered ({outDeliveries.length})
        </button>
      </div>

      {/* Route mode toggle (dispatch tab only) */}
      {tab === "dispatch" && deliveries.length > 0 && (
        <button
          onClick={() => setRouteMode((v) => !v)}
          className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium mb-3 border transition-colors ${
            routeMode
              ? "bg-blue-600 text-white border-blue-600"
              : "bg-white text-slate-600 border-slate-200"
          }`}
        >
          <Navigation className="h-3.5 w-3.5" />
          {routeMode ? "Route Mode ON — select deliveries to plan" : "Enable Route Planning"}
        </button>
      )}

      {/* Route summary panel (shown when deliveries are selected in route mode) */}
      {tab === "dispatch" && routeMode && selected.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3 space-y-2">
          <p className="text-xs font-semibold text-blue-900">
            Route: BCH → {routeSorted.map((d, i) => `#${i + 1} ${d.customerArea || d.customerPincode || d.customerName}`).join(" → ")}
          </p>
          <p className="text-[10px] text-blue-600">
            ~{totalRouteKm(routeSorted)} km straight-line total distance
          </p>

          {/* Missing data warnings */}
          {missingPincode.length > 0 && (
            <div className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 rounded p-2">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span><b>Missing pincode:</b> {missingPincode.map((d) => d.customerName).join(", ")}</span>
            </div>
          )}
          {missingMaps.length > 0 && (
            <div className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 rounded p-2">
              <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span><b>Missing Maps link:</b> {missingMaps.map((d) => d.customerName).join(", ")}<br />
              Ask customer to share Google Maps location before dispatch.</span>
            </div>
          )}

          {/* Generate route button */}
          {canGenerateRoute ? (
            <a
              href={buildMapsUrl(routeSorted)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full bg-green-600 text-white py-2.5 rounded-lg text-xs font-semibold"
            >
              <Navigation className="h-3.5 w-3.5" /> Open Route in Google Maps
            </a>
          ) : (
            <button
              disabled
              className="flex items-center justify-center gap-2 w-full bg-slate-200 text-slate-400 py-2.5 rounded-lg text-xs font-semibold cursor-not-allowed"
            >
              <Navigation className="h-3.5 w-3.5" /> Route unavailable — fix warnings above
            </button>
          )}

          {/* Individual Maps pins with per-stop distance */}
          {routeSorted.length > 0 && (
            <div className="space-y-1">
              {routeSorted.map((d, idx) => {
                const prevCoords = idx === 0 ? BCH_COORDS : getPincodeCoords(routeSorted[idx - 1].customerPincode);
                const currCoords = getPincodeCoords(d.customerPincode);
                const legKm = prevCoords && currCoords ? Math.round(haversineKm(prevCoords, currCoords) * 10) / 10 : null;
                return (
                  <div key={d.id} className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 w-12 shrink-0">
                      {legKm !== null ? `~${legKm}km` : "?km"}
                    </span>
                    {d.mapsLink ? (
                      <a href={d.mapsLink} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-blue-700 underline flex items-center gap-1">
                        <MapPin className="h-3 w-3 shrink-0" />
                        #{routeSequence[d.id]} {d.customerName}
                      </a>
                    ) : (
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <MapPin className="h-3 w-3 shrink-0 text-amber-400" />
                        #{routeSequence[d.id]} {d.customerName}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Delivery list */}
      {Object.keys(areaGroups).length === 0 ? (
        <div className="text-center py-12">
          <Truck className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-400">{tab === "dispatch" ? "No scheduled deliveries" : "No deliveries out"}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {Object.entries(areaGroups).map(([area, items]) => (
            <div key={area}>
              <p className="text-xs font-semibold text-slate-500 mb-1.5">{area} ({items.length})</p>
              <div className="space-y-1.5">
                {items.map((d) => {
                  const isSelected = tab === "dispatch" ? selected.has(d.id) : selectedOut.has(d.id);
                  const toggle = tab === "dispatch" ? toggleSelect : toggleSelectOut;
                  const seqNum = routeMode && tab === "dispatch" && isSelected ? routeSequence[d.id] : null;
                  const hasMaps = !!d.mapsLink;
                  const hasPincode = !!d.customerPincode;

                  return (
                    <Card key={d.id} className={isSelected ? "border-blue-300 bg-blue-50" : ""}>
                      <CardContent className="p-2.5 flex items-center gap-2.5">
                        <div className="relative shrink-0">
                          <input type="checkbox" checked={isSelected} onChange={() => toggle(d.id)}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600" />
                          {seqNum && (
                            <span className="absolute -top-2.5 -left-1 bg-blue-600 text-white text-[9px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                              {seqNum}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-medium text-slate-900 truncate">{d.invoiceNo} — {d.customerName}</p>
                          </div>
                          <p className="text-[10px] text-slate-500">
                            {d.lineItems?.slice(0, 1).map((it) => `${it.name} x${it.quantity}`).join(", ")}
                            {d.lineItems && d.lineItems.length > 1 ? ` +${d.lineItems.length - 1}` : ""}
                          </p>
                          {d.customerAddress && (
                            <p className="text-[10px] text-slate-400 truncate">{d.customerAddress}</p>
                          )}
                          <div className="flex items-center gap-2 mt-0.5">
                            {d.customerPincode && (
                              <span className="text-[10px] text-slate-500">{d.customerPincode}</span>
                            )}
                            {hasMaps ? (
                              <a href={d.mapsLink!} target="_blank" rel="noopener noreferrer"
                                className="text-[10px] text-green-600 flex items-center gap-0.5">
                                <MapPin className="h-2.5 w-2.5" /> Maps ✓
                              </a>
                            ) : (
                              <span className="text-[10px] text-amber-500 flex items-center gap-0.5">
                                <MapPin className="h-2.5 w-2.5" /> No Maps
                              </span>
                            )}
                            {!hasPincode && (
                              <span className="text-[10px] text-red-500">No pincode</span>
                            )}
                          </div>
                        </div>
                        <p className="text-xs font-medium text-slate-700 shrink-0">{formatINR(d.invoiceAmount)}</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action Bar */}
      {tab === "dispatch" && selected.size > 0 && (
        <div className="fixed above-nav left-0 right-0 px-4 space-y-2">
          {selected.size > 5 && (
            <div className="w-full max-w-lg mx-auto bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700 text-center">
              ⚠ {selected.size} deliveries selected — recommended max is 5 per vehicle
            </div>
          )}
          <button onClick={handleDispatch} disabled={dispatching}
            className="w-full max-w-lg mx-auto flex items-center justify-center gap-2 bg-orange-600 text-white py-3 rounded-xl text-sm font-medium shadow-lg disabled:opacity-50">
            <Truck className="h-4 w-4" /> {dispatching ? "Dispatching..." : `Dispatch ${selected.size} Selected`}
          </button>
        </div>
      )}

      {tab === "return" && selectedOut.size > 0 && (
        <div className="fixed above-nav left-0 right-0 px-4">
          <button onClick={handleDelivered} disabled={delivering}
            className="w-full max-w-lg mx-auto flex items-center justify-center gap-2 bg-green-600 text-white py-3 rounded-xl text-sm font-medium shadow-lg disabled:opacity-50">
            <CheckCircle2 className="h-4 w-4" /> {delivering ? "Updating..." : `Mark ${selectedOut.size} Delivered`}
          </button>
        </div>
      )}
    </div>
  );
}
