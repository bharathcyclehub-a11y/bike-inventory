"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft, Cloud, CloudOff, CheckCircle2, XCircle,
  Package, Users, Receipt, Loader2, Clock, AlertTriangle,
  Download, RefreshCw, FileText, ShoppingCart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ZohoStatus {
  connected: boolean;
  organizationId?: string;
  organizationName?: string;
  lastSyncAt?: string;
  tokenValid?: boolean;
}

interface SyncResult {
  syncType: string;
  status: string;
  total: number;
  synced: number;
  failed: number;
  errors: string[];
}

interface SyncLogEntry {
  id: string;
  syncType: string;
  status: string;
  totalItems: number;
  synced: number;
  failed: number;
  startedAt: string;
  completedAt?: string;
}

interface PullProgress {
  step: string;
  message: string;
  progress: number;
  itemsNew?: number;
  contactsNew?: number;
  billsNew?: number;
  invoicesNew?: number;
  apiCalls?: number;
  errors?: string[];
}

const PULL_STEPS = [
  { key: "init", label: "Connecting", icon: Cloud },
  { key: "items", label: "Items", icon: Package },
  { key: "contacts", label: "Vendors", icon: Users },
  { key: "bills", label: "Bills", icon: FileText },
  { key: "invoices", label: "Invoices", icon: ShoppingCart },
  { key: "saving", label: "Saving", icon: CheckCircle2 },
];

function getStepStatus(stepKey: string, currentStep: string): "pending" | "active" | "done" {
  const order = ["init", "connected", "items", "items-done", "contacts", "contacts-done", "bills", "bills-done", "invoices", "invoices-done", "saving", "done"];
  const stepMap: Record<string, string> = { init: "init", connected: "init", items: "items", "items-done": "items", contacts: "contacts", "contacts-done": "contacts", bills: "bills", "bills-done": "bills", invoices: "invoices", "invoices-done": "invoices", saving: "saving", done: "saving" };

  const currentBase = stepMap[currentStep] || currentStep;
  const currentIdx = PULL_STEPS.findIndex((s) => s.key === currentBase);
  const stepIdx = PULL_STEPS.findIndex((s) => s.key === stepKey);

  if (currentStep === "done" || currentStep === "error") {
    return currentStep === "done" ? "done" : stepIdx <= currentIdx ? "done" : "pending";
  }
  if (stepIdx < currentIdx) return "done";
  if (stepIdx === currentIdx) return "active";
  return "pending";
}

export default function ZohoSettingsPage() {
  const [status, setStatus] = useState<ZohoStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [logs, setLogs] = useState<SyncLogEntry[]>([]);
  const [error, setError] = useState("");

  // Pull progress state
  const [pulling, setPulling] = useState(false);
  const [pullProgress, setPullProgress] = useState<PullProgress | null>(null);
  const [pullDone, setPullDone] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Setup form
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [grantToken, setGrantToken] = useState("");
  const [orgId, setOrgId] = useState("");
  const [orgName, setOrgName] = useState("");

  useEffect(() => {
    fetchStatus();
    fetchLogs();
  }, []);

  async function fetchStatus() {
    try {
      const res = await fetch("/api/zoho/auth/status");
      const data = await res.json();
      if (data.success) setStatus(data.data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  async function fetchLogs() {
    try {
      const res = await fetch("/api/zoho/sync/logs?limit=10");
      const data = await res.json();
      if (data.success) setLogs(data.data);
    } catch { /* ignore */ }
  }

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setConnecting(true);
    setError("");
    try {
      const res = await fetch("/api/zoho/auth/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, clientSecret, grantToken, organizationId: orgId, organizationName: orgName }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchStatus();
        setClientId(""); setClientSecret(""); setGrantToken("");
      } else {
        setError(data.error || "Connection failed");
      }
    } catch { setError("Network error"); }
    finally { setConnecting(false); }
  }

  async function handleDisconnect() {
    try {
      await fetch("/api/zoho/auth/disconnect", { method: "POST" });
      setStatus({ connected: false });
    } catch { /* ignore */ }
  }

  async function handleImport(type: string) {
    setImporting(type);
    setSyncResult(null);
    try {
      const res = await fetch(`/api/zoho/import/${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.success) {
        const d = data.data;
        setSyncResult({
          syncType: `import-${type}`,
          status: d.status,
          total: d.total,
          synced: d.imported,
          failed: d.failed,
          errors: d.errors || [],
        });
        fetchLogs();
      } else {
        setSyncResult({ syncType: `import-${type}`, status: "failed", total: 0, synced: 0, failed: 0, errors: [data.error] });
      }
    } catch {
      setSyncResult({ syncType: `import-${type}`, status: "failed", total: 0, synced: 0, failed: 0, errors: ["Network error"] });
    } finally { setImporting(null); }
  }

  async function handleTriggerPull() {
    if (!confirm("Pull new data from Zoho into preview for review?")) return;

    setPulling(true);
    setPullDone(false);
    setPullProgress({ step: "init", message: "Starting...", progress: 0 });

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const res = await fetch("/api/zoho/trigger-pull", {
        method: "POST",
        signal: abort.signal,
      });

      // Check if it's SSE or JSON error
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const data = await res.json();
        setPullProgress({ step: "error", message: data.error || "Failed", progress: 0 });
        setPulling(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setPullProgress({ step: "error", message: "No response stream", progress: 0 });
        setPulling(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6)) as PullProgress;
              setPullProgress(data);
              if (data.step === "done") {
                setPullDone(true);
                fetchLogs();
              }
            } catch { /* ignore parse errors */ }
          }
        }
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setPullProgress({ step: "error", message: "Connection lost", progress: 0 });
    } finally {
      setPulling(false);
    }
  }

  const IMPORT_TYPES = [
    { key: "contacts", label: "Vendors", icon: Users, desc: "Pull vendors from Zoho" },
    { key: "items", label: "Products & Brands", icon: Package, desc: "Pull items + brand details from Zoho (updates existing)" },
    { key: "bills", label: "Purchase Bills", icon: Receipt, desc: "Pull bills from Zoho (creates inward for verification)" },
  ];

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Link href="/more" className="p-1"><ArrowLeft className="h-5 w-5 text-slate-600" /></Link>
        <div>
          <h1 className="text-lg font-bold text-slate-900">Zoho Books</h1>
          <p className="text-xs text-slate-500">Sync inventory with Zoho</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : status?.connected ? (
        <>
          {/* Connected Status */}
          <Card className="mb-4 border-green-200 bg-green-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Cloud className="h-8 w-8 text-green-600" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-green-900">Connected to Zoho Books</p>
                  {status.organizationName && <p className="text-xs text-green-700">{status.organizationName}</p>}
                  {status.lastSyncAt && (
                    <p className="text-[10px] text-green-600 mt-1">
                      Last sync: {new Date(status.lastSyncAt).toLocaleString("en-IN")}
                    </p>
                  )}
                </div>
                <Badge variant={status.tokenValid ? "success" : "warning"} className="text-[9px]">
                  {status.tokenValid ? "Token Valid" : "Token Expired"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Pull from Zoho — with progress */}
          <Card className="mb-4 border-blue-200 bg-blue-50">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-4 w-4 text-blue-600" />
                <p className="text-xs font-semibold text-blue-900">Auto-Sync: Daily at 1 PM IST</p>
              </div>
              <p className="text-[10px] text-blue-700 mb-3">
                Pulls new vendors, items, bills, and invoices. All data goes to preview for approval first.
              </p>

              {/* Progress UI */}
              {pullProgress && (pulling || pullDone || pullProgress.step === "error") && (
                <div className="bg-white rounded-lg border border-blue-200 p-3 mb-3">
                  {/* Progress bar */}
                  <div className="flex items-center gap-2 mb-2">
                    {pullProgress.step === "error" ? (
                      <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                    ) : pullProgress.step === "done" ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                    ) : (
                      <Loader2 className="h-4 w-4 text-blue-500 animate-spin shrink-0" />
                    )}
                    <p className="text-xs font-medium text-slate-700 flex-1">{pullProgress.message}</p>
                    <span className="text-xs font-bold text-blue-600">{pullProgress.progress}%</span>
                  </div>

                  {/* Bar */}
                  <div className="w-full bg-slate-100 rounded-full h-2 mb-3 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ease-out ${
                        pullProgress.step === "error" ? "bg-red-500" : pullProgress.step === "done" ? "bg-green-500" : "bg-blue-500"
                      }`}
                      style={{ width: `${pullProgress.progress}%` }}
                    />
                  </div>

                  {/* Step indicators */}
                  <div className="grid grid-cols-6 gap-1">
                    {PULL_STEPS.map((s) => {
                      const Icon = s.icon;
                      const stepStatus = pullProgress.step === "error" ? "pending" : getStepStatus(s.key, pullProgress.step);
                      return (
                        <div key={s.key} className="flex flex-col items-center">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center mb-0.5 ${
                            stepStatus === "done" ? "bg-green-100" : stepStatus === "active" ? "bg-blue-100" : "bg-slate-100"
                          }`}>
                            {stepStatus === "done" ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                            ) : stepStatus === "active" ? (
                              <Icon className="h-3 w-3 text-blue-600" />
                            ) : (
                              <Icon className="h-3 w-3 text-slate-300" />
                            )}
                          </div>
                          <span className={`text-[9px] ${
                            stepStatus === "done" ? "text-green-600 font-medium" : stepStatus === "active" ? "text-blue-600 font-medium" : "text-slate-400"
                          }`}>{s.label}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Results summary when done */}
                  {pullProgress.step === "done" && (
                    <div className="mt-3 grid grid-cols-4 gap-2">
                      {[
                        { label: "Items", count: pullProgress.itemsNew || 0, icon: Package },
                        { label: "Vendors", count: pullProgress.contactsNew || 0, icon: Users },
                        { label: "Bills", count: pullProgress.billsNew || 0, icon: FileText },
                        { label: "Invoices", count: pullProgress.invoicesNew || 0, icon: ShoppingCart },
                      ].map((r) => {
                        const RIcon = r.icon;
                        return (
                          <div key={r.label} className="text-center p-1.5 rounded-lg bg-green-50 border border-green-100">
                            <RIcon className="h-3.5 w-3.5 text-green-600 mx-auto mb-0.5" />
                            <p className="text-sm font-bold text-green-800">{r.count}</p>
                            <p className="text-[9px] text-green-600">{r.label}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Errors */}
                  {pullProgress.errors && pullProgress.errors.length > 0 && (
                    <div className="mt-2 space-y-0.5">
                      {pullProgress.errors.map((e, i) => (
                        <p key={i} className="text-[10px] text-red-500">{e}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  onClick={handleTriggerPull}
                  disabled={pulling}
                  className="flex-1 flex items-center justify-center gap-1.5 border border-blue-300 text-blue-700 px-3 py-2.5 rounded-lg text-xs font-medium hover:bg-blue-100 disabled:opacity-50 transition-colors"
                >
                  {pulling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  {pulling ? "Pulling..." : "Pull Now"}
                </button>
                <Link href="/more/zoho/pull-review"
                  className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 text-white px-3 py-2.5 rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Review Pulls
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Import from Zoho */}
          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Download className="h-4 w-4 text-blue-600" />
              <h2 className="text-sm font-semibold text-slate-900">Import from Zoho</h2>
            </div>
            <p className="text-[10px] text-slate-500 -mt-1 mb-2">Pull data from Zoho Books into this app</p>

            {IMPORT_TYPES.map((it) => {
              const Icon = it.icon;
              return (
                <Card key={it.key}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <Icon className="h-5 w-5 text-blue-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900">{it.label}</p>
                      <p className="text-[10px] text-slate-500">{it.desc}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => handleImport(it.key)} disabled={importing !== null}>
                      {importing === it.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Import"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Sync Result */}
          {syncResult && (
            <Card className={`mb-4 ${syncResult.status === "success" ? "border-green-200 bg-green-50" : syncResult.status === "partial" ? "border-yellow-200 bg-yellow-50" : "border-red-200 bg-red-50"}`}>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  {syncResult.status === "success" ? <CheckCircle2 className="h-4 w-4 text-green-600" /> :
                   syncResult.status === "partial" ? <AlertTriangle className="h-4 w-4 text-yellow-600" /> :
                   <XCircle className="h-4 w-4 text-red-600" />}
                  <p className="text-sm font-medium capitalize">{syncResult.syncType} — {syncResult.status}</p>
                </div>
                <p className="text-xs text-slate-600">
                  {syncResult.synced}/{syncResult.total} synced
                  {syncResult.failed > 0 && `, ${syncResult.failed} failed`}
                </p>
                {syncResult.errors.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {syncResult.errors.slice(0, 3).map((err, i) => (
                      <p key={i} className="text-[10px] text-red-600">{err}</p>
                    ))}
                    {syncResult.errors.length > 3 && (
                      <p className="text-[10px] text-red-500">+{syncResult.errors.length - 3} more errors</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Sync History */}
          {logs.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-slate-900 mb-2">Sync History</h2>
              <div className="space-y-1">
                {logs.map((log) => (
                  <div key={log.id} className="flex items-center gap-3 px-3 py-2 bg-slate-50 rounded-lg">
                    <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-700 capitalize">{log.syncType}</p>
                      <p className="text-[10px] text-slate-500">
                        {new Date(log.startedAt).toLocaleString("en-IN")} — {log.synced}/{log.totalItems} synced
                      </p>
                    </div>
                    <Badge variant={log.status === "success" ? "success" : log.status === "partial" ? "warning" : "danger"} className="text-[9px]">
                      {log.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Disconnect */}
          <button onClick={handleDisconnect}
            className="w-full mt-6 py-2 text-sm text-red-600 hover:text-red-700 font-medium">
            Disconnect from Zoho
          </button>
        </>
      ) : (
        <>
          {/* Not Connected */}
          <Card className="mb-4 border-slate-200">
            <CardContent className="p-4 text-center">
              <CloudOff className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-700">Not connected to Zoho</p>
              <p className="text-xs text-slate-500 mt-1">
                Enter your Zoho API credentials below to connect
              </p>
            </CardContent>
          </Card>

          {/* Setup Instructions */}
          <Card className="mb-4 bg-blue-50 border-blue-200">
            <CardContent className="p-3">
              <p className="text-xs font-semibold text-blue-900 mb-1">Setup Steps:</p>
              <ol className="text-[10px] text-blue-800 space-y-0.5 list-decimal list-inside">
                <li>Go to api-console.zoho.in and create a Self Client</li>
                <li>Note your Client ID and Client Secret</li>
                <li>Generate a Grant Token with scope: ZohoBooks.fullaccess.all</li>
                <li>Find your Organization ID in Zoho Books Settings</li>
                <li>Enter all details below and click Connect</li>
              </ol>
            </CardContent>
          </Card>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleConnect} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Client ID *</label>
              <Input placeholder="1000.XXXX..." value={clientId} onChange={(e) => setClientId(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Client Secret *</label>
              <Input type="password" placeholder="XXXX..." value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Grant Token *</label>
              <Input type="password" placeholder="1000.XXXX..." value={grantToken} onChange={(e) => setGrantToken(e.target.value)} />
              <p className="text-[10px] text-slate-400 mt-0.5">Expires in 2 minutes — generate and paste quickly</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Organization ID</label>
              <Input placeholder="123456789" value={orgId} onChange={(e) => setOrgId(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Organization Name</label>
              <Input placeholder="My Bike Store" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
            </div>
            <Button type="submit" size="lg" disabled={!clientId || !clientSecret || !grantToken || connecting} className="w-full bg-blue-600 hover:bg-blue-700">
              {connecting ? "Connecting..." : "Connect to Zoho"}
            </Button>
          </form>
        </>
      )}
    </div>
  );
}
