"use client";

import { useState, useEffect, useCallback } from "react";
import { Printer, Loader2, Minus, Plus } from "lucide-react";
import { loadTemplate, formatFieldValue, type LabelTemplate } from "@/lib/label-template";

interface LabelPrintProps {
  product: {
    name: string;
    sku: string;
    mrp: number;
    sellingPrice: number;
    brand?: string;
  };
}

export function LabelPrintButton({ product }: LabelPrintProps) {
  const [printing, setPrinting] = useState(false);
  const [copies, setCopies] = useState(1);
  const [showCopies, setShowCopies] = useState(false);
  const [barcodeImg, setBarcodeImg] = useState("");
  const [template, setTemplate] = useState<LabelTemplate | null>(null);

  useEffect(() => {
    setTemplate(loadTemplate());
  }, []);

  const generateBarcode = useCallback(async () => {
    try {
      const res = await fetch("/api/barcode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: product.sku, type: "code128" }),
      });
      if (res.ok) {
        const data = await res.json();
        setBarcodeImg(data.image);
      }
    } catch { /* */ }
  }, [product.sku]);

  useEffect(() => { generateBarcode(); }, [generateBarcode]);

  function handlePrint() {
    if (!template) return;
    setPrinting(true);

    const visibleElements = template.elements.filter((el) => el.visible);

    // Build label HTML
    let labelHtml = "";
    for (const el of visibleElements) {
      if (el.type === "barcode") {
        if (barcodeImg) {
          labelHtml += `<div style="text-align:center;margin:1mm 0;">
            <img src="${barcodeImg}" style="height:${template.barcodeHeight}mm;object-fit:contain;" />
          </div>`;
        }
      } else {
        const value = formatFieldValue(el.field, product);
        if (!value) continue;
        labelHtml += `<p style="font-size:${el.fontSize}pt;font-weight:${el.bold ? "bold" : "normal"};text-align:${el.align};line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin:0;">${value}</p>`;
      }
    }

    // Repeat for copies
    const allLabels = Array(copies).fill(labelHtml).map((h) =>
      `<div class="label">${h}</div>`
    ).join("");

    const htmlContent = `<html><head><title>Label - ${product.sku}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; }
        .label {
          width: ${template.width}mm;
          height: ${template.height}mm;
          padding: ${template.padding}mm;
          display: flex;
          flex-direction: column;
          justify-content: center;
          page-break-after: always;
          overflow: hidden;
        }
        .label:last-child { page-break-after: auto; }
        @media print {
          @page {
            size: ${template.width}mm ${template.height}mm;
            margin: 0;
          }
        }
      </style>
    </head><body>${allLabels}</body></html>`;

    // Use hidden iframe for printing — works on mobile PWA where window.open is blocked
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.top = "-10000px";
    iframe.style.left = "-10000px";
    iframe.style.width = "0";
    iframe.style.height = "0";
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      // Fallback: try window.open
      const win = window.open("", "_blank");
      if (win) {
        win.document.open();
        win.document.write(htmlContent);
        win.document.close();
        setTimeout(() => { win.print(); setPrinting(false); }, 300);
      } else {
        setPrinting(false);
        alert("Popup blocked. Please allow popups for this site.");
      }
      return;
    }

    iframeDoc.open();
    iframeDoc.write(htmlContent);
    iframeDoc.close();

    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
        setPrinting(false);
      }, 500);
    }, 300);
  }

  return (
    <div className="flex items-center gap-1">
      {showCopies && (
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg px-1.5 py-0.5">
          <button onClick={() => setCopies(Math.max(1, copies - 1))}
            className="p-0.5 rounded hover:bg-slate-200"><Minus className="h-3 w-3" /></button>
          <span className="text-xs font-mono w-5 text-center">{copies}</span>
          <button onClick={() => setCopies(Math.min(50, copies + 1))}
            className="p-0.5 rounded hover:bg-slate-200"><Plus className="h-3 w-3" /></button>
        </div>
      )}
      <button
        onClick={() => {
          if (!showCopies) { setShowCopies(true); return; }
          handlePrint();
        }}
        disabled={printing || !template}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-900 text-white disabled:opacity-50 shrink-0"
      >
        {printing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
        {showCopies ? `Print ${copies}` : "Label"}
      </button>
    </div>
  );
}
