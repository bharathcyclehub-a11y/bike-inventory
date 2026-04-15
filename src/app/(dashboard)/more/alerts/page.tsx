"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Save, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

export default function AlertsConfigPage() {
  const [phones, setPhones] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/alerts/config")
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data?.redFlagPhones) {
          setPhones(res.data.redFlagPhones.split(",").map((p: string) => p.trim()).filter(Boolean));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/alerts/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ redFlagPhones: phones.filter(Boolean).join(",") }),
      });
      const data = await res.json();
      if (data.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch { /* */ }
    finally { setSaving(false); }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Link href="/more" className="p-1"><ArrowLeft className="h-5 w-5 text-slate-600" /></Link>
        <div>
          <h1 className="text-lg font-bold text-slate-900">Alert Config</h1>
          <p className="text-xs text-slate-500">WhatsApp numbers for red flag alerts</p>
        </div>
      </div>

      <Card className="mb-4 bg-amber-50 border-amber-200">
        <CardContent className="p-3">
          <p className="text-xs text-amber-800">
            When Ranjitha flags a delivery, a WhatsApp message will be pre-filled and sent to these numbers.
            Use country code format (e.g. 919876543210).
          </p>
        </CardContent>
      </Card>

      <div className="space-y-2 mb-4">
        {phones.map((phone, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={phone}
              onChange={(e) => {
                const updated = [...phones];
                updated[i] = e.target.value;
                setPhones(updated);
              }}
              placeholder="919876543210"
              type="tel"
              className="flex-1"
            />
            <button onClick={() => setPhones(phones.filter((_, idx) => idx !== i))}
              className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <button onClick={() => setPhones([...phones, ""])}
        className="w-full flex items-center justify-center gap-2 border border-dashed border-slate-300 text-slate-500 py-2.5 rounded-lg text-sm font-medium mb-4">
        <Plus className="h-4 w-4" /> Add Phone Number
      </button>

      <button onClick={handleSave} disabled={saving}
        className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white py-3 rounded-lg text-sm font-medium disabled:opacity-50">
        <Save className="h-4 w-4" />
        {saving ? "Saving..." : saved ? "Saved!" : "Save Configuration"}
      </button>
    </div>
  );
}
