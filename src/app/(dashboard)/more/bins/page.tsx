"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Warehouse, Plus } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Bin {
  id: string;
  code: string;
  name: string;
  location: string;
}

export default function BinsPage() {
  const [bins, setBins] = useState<Bin[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function fetchBins() {
    fetch("/api/bins")
      .then((r) => r.json())
      .then((res) => { if (res.success) setBins(res.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchBins(); }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || !name.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/bins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim(), name: name.trim(), location: location.trim() }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to create bin");
      setCode(""); setName(""); setLocation(""); setShowAdd(false);
      fetchBins();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Link href="/more" className="p-1"><ArrowLeft className="h-5 w-5 text-slate-600" /></Link>
        <h1 className="text-lg font-bold text-slate-900 flex-1">Bins & Locations</h1>
        <Button size="sm" onClick={() => setShowAdd(!showAdd)} variant={showAdd ? "outline" : "default"}>
          <Plus className="h-4 w-4 mr-1" /> {showAdd ? "Cancel" : "Add Bin"}
        </Button>
      </div>

      {showAdd && (
        <Card className="mb-4">
          <CardContent className="p-3">
            <form onSubmit={handleAdd} className="space-y-2">
              <Input placeholder="Bin code (e.g. A1, B2)" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} autoFocus />
              <Input placeholder="Bin name (e.g. Rack A Shelf 1)" value={name} onChange={(e) => setName(e.target.value)} />
              <Input placeholder="Location (e.g. Ground Floor)" value={location} onChange={(e) => setLocation(e.target.value)} />
              {error && <p className="text-xs text-red-600">{error}</p>}
              <Button type="submit" size="sm" disabled={saving || !code.trim() || !name.trim()} className="w-full">
                {saving ? "Saving..." : "Create Bin"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {bins.length === 0 ? (
        <div className="text-center py-12">
          <Warehouse className="h-10 w-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-400">No bins created yet</p>
          <p className="text-xs text-slate-300 mt-1">Add bins to organize product storage</p>
        </div>
      ) : (
        <div className="space-y-2">
          {bins.map((bin) => (
            <Card key={bin.id}>
              <CardContent className="p-3 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center">
                  <span className="text-sm font-bold text-slate-600">{bin.code}</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">{bin.name}</p>
                  {bin.location && <p className="text-xs text-slate-500">{bin.location}</p>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
