"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft, Cloud, CloudOff, CheckCircle2, XCircle,
  Package, Users, Receipt, Loader2, Clock, AlertTriangle,
  Download, RefreshCw,
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

export default function ZohoSettingsPage() {
  const [status, setStatus] = useState<ZohoStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [logs, setLogs] = useState<SyncLogEntry[]>([]);
  const [error, setError] = useState("");
  const [pulling, setPulling] = useState(false);
  const [pullResult, setPullResult] = useState<string | null>(null);

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
    if (!confirm("This will pull new data from Zoho into preview. Continue?")) return;
    setPulling(true);
    setPullResult(null);
    try {
      const res = await fetch("/api/zoho/trigger-pull", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        const d = data.data;
        if (d.status === "NO_NEW_DATA") {
          setPullResult("No new data — everything is already synced.");
        } else {
          setPullResult(`Pulled ${d.contactsNew} vendors, ${d.itemsNew} items, ${d.billsNew} bills, ${d.invoicesNew} invoices. Go to Review & Approve.`);
        }
      } else {
        setPullResult(`Error: ${data.error}`);
      }
    } catch {
      setPullResult("Something went wrong");
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
                <div className="flex flex-col gap-1">
                  <Badge variant={status.tokenValid ? "success" : "warning"} className="text-[9px]">
                    {status.tokenValid ? "Token Valid" : "Token Expired"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cron Info */}
          <Card className="mb-4 border-blue-200 bg-blue-50">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-4 w-4 text-blue-600" />
                <p className="text-xs font-semibold text-blue-900">Auto-Sync: Daily at 1 PM IST</p>
              </div>
              <p className="text-[10px] text-blue-700">
                Pulls new vendors, items, bills, and invoices from Zoho. All data goes to preview for approval first. ~5-26 API calls/day.
              </p>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleTriggerPull}
                  disabled={pulling}
                  className="flex-1 flex items-center justify-center gap-1.5 border border-blue-300 text-blue-700 px-3 py-2 rounded-lg text-xs font-medium hover:bg-blue-100 disabled:opacity-50"
                >
                  {pulling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  {pulling ? "Pulling..." : "Pull Now"}
                </button>
                <Link href="/more/zoho/pull-review"
                  className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 text-white px-3 py-2 rounded-lg text-xs font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Review Pulls
                </Link>
              </div>
              {pullResult && (
                <p className={`text-[10px] mt-2 p-2 rounded-lg ${pullResult.startsWith("Error") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
                  {pullResult}
                </p>
              )}
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
