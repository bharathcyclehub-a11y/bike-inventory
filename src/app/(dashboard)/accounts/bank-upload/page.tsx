"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft, Upload, FileSpreadsheet, Loader2, CheckCircle2,
  AlertTriangle, Eye, Clock,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface StatementItem {
  id: string;
  bank: string;
  fileName: string;
  fromDate: string | null;
  toDate: string | null;
  totalCredits: number;
  totalDebits: number;
  txnCount: number;
  matchedCount: number;
  flaggedCount: number;
  createdAt: string;
  uploadedBy: { name: string };
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}

export default function BankUploadPage() {
  const [statements, setStatements] = useState<StatementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [bank, setBank] = useState("HDFC");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchStatements = () => {
    setLoading(true);
    fetch("/api/bank-statements")
      .then((r) => r.json())
      .then((res) => { if (res.success) setStatements(res.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchStatements(); }, []);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setError("");
    setSuccess("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("bank", bank);

    try {
      const res = await fetch("/api/bank-statements", { method: "POST", body: formData });
      const data = await res.json();

      if (!data.success) {
        setError(data.error || "Upload failed");
      } else {
        setSuccess(
          `Processed ${data.data.txnCount} transactions. ${data.data.matchedCount} matched, ${data.data.flaggedCount} flagged.`
        );
        fetchStatements();
      }
    } catch {
      setError("Upload failed — check your connection");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Link href="/accounts" className="p-1"><ArrowLeft className="h-5 w-5 text-slate-600" /></Link>
        <h1 className="text-lg font-bold text-slate-900">Bank Statement</h1>
      </div>

      {/* Upload Card */}
      <Card className="mb-4 border-dashed border-2 border-slate-300">
        <CardContent className="p-4">
          <div className="text-center mb-3">
            <FileSpreadsheet className="h-8 w-8 text-slate-400 mx-auto mb-1" />
            <p className="text-sm font-medium text-slate-700">Upload Bank Statement</p>
            <p className="text-[10px] text-slate-400">CSV or XLS from HDFC / ICICI</p>
          </div>

          {/* Bank Selector */}
          <div className="flex gap-2 justify-center mb-3">
            {["HDFC", "ICICI"].map((b) => (
              <button
                key={b}
                onClick={() => setBank(b)}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  bank === b ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                {b}
              </button>
            ))}
          </div>

          {/* File Input */}
          <label className={`flex items-center justify-center gap-2 w-full py-3 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
            uploading ? "bg-slate-100 text-slate-400" : "bg-blue-600 text-white hover:bg-blue-700"
          }`}>
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                AI is reading your statement...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Choose File & Upload
              </>
            )}
            <input
              type="file"
              accept=".csv,.xls,.xlsx,.txt"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
                e.target.value = "";
              }}
            />
          </label>
        </CardContent>
      </Card>

      {/* Status Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 mb-3 text-xs text-red-700 flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <div>{error} <button onClick={() => setError("")} className="underline ml-1">dismiss</button></div>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-2.5 mb-3 text-xs text-green-700 flex items-start gap-2">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <div>{success} <button onClick={() => setSuccess("")} className="underline ml-1">dismiss</button></div>
        </div>
      )}

      {/* Past Statements */}
      <h2 className="text-sm font-semibold text-slate-900 mb-2">Past Uploads</h2>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="h-5 w-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : statements.length === 0 ? (
        <div className="text-center py-8">
          <FileSpreadsheet className="h-6 w-6 text-slate-300 mx-auto mb-1" />
          <p className="text-xs text-slate-400">No statements uploaded yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {statements.map((s) => (
            <Link key={s.id} href={`/accounts/reconcile/${s.id}`}>
              <Card className="hover:border-slate-300 transition-colors mb-2">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="default" className="text-[10px]">{s.bank}</Badge>
                        <span className="text-sm font-medium text-slate-900">{s.fileName}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {s.fromDate && s.toDate
                          ? `${new Date(s.fromDate).toLocaleDateString("en-IN")} — ${new Date(s.toDate).toLocaleDateString("en-IN")}`
                          : new Date(s.createdAt).toLocaleDateString("en-IN")}
                        {" | "}by {s.uploadedBy.name}
                      </p>
                    </div>
                    <Eye className="h-4 w-4 text-slate-400 shrink-0" />
                  </div>

                  <div className="flex gap-3 mt-1.5 text-[10px]">
                    <span className="text-slate-500">{s.txnCount} txns</span>
                    <span className="text-green-600">{s.matchedCount} matched</span>
                    {s.flaggedCount > 0 && (
                      <span className="text-red-600">{s.flaggedCount} flagged</span>
                    )}
                    <span className="text-slate-400">{s.txnCount - s.matchedCount - s.flaggedCount} pending</span>
                  </div>

                  <div className="flex gap-3 mt-1 text-[10px]">
                    <span className="text-green-600">In: {formatCurrency(s.totalCredits)}</span>
                    <span className="text-red-600">Out: {formatCurrency(s.totalDebits)}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
