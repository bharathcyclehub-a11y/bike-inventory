"use client";

import { use, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Printer, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface SerialItem {
  id: string;
  serialCode: string;
  status: string;
  condition: string;
  product: { name: string; sku: string };
}

export default function BarcodePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [serials, setSerials] = useState<SerialItem[]>([]);
  const [productName, setProductName] = useState("");
  const [productSku, setProductSku] = useState("");
  const [barcodeImages, setBarcodeImages] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [barcodeType, setBarcodeType] = useState<"code128" | "qrcode">("code128");
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/serials?productId=${id}&status=IN_STOCK`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setSerials(res.data);
          if (res.data.length > 0) {
            setProductName(res.data[0].product.name);
            setProductSku(res.data[0].product.sku);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (serials.length === 0) return;
    async function generateBarcodes() {
      const images: Record<string, string> = {};
      for (const serial of serials) {
        try {
          const res = await fetch("/api/barcode", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: serial.serialCode, type: barcodeType }),
          });
          if (res.ok) {
            const data = await res.json();
            images[serial.id] = data.image;
          }
        } catch { /* fallback to text */ }
      }
      setBarcodeImages(images);
    }
    generateBarcodes();
  }, [serials, barcodeType]);

  function escapeHtml(str: string) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function handlePrint() {
    if (!printRef.current) return;
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      const safeTitle = escapeHtml(productName);
      const doc = printWindow.document;
      doc.open();
      doc.write(`<html><head><title>Barcodes - ${safeTitle}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .barcode-grid { display: flex; flex-wrap: wrap; }
          .barcode-item { display: inline-block; text-align: center; margin: 10px; padding: 10px; border: 1px dashed #ccc; }
          .barcode-item img { max-width: 200px; }
          .serial-code { font-family: monospace; font-size: 11px; margin-top: 4px; }
          .product-name { font-size: 10px; color: #666; }
          @media print { .barcode-item { page-break-inside: avoid; } }
        </style></head><body><div class="barcode-grid"></div></body></html>`);
      doc.close();

      const container = doc.querySelector(".barcode-grid");
      if (container) {
        serials.forEach((s) => {
          const item = doc.createElement("div");
          item.className = "barcode-item";
          if (barcodeImages[s.id]) {
            const img = doc.createElement("img");
            img.src = barcodeImages[s.id];
            img.alt = s.serialCode;
            item.appendChild(img);
          }
          const code = doc.createElement("div");
          code.className = "serial-code";
          code.textContent = s.serialCode;
          item.appendChild(code);
          const name = doc.createElement("div");
          name.className = "product-name";
          name.textContent = productName;
          item.appendChild(name);
          container.appendChild(item);
        });
      }
      printWindow.print();
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Link href={`/stock/${id}`} className="p-1"><ArrowLeft className="h-5 w-5 text-slate-600" /></Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-slate-900 truncate">Barcodes</h1>
          <p className="text-xs text-slate-500">{productName} ({productSku})</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1 flex-1">
          <button onClick={() => setBarcodeType("code128")}
            className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${barcodeType === "code128" ? "bg-white shadow-sm text-slate-900" : "text-slate-500"}`}>
            Barcode
          </button>
          <button onClick={() => setBarcodeType("qrcode")}
            className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${barcodeType === "qrcode" ? "bg-white shadow-sm text-slate-900" : "text-slate-500"}`}>
            QR Code
          </button>
        </div>
        <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="h-3.5 w-3.5 mr-1" />Print</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : serials.length === 0 ? (
        <div className="text-center py-12">
          <QrCode className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No serial items in stock</p>
          <p className="text-xs text-slate-400 mt-1">Record an inward with serial tracking to generate barcodes</p>
        </div>
      ) : (
        <div ref={printRef} className="grid grid-cols-2 gap-3">
          {serials.map((serial) => (
            <Card key={serial.id}>
              <CardContent className="p-3 text-center">
                {barcodeImages[serial.id] ? (
                  <img src={barcodeImages[serial.id]} alt={serial.serialCode} className="mx-auto max-w-full" />
                ) : (
                  <div className="h-16 flex items-center justify-center bg-slate-50 rounded">
                    <span className="font-mono text-xs text-slate-500">{serial.serialCode}</span>
                  </div>
                )}
                <p className="font-mono text-[10px] text-slate-500 mt-1">{serial.serialCode}</p>
                <Badge variant={serial.condition === "NEW" ? "success" : "warning"} className="text-[9px] mt-1">{serial.condition}</Badge>
                <p className="product-name text-[9px] text-slate-400 mt-0.5">{productName}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
