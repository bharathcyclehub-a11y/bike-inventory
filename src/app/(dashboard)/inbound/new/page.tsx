"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, Camera, Loader2, CheckCircle2, Trash2, Edit3, FileText, Upload, Sparkles, Link2, AlertCircle } from "lucide-react";
import { uploadImage } from "@/lib/supabase";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

interface Brand {
  brandId: string;
  brandName: string;
  leadDays: number;
}

interface LineItem {
  productName: string;
  productId?: string;
  sku?: string;
  quantity: number;
  rate: number;
  gstPercent: number;
  gstAmount: number;
  amount: number;
  hsn?: string;
  // AI match fields
  matchedProductId?: string;
  matchedProductName?: string;
  matchedSku?: string;
  matchScore?: number;
}

type Step = "brand" | "photo" | "verify" | "submitting" | "done";

export default function NewInboundPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("brand");
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrand, setSelectedBrand] = useState("");
  const [billImageUrl, setBillImageUrl] = useState("");
  const [billImageData, setBillImageData] = useState(""); // base64 for AI
  const [billPdfUrl, setBillPdfUrl] = useState("");
  const [billPdfData, setBillPdfData] = useState(""); // base64 for AI
  const [pdfName, setPdfName] = useState("");
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [billNo, setBillNo] = useState("");
  const [billDate, setBillDate] = useState(new Date().toISOString().split("T")[0]);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [createdShipment, setCreatedShipment] = useState<{ shipmentNo: string; expectedDeliveryDate: string } | null>(null);

  // AI parsing state
  const [parsing, setParsing] = useState(false);
  const [parseStatus, setParseStatus] = useState("");
  const [aiParsed, setAiParsed] = useState(false);

  const selectedBrandData = brands.find((b) => b.brandId === selectedBrand);

  useEffect(() => {
    fetch("/api/brand-lead-time").then((r) => r.json()).then((res) => {
      if (res.success) setBrands(res.data);
    }).catch(() => {});
  }, []);

  // AI Parse bill
  const parseBillWithAI = async (imageData: string, mimeType: string) => {
    setParsing(true);
    setParseStatus("Reading bill with AI...");
    setError("");
    try {
      const res = await fetch("/api/inbound/parse-bill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageData, mimeType, brandId: selectedBrand }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "AI parsing failed. Enter details manually.");
        return;
      }

      const result = data.data;

      // Auto-fill bill no and date
      if (result.billNo) setBillNo(result.billNo);
      if (result.billDate && /^\d{4}-\d{2}-\d{2}$/.test(result.billDate)) {
        setBillDate(result.billDate);
      }

      // Auto-fill line items with match info
      if (result.lineItems && result.lineItems.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setLineItems(result.lineItems.map((li: any) => ({
          productName: li.productName,
          productId: li.matchedProductId || undefined,
          sku: li.matchedSku || undefined,
          quantity: li.quantity,
          rate: li.rate,
          gstPercent: li.gstPercent || 0,
          gstAmount: li.gstAmount || 0,
          amount: li.amount,
          hsn: li.hsn || undefined,
          matchedProductId: li.matchedProductId,
          matchedProductName: li.matchedProductName,
          matchedSku: li.matchedSku,
          matchScore: li.matchScore,
        })));
      }

      setAiParsed(true);
      setParseStatus(`AI found ${result.lineItems?.length || 0} items. Review and edit below.`);
    } catch {
      setError("AI parsing failed. Please enter details manually.");
    } finally {
      setParsing(false);
    }
  };

  // Handle photo capture
  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxSize = 1200;
        let w = img.width;
        let h = img.height;
        if (w > maxSize || h > maxSize) {
          if (w > h) { h = (h / w) * maxSize; w = maxSize; }
          else { w = (w / h) * maxSize; h = maxSize; }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
        setBillImageUrl(dataUrl);
        setBillImageData(dataUrl);
        // Auto-parse with AI
        parseBillWithAI(dataUrl, "image/jpeg");
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Handle PDF upload to Supabase + AI parse
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      setError("Only PDF files are allowed");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("PDF must be under 10 MB");
      return;
    }

    // Read base64 for AI parsing
    const pdfBase64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
    setBillPdfData(pdfBase64);

    setUploadingPdf(true);
    setUploadProgress(10);
    setError("");
    try {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      setUploadProgress(20);
      const path = `bills/${Date.now()}-${file.name.replace(/\s+/g, "-")}`;
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 500);
      const url = await uploadImage(file, path);
      clearInterval(progressInterval);
      setUploadProgress(100);
      setBillPdfUrl(url);
      setPdfName(`${file.name} (${sizeMB} MB)`);

      // Auto-parse PDF with AI
      parseBillWithAI(pdfBase64, "application/pdf");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to upload PDF";
      setError(`PDF upload error: ${msg}`);
    } finally {
      setUploadingPdf(false);
      setUploadProgress(0);
      if (pdfInputRef.current) pdfInputRef.current.value = "";
    }
  };

  // Manual add row
  const addRow = () => {
    setLineItems([...lineItems, { productName: "", quantity: 1, rate: 0, gstPercent: 0, gstAmount: 0, amount: 0 }]);
  };

  const updateRow = (idx: number, field: keyof LineItem, value: string | number) => {
    setLineItems((prev) => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: value };
      if (field === "quantity" || field === "rate" || field === "gstPercent") {
        const base = (updated.quantity || 0) * (updated.rate || 0);
        updated.gstAmount = Math.round(base * (updated.gstPercent || 0) / 100);
        updated.amount = base + updated.gstAmount;
      }
      // If user edits productName, clear the match
      if (field === "productName") {
        updated.matchedProductId = undefined;
        updated.matchedProductName = undefined;
        updated.matchedSku = undefined;
        updated.matchScore = undefined;
        updated.productId = undefined;
        updated.sku = undefined;
      }
      return updated;
    }));
  };

  // Accept AI match
  const acceptMatch = (idx: number) => {
    setLineItems((prev) => prev.map((item, i) => {
      if (i !== idx || !item.matchedProductId) return item;
      return {
        ...item,
        productId: item.matchedProductId,
        sku: item.matchedSku,
        productName: item.matchedProductName || item.productName,
      };
    }));
  };

  // Reject AI match (use bill name as-is)
  const rejectMatch = (idx: number) => {
    setLineItems((prev) => prev.map((item, i) => {
      if (i !== idx) return item;
      return {
        ...item,
        matchedProductId: undefined,
        matchedProductName: undefined,
        matchedSku: undefined,
        matchScore: undefined,
        productId: undefined,
        sku: undefined,
      };
    }));
  };

  // Manual SKU match
  const [skuLoading, setSkuLoading] = useState<number | null>(null);
  const handleSkuMatch = async (idx: number, skuValue: string) => {
    if (!skuValue.trim()) return;
    setSkuLoading(idx);
    try {
      const res = await fetch(`/api/products?search=${encodeURIComponent(skuValue.trim())}&status=ACTIVE&limit=1`);
      const data = await res.json();
      if (data.success && data.data && data.data.length > 0) {
        const product = data.data[0];
        setLineItems((prev) => prev.map((item, i) => {
          if (i !== idx) return item;
          return {
            ...item,
            productId: product.id,
            sku: product.sku,
            matchedProductId: product.id,
            matchedProductName: product.name,
            matchedSku: product.sku,
            matchScore: 100,
          };
        }));
      } else {
        setError(`No product found for SKU "${skuValue}"`);
        setTimeout(() => setError(""), 3000);
      }
    } catch {
      setError("Failed to lookup SKU");
    } finally {
      setSkuLoading(null);
    }
  };

  const removeRow = (idx: number) => {
    setLineItems((prev) => prev.filter((_, i) => i !== idx));
  };

  // Re-parse with AI
  const handleReparse = () => {
    if (billPdfData) {
      parseBillWithAI(billPdfData, "application/pdf");
    } else if (billImageData) {
      parseBillWithAI(billImageData, "image/jpeg");
    }
  };

  // Check all items matched
  const allItemsMatched = lineItems.length > 0 && lineItems.every((li) => li.productId);
  const unmatchedCount = lineItems.filter((li) => !li.productId).length;

  // Submit
  const handleSubmit = async () => {
    if (!selectedBrand || (!billImageUrl && !billPdfUrl) || !billNo || !billDate || lineItems.length === 0) {
      setError("Brand, bill photo or PDF, bill number, bill date, and at least one item required");
      return;
    }
    if (!allItemsMatched) {
      setError(`${unmatchedCount} item(s) not matched. Use SKU to match all items before submitting.`);
      return;
    }
    setStep("submitting");
    setError("");
    try {
      const res = await fetch("/api/inbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId: selectedBrand,
          billNo,
          billImageUrl: billImageUrl || "",
          billPdfUrl: billPdfUrl || undefined,
          billDate,
          notes: notes || undefined,
          lineItems: lineItems.map((li) => ({
            productName: li.productName,
            productId: li.productId || undefined,
            sku: li.sku || undefined,
            quantity: li.quantity,
            rate: li.rate,
            amount: li.amount,
            hsn: li.hsn || undefined,
          })),
        }),
      }).then((r) => r.json());

      if (res.success) {
        setCreatedShipment({
          shipmentNo: res.data.shipmentNo,
          expectedDeliveryDate: res.data.expectedDeliveryDate,
        });
        setStep("done");
      } else {
        setError(res.error || "Failed to create shipment");
        setStep("verify");
      }
    } catch {
      setError("Network error");
      setStep("verify");
    }
  };

  // Success screen
  if (step === "done" && createdShipment) {
    const expectedDate = new Date(createdShipment.expectedDeliveryDate).toLocaleDateString("en-IN", {
      day: "numeric", month: "short", year: "numeric",
    });
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
        <h2 className="text-lg font-bold text-slate-900 mb-2">Shipment Created!</h2>
        <div className="bg-indigo-50 border-2 border-indigo-400 rounded-2xl px-8 py-4 mb-4">
          <p className="text-3xl font-black text-indigo-700 tracking-wider">{createdShipment.shipmentNo}</p>
        </div>
        <p className="text-sm text-slate-500 mb-1">
          {selectedBrandData?.brandName} | Bill: {billNo} | {lineItems.length} items
        </p>
        <p className="text-sm text-amber-600 font-medium mb-6">
          Expected delivery: {expectedDate}
        </p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => router.push("/inbound")}>View All</Button>
          <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={() => {
            setStep("brand");
            setSelectedBrand("");
            setBillImageUrl("");
            setBillImageData("");
            setBillPdfUrl("");
            setBillPdfData("");
            setPdfName("");
            setBillNo("");
            setBillDate(new Date().toISOString().split("T")[0]);
            setLineItems([]);
            setNotes("");
            setCreatedShipment(null);
            setAiParsed(false);
            setParseStatus("");
          }}>Upload Another</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-8">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/inbound" className="p-1"><ArrowLeft className="h-5 w-5 text-slate-600" /></Link>
        <div>
          <h1 className="text-lg font-bold text-slate-900">Upload Brand Bill</h1>
          <p className="text-xs text-slate-500">Upload bill photo or PDF → AI reads it → review & submit</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Step 1: Brand */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Brand *</label>
          <select value={selectedBrand} onChange={(e) => setSelectedBrand(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600">
            <option value="">Select brand...</option>
            {brands.map((b) => (
              <option key={b.brandId} value={b.brandId}>
                {b.brandName} ({b.leadDays} days lead)
              </option>
            ))}
          </select>
        </div>

        {/* Step 2: Photo */}
        {selectedBrand && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Bill Photo</label>
            <input ref={fileInputRef} type="file" accept="image/*" capture="environment"
              onChange={handlePhotoCapture} className="hidden" />

            {billImageUrl ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={billImageUrl} alt="Bill" className="w-full h-48 object-cover rounded-lg border border-slate-200" />
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-2 right-2 bg-white/90 backdrop-blur px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 shadow">
                  Retake
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="w-full h-32 border-2 border-dashed border-indigo-300 rounded-lg flex flex-col items-center justify-center gap-2 bg-indigo-50/50 hover:bg-indigo-50 transition-colors">
                <Camera className="h-8 w-8 text-indigo-400" />
                <span className="text-xs font-medium text-indigo-600">Tap to take photo of bill</span>
              </button>
            )}
          </div>
        )}

        {/* PDF Upload */}
        {selectedBrand && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Invoice PDF</label>
            <input ref={pdfInputRef} type="file" accept="application/pdf" onChange={handlePdfUpload} className="hidden" />

            {billPdfUrl ? (
              <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg p-3">
                <FileText className="h-8 w-8 text-green-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-green-800 truncate">{pdfName}</p>
                  <p className="text-[10px] text-green-600">Uploaded</p>
                </div>
                <button onClick={() => { setBillPdfUrl(""); setBillPdfData(""); setPdfName(""); }}
                  className="text-xs text-red-500 hover:underline shrink-0">Remove</button>
              </div>
            ) : (
              <div>
                <button type="button" onClick={() => pdfInputRef.current?.click()} disabled={uploadingPdf}
                  className="w-full h-20 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center gap-1 bg-slate-50/50 hover:bg-slate-50 transition-colors disabled:opacity-50">
                  {uploadingPdf ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
                      <span className="text-xs text-indigo-600 font-medium">Uploading... {uploadProgress}%</span>
                    </>
                  ) : (
                    <><Upload className="h-5 w-5 text-slate-400" /><span className="text-xs font-medium text-slate-500">Upload invoice PDF</span></>
                  )}
                </button>
                {uploadingPdf && (
                  <div className="mt-1.5 w-full bg-slate-200 rounded-full h-1.5">
                    <div className="bg-indigo-500 h-1.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* AI Parsing Status */}
        {parsing && (
          <Card className="border-purple-200 bg-purple-50">
            <CardContent className="p-3 flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-purple-600 shrink-0" />
              <div>
                <p className="text-sm font-medium text-purple-900">AI Reading Bill...</p>
                <p className="text-[10px] text-purple-600">{parseStatus}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {aiParsed && !parsing && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-green-600 shrink-0" />
                <p className="text-xs text-green-800 font-medium">{parseStatus}</p>
              </div>
              <button onClick={handleReparse} disabled={parsing}
                className="text-[10px] text-green-700 font-medium hover:underline shrink-0">
                Re-parse
              </button>
            </CardContent>
          </Card>
        )}

        {/* Bill Details */}
        {selectedBrand && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Bill No *</label>
                <Input value={billNo} onChange={(e) => setBillNo(e.target.value)} placeholder="Invoice number" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Bill Date *</label>
                <Input type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} />
              </div>
            </div>

            {selectedBrandData && billDate && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                <p className="text-xs text-amber-700">
                  <span className="font-medium">Expected delivery:</span>{" "}
                  {new Date(new Date(billDate).getTime() + selectedBrandData.leadDays * 86400000).toLocaleDateString("en-IN", {
                    day: "numeric", month: "short", year: "numeric",
                  })}
                  {" "}({selectedBrandData.leadDays} days lead time)
                </p>
              </div>
            )}

            {/* Line Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-slate-700">
                  Line Items ({lineItems.length})
                </label>
                <button onClick={addRow} className="text-xs text-indigo-600 font-medium hover:underline">
                  + Add Row
                </button>
              </div>

              {lineItems.length === 0 && !parsing ? (
                <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-lg">
                  <Edit3 className="h-6 w-6 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs text-slate-400">
                    {(billImageUrl || billPdfUrl) ? "AI didn't find items. Add manually." : "Upload a bill photo or PDF for AI auto-fill, or add manually."}
                  </p>
                  <button onClick={addRow} className="text-xs text-indigo-600 font-medium mt-2">Add Item</button>
                </div>
              ) : (
                <div className="space-y-2">
                  {lineItems.map((li, idx) => (
                    <Card key={idx} className={li.matchedProductId ? "border-green-200" : "border-indigo-100"}>
                      <CardContent className="p-3">
                        {/* Product match indicator */}
                        {li.matchedProductName && li.productId && (
                          <div className="flex items-center justify-between mb-2 bg-green-50 rounded-lg p-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <CheckCircle2 className="h-3 w-3 text-green-600 shrink-0" />
                              <div className="min-w-0">
                                <p className="text-[10px] text-green-700 font-medium truncate">
                                  Matched: {li.matchedProductName}
                                </p>
                                <p className="text-[9px] text-green-500">
                                  SKU: {li.matchedSku}
                                </p>
                              </div>
                            </div>
                            <button onClick={() => rejectMatch(idx)}
                              className="text-[9px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded font-medium shrink-0">
                              Change
                            </button>
                          </div>
                        )}

                        {/* AI suggested match — needs confirmation */}
                        {li.matchedProductName && !li.productId && (
                          <div className="flex items-center justify-between mb-2 bg-blue-50 rounded-lg p-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Link2 className="h-3 w-3 text-blue-600 shrink-0" />
                              <div className="min-w-0">
                                <p className="text-[10px] text-blue-700 font-medium truncate">
                                  AI suggests: {li.matchedProductName}
                                </p>
                                <p className="text-[9px] text-blue-500">
                                  SKU: {li.matchedSku} | {li.matchScore}% match
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <button onClick={() => acceptMatch(idx)}
                                className="text-[9px] bg-green-600 text-white px-2 py-0.5 rounded font-medium">
                                Accept
                              </button>
                              <button onClick={() => rejectMatch(idx)}
                                className="text-[9px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded font-medium">
                                Reject
                              </button>
                            </div>
                          </div>
                        )}

                        {/* No match — show SKU input for manual matching */}
                        {!li.matchedProductId && !li.productId && li.productName && (
                          <div className="mb-2 bg-amber-50 border border-amber-200 rounded-lg p-2">
                            <div className="flex items-center gap-1.5 mb-1.5 text-amber-700">
                              <AlertCircle className="h-3 w-3 shrink-0" />
                              <p className="text-[10px] font-medium">No match — enter SKU to match manually</p>
                            </div>
                            <div className="flex gap-1.5">
                              <Input
                                placeholder="Enter SKU code..."
                                className="text-xs h-7 flex-1"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    handleSkuMatch(idx, (e.target as HTMLInputElement).value);
                                  }
                                }}
                                id={`sku-input-${idx}`}
                              />
                              <button
                                onClick={() => {
                                  const input = document.getElementById(`sku-input-${idx}`) as HTMLInputElement;
                                  if (input) handleSkuMatch(idx, input.value);
                                }}
                                disabled={skuLoading === idx}
                                className="text-[10px] bg-amber-600 text-white px-2.5 py-1 rounded font-medium shrink-0 disabled:opacity-50">
                                {skuLoading === idx ? "..." : "Match"}
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="flex items-start justify-between mb-2">
                          <Input value={li.productName}
                            onChange={(e) => updateRow(idx, "productName", e.target.value)}
                            placeholder="Product name" className="text-sm flex-1 mr-2" />
                          <button onClick={() => removeRow(idx)} className="p-1.5 text-red-400 hover:text-red-600">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          <div>
                            <label className="text-[10px] text-slate-500">Qty</label>
                            <Input type="number" min="1" value={li.quantity}
                              onChange={(e) => updateRow(idx, "quantity", parseInt(e.target.value) || 0)}
                              className="text-sm" />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-500">Rate (pre-tax)</label>
                            <Input type="number" min="0" value={li.rate}
                              onChange={(e) => updateRow(idx, "rate", parseFloat(e.target.value) || 0)}
                              className="text-sm" />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-500">GST %</label>
                            <Input type="number" min="0" max="28" value={li.gstPercent}
                              onChange={(e) => updateRow(idx, "gstPercent", parseFloat(e.target.value) || 0)}
                              className="text-sm" />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-500">Total (incl.)</label>
                            <Input type="number" value={li.amount} readOnly className="text-sm bg-slate-50" />
                          </div>
                        </div>
                        {li.gstAmount > 0 && (
                          <p className="text-[10px] text-slate-400 mt-1">
                            Base: {new Intl.NumberFormat("en-IN").format(li.quantity * li.rate)} + GST {li.gstPercent}%: {new Intl.NumberFormat("en-IN").format(li.gstAmount)}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}

                  <div className="text-right">
                    <span className="text-sm font-semibold text-slate-700">
                      Total: {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })
                        .format(lineItems.reduce((s, li) => s + li.amount, 0))}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional details..." rows={2}
                className="flex w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600" />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            {lineItems.length > 0 && !allItemsMatched && (
              <p className="text-xs text-amber-600 font-medium text-center">
                {unmatchedCount} item(s) not matched — match all items using SKU before submitting
              </p>
            )}

            <Button type="button" size="lg" onClick={handleSubmit}
              disabled={step === "submitting" || !selectedBrand || (!billImageUrl && !billPdfUrl) || !billNo || !billDate || lineItems.length === 0 || !allItemsMatched}
              className={`w-full ${allItemsMatched ? "bg-indigo-600 hover:bg-indigo-700" : "bg-slate-400"}`}>
              {step === "submitting" ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating...</>
              ) : !allItemsMatched && lineItems.length > 0 ? (
                `Match all items first (${unmatchedCount} remaining)`
              ) : (
                `Create Shipment (${lineItems.length} items)`
              )}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
