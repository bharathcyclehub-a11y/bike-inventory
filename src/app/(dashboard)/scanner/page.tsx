"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Search, QrCode, Camera, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface SerialResult {
  id: string;
  serialCode: string;
  status: string;
  condition: string;
  receivedAt: string;
  soldAt: string | null;
  customerName: string | null;
  product: { name: string; sku: string; type: string; sellingPrice: number; mrp: number };
  bin: { code: string; location: string } | null;
}

function fmt(val: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(val);
}

export default function ScannerPage() {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<SerialResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const handleSearch = async (code: string) => {
    if (code.length < 2) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/serials/search?code=${encodeURIComponent(code)}`);
      const data = await res.json();
      if (data.success) setResults(data.data);
    } catch {
      // handle silently
    } finally {
      setLoading(false);
    }
  };

  const startCamera = async () => {
    try {
      setCameraError("");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
    } catch {
      setCameraError("Camera access denied. Please allow camera permissions.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Link href="/more" className="p-1"><ArrowLeft className="h-5 w-5 text-slate-600" /></Link>
        <h1 className="text-lg font-bold text-slate-900">Barcode Scanner</h1>
      </div>

      {/* Camera View */}
      {cameraActive ? (
        <div className="relative mb-4 rounded-xl overflow-hidden bg-black">
          <video ref={videoRef} autoPlay playsInline className="w-full h-48 object-cover" />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-48 h-24 border-2 border-white/60 rounded-lg" />
          </div>
          <button onClick={stopCamera} className="absolute top-2 right-2 bg-black/50 text-white p-1.5 rounded-full">
            <X className="h-4 w-4" />
          </button>
          <p className="absolute bottom-2 left-0 right-0 text-center text-xs text-white/80">
            Position barcode inside the frame
          </p>
        </div>
      ) : (
        <button onClick={startCamera}
          className="w-full flex items-center justify-center gap-2 bg-slate-100 rounded-xl py-8 mb-4 hover:bg-slate-200 transition-colors">
          <Camera className="h-6 w-6 text-slate-500" />
          <span className="text-sm font-medium text-slate-600">Tap to open camera</span>
        </button>
      )}

      {cameraError && (
        <p className="text-xs text-red-600 text-center mb-3">{cameraError}</p>
      )}

      {/* Manual Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Type serial code or scan barcode..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSearch(search); }}
          className="pl-9 pr-16"
        />
        <button onClick={() => handleSearch(search)}
          className="absolute right-2 top-1/2 -translate-y-1/2 bg-slate-900 text-white px-3 py-1 rounded-md text-xs font-medium">
          Search
        </button>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="h-5 w-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : results.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs text-slate-500 mb-1">{results.length} result{results.length !== 1 ? "s" : ""}</p>
          {results.map((s) => (
            <Card key={s.id}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between mb-1.5">
                  <div className="flex-1 min-w-0 mr-2">
                    <p className="text-sm font-mono font-bold text-slate-900">{s.serialCode}</p>
                    <p className="text-sm text-slate-700">{s.product.name}</p>
                    <p className="text-xs text-slate-500">{s.product.sku} | {s.product.type}</p>
                  </div>
                  <Badge variant={s.status === "IN_STOCK" ? "success" : s.status === "SOLD" ? "info" : s.status === "DAMAGED" ? "danger" : "warning"}>
                    {s.status.replace(/_/g, " ")}
                  </Badge>
                </div>
                <div className="flex gap-3 text-xs mt-2">
                  <span className="text-green-600">Sell: {fmt(s.product.sellingPrice)}</span>
                  <span className="text-slate-500">MRP: {fmt(s.product.mrp)}</span>
                  {s.bin && <span className="text-slate-500">Bin: {s.bin.code}</span>}
                </div>
                {s.customerName && (
                  <p className="text-xs text-slate-500 mt-1">Customer: {s.customerName}</p>
                )}
                <p className="text-xs text-slate-400 mt-1">
                  Received: {new Date(s.receivedAt).toLocaleDateString("en-IN")}
                  {s.soldAt && ` | Sold: ${new Date(s.soldAt).toLocaleDateString("en-IN")}`}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : search.length > 0 && !loading ? (
        <div className="text-center py-8">
          <QrCode className="h-10 w-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-400">No results found</p>
          <p className="text-xs text-slate-300">Try a different serial code</p>
        </div>
      ) : (
        <div className="text-center py-8">
          <QrCode className="h-10 w-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Scan a barcode or type a serial code</p>
          <p className="text-xs text-slate-400 mt-1">Look up product details, status, and pricing</p>
        </div>
      )}
    </div>
  );
}
