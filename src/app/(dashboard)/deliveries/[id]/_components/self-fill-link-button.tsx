"use client";

import { useState } from "react";
import { Link2, Copy, Check, ExternalLink, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface SelfFillLinkButtonProps {
  deliveryId: string;
  customerPhone: string | null;
  selfFillCompletedAt: string | null;
}

export function SelfFillLinkButton({ deliveryId, customerPhone, selfFillCompletedAt }: SelfFillLinkButtonProps) {
  const [link, setLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const generateLink = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/deliveries/${deliveryId}/generate-token`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        const url = `${window.location.origin}/fill/${data.data.token}`;
        setLink(url);
      } else {
        setError(data.error || "Failed to generate link");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const copyLink = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for mobile
      const input = document.createElement("input");
      input.value = link;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const sendViaWhatsApp = () => {
    if (!link || !customerPhone) return;
    const phone = customerPhone.startsWith("+91") ? customerPhone.replace("+", "") : `91${customerPhone}`;
    const msg = encodeURIComponent(
      `Hi! Please fill in your delivery address using this link:\n${link}\n\nThis link expires in 48 hours.\n\n— Bharath Cycle Hub`
    );
    window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
  };

  if (selfFillCompletedAt) {
    return (
      <Card className="mb-3 border-green-200 bg-green-50">
        <CardContent className="p-3 flex items-center gap-2">
          <Check className="h-4 w-4 text-green-600" />
          <span className="text-sm text-green-700 font-medium">Customer filled delivery details</span>
          <span className="text-xs text-green-500 ml-auto">
            {new Date(selfFillCompletedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
          </span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-3">
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
            <Link2 className="h-4 w-4 text-blue-500" />
            Customer Self-Fill Link
          </span>
        </div>

        {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

        {!link ? (
          <button
            onClick={generateLink}
            disabled={loading}
            className="w-full py-2.5 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating...
              </span>
            ) : (
              "Generate Link for Customer"
            )}
          </button>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-2">
              <input
                readOnly
                value={link}
                className="flex-1 text-xs text-slate-600 bg-transparent outline-none truncate"
              />
              <button
                onClick={copyLink}
                className="p-1.5 rounded-md bg-white border border-slate-200 hover:bg-slate-100"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-green-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-slate-500" />
                )}
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={copyLink}
                className="flex-1 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium"
              >
                {copied ? "Copied!" : "Copy Link"}
              </button>
              {customerPhone && (
                <button
                  onClick={sendViaWhatsApp}
                  className="flex-1 py-2 bg-green-100 text-green-700 rounded-lg text-xs font-medium flex items-center justify-center gap-1"
                >
                  <ExternalLink className="h-3 w-3" /> Send via WhatsApp
                </button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
