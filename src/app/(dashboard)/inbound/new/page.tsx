"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, Camera, Loader2, CheckCircle2, Trash2, Edit3, FileText, Upload } from "lucide-react";
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
  amount: number;
  hsn?: string;
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
  const [billPdfUrl, setBillPdfUrl] = useState("");
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

  const selectedBrandData = brands.find((b) => b.brandId === selectedBrand);

  useEffect(() => {
    fetch("/api/brand-lead-time").then((r) => r.json()).then((res) => {
      if (res.success) setBrands(res.data);
    }).catch(() => {});
  }, []);

  // Handle photo capture
  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxSize = 1200; // higher res for OCR
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
        setBillImageUrl(canvas.toDataURL("image/jpeg", 0.8));
        setStep("verify");
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Handle PDF upload to Supabase
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
    setUploadingPdf(true);
    setUploadProgress(10);
    setError("");
    try {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      setUploadProgress(20);
      const path = `bills/${Date.now()}-${file.name.replace(/\s+/g, "-")}`;
      // Simulate progress steps during upload
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 500);
      const url = await uploadImage(file, path);
      clearInterval(progressInterval);
      setUploadProgress(100);
      setBillPdfUrl(url);
      setPdfName(`${file.name} (${sizeMB} MB)`);
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
    setLineItems([...lineItems, { productName: "", quantity: 1, rate: 0, amount: 0 }]);
  };

  const updateRow = (idx: number, field: keyof LineItem, value: string | number) => {
    setLineItems((prev) => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: value };
      if (field === "quantity" || field === "rate") {
        updated.amount = (updated.quantity || 0) * (updated.rate || 0);
      }
      return updated;
    }));
  };

  const removeRow = (idx: number) => {
    setLineItems((prev) => prev.filter((_, i) => i !== idx));
  };

  // Submit
  const handleSubmit = async () => {
    if (!selectedBrand || !billImageUrl || !billNo || !billDate || lineItems.length === 0) {
      setError("Brand, bill photo, bill number, bill date, and at least one item required");
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
          billImageUrl,
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
            setBillPdfUrl("");
            setPdfName("");
            setBillNo("");
            setBillDate(new Date().toISOString().split("T")[0]);
            setLineItems([]);
            setNotes("");
            setCreatedShipment(null);
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
          <p className="text-xs text-slate-500">Upload bill photo → enter details → track delivery</p>
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
            <label className="block text-sm font-medium text-slate-700 mb-1">Bill Photo *</label>
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
            <label className="block text-sm font-medium text-slate-700 mb-1">Invoice PDF (optional)</label>
            <input ref={pdfInputRef} type="file" accept="application/pdf" onChange={handlePdfUpload} className="hidden" />

            {billPdfUrl ? (
              <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg p-3">
                <FileText className="h-8 w-8 text-green-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-green-800 truncate">{pdfName}</p>
                  <p className="text-[10px] text-green-600">Uploaded</p>
                </div>
                <button onClick={() => { setBillPdfUrl(""); setPdfName(""); }}
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

        {/* Bill Details — visible once brand is selected */}
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

              {lineItems.length === 0 ? (
                <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-lg">
                  <Edit3 className="h-6 w-6 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs text-slate-400">No items yet. AI didn&apos;t find any or add manually.</p>
                  <button onClick={addRow} className="text-xs text-indigo-600 font-medium mt-2">Add Item</button>
                </div>
              ) : (
                <div className="space-y-2">
                  {lineItems.map((li, idx) => (
                    <Card key={idx} className="border-indigo-100">
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between mb-2">
                          <Input value={li.productName}
                            onChange={(e) => updateRow(idx, "productName", e.target.value)}
                            placeholder="Product name" className="text-sm flex-1 mr-2" />
                          <button onClick={() => removeRow(idx)} className="p-1.5 text-red-400 hover:text-red-600">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-[10px] text-slate-500">Qty</label>
                            <Input type="number" min="1" value={li.quantity}
                              onChange={(e) => updateRow(idx, "quantity", parseInt(e.target.value) || 0)}
                              className="text-sm" />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-500">Rate</label>
                            <Input type="number" min="0" value={li.rate}
                              onChange={(e) => updateRow(idx, "rate", parseFloat(e.target.value) || 0)}
                              className="text-sm" />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-500">Amount</label>
                            <Input type="number" value={li.amount} readOnly className="text-sm bg-slate-50" />
                          </div>
                        </div>
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

            <Button type="button" size="lg" onClick={handleSubmit}
              disabled={step === "submitting" || !selectedBrand || !billImageUrl || !billNo || !billDate || lineItems.length === 0}
              className="w-full bg-indigo-600 hover:bg-indigo-700">
              {step === "submitting" ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating...</>
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
