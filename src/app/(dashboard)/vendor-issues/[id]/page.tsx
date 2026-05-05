"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { ArrowLeft, Share2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface IssueDetail {
  id: string;
  issueNo: string;
  issueSource: string;
  issueType: string;
  description: string;
  status: string;
  priority: string;
  photoUrls?: string[];
  suggestedResolution?: string;
  resolution?: string;
  resolvedAt?: string;
  createdAt: string;
  vendor: { id: string; name: string; code: string } | null;
  clientName?: string;
  clientPhone?: string;
  bill?: { id: string; billNo: string; amount: number } | null;
  createdBy: { id: string; name: string };
}

const ISSUE_TYPE_COLORS: Record<string, string> = {
  QUALITY: "bg-red-100 text-red-700",
  SHORTAGE: "bg-orange-100 text-orange-700",
  DAMAGE: "bg-red-100 text-red-700",
  WRONG_ITEM: "bg-purple-100 text-purple-700",
  BILLING_ERROR: "bg-blue-100 text-blue-700",
  DELIVERY_DELAY: "bg-yellow-100 text-yellow-700",
  OTHER: "bg-slate-100 text-slate-700",
};

const PRIORITY_VARIANT: Record<string, "default" | "info" | "warning" | "danger"> = {
  LOW: "default",
  MEDIUM: "info",
  HIGH: "warning",
  URGENT: "danger",
};

const STATUS_VARIANT: Record<string, "default" | "info" | "warning" | "success"> = {
  OPEN: "warning",
  IN_PROGRESS: "info",
  RESOLVED: "success",
  CLOSED: "default",
};

export default function VendorIssueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [issue, setIssue] = useState<IssueDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [showResolution, setShowResolution] = useState(false);
  const [resolutionText, setResolutionText] = useState("");

  useEffect(() => {
    fetch(`/api/vendor-issues/${id}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setIssue(res.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  async function updateStatus(newStatus: string, resolution?: string) {
    setUpdating(true);
    try {
      const body: Record<string, string> = { status: newStatus };
      if (resolution) body.resolution = resolution;
      const res = await fetch(`/api/vendor-issues/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setIssue(data.data);
        setShowResolution(false);
        setResolutionText("");
      }
    } catch {
      // silent
    }
    setUpdating(false);
  }

  async function handleWhatsAppShare() {
    if (!issue) return;
    const source = issue.issueSource === "CLIENT"
      ? `Client: ${issue.clientName || "Unknown"}${issue.clientPhone ? ` (${issue.clientPhone})` : ""}`
      : `Brand: ${issue.vendor?.name || "Unknown"} (${issue.vendor?.code || ""})`;

    let text = `*Ops Issue ${issue.issueNo}*\n`;
    text += `Source: ${source}\n`;
    text += `Type: ${issue.issueType.replace(/_/g, " ")}\n`;
    text += `Priority: ${issue.priority}\n`;
    text += `Status: ${issue.status.replace(/_/g, " ")}\n\n`;
    text += `*Description:*\n${issue.description}\n`;
    if (issue.suggestedResolution) text += `\n*Suggested Resolution:*\n${issue.suggestedResolution}\n`;
    if (issue.resolution) text += `\n*Resolution:*\n${issue.resolution}\n`;
    if (issue.bill) text += `\nBill: ${issue.bill.billNo}\n`;
    text += `\nCreated: ${new Date(issue.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`;

    // Try native share with images
    if (issue.photoUrls && issue.photoUrls.length > 0 && navigator.share) {
      try {
        const files: File[] = [];
        for (const url of issue.photoUrls) {
          const res = await fetch(url);
          const blob = await res.blob();
          const ext = url.split(".").pop()?.split("?")[0] || "jpg";
          files.push(new File([blob], `issue-${issue.issueNo}-${files.length + 1}.${ext}`, { type: blob.type }));
        }
        if (navigator.canShare && navigator.canShare({ files })) {
          await navigator.share({ text, files });
          return;
        }
      } catch { /* fall through */ }
    }

    // Fallback: WhatsApp text with image links
    if (issue.photoUrls && issue.photoUrls.length > 0) {
      text += `\n\n*Photos:*\n${issue.photoUrls.join("\n")}`;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!issue) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-slate-400">Issue not found</p>
        <Link
          href="/vendor-issues"
          className="text-sm text-blue-600 hover:underline mt-2 inline-block"
        >
          Back to Issues
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Link href="/vendor-issues" className="p-1">
          <ArrowLeft className="h-5 w-5 text-slate-600" />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-slate-900">{issue.issueNo}</h1>
          <p className="text-xs text-slate-500">
            {issue.issueSource === "CLIENT" ? `Client: ${issue.clientName || "Unknown"}` : `Brand: ${issue.vendor?.name || "Unknown"}`}
          </p>
        </div>
        <Badge variant={STATUS_VARIANT[issue.status] || "default"}>
          {issue.status.replace(/_/g, " ")}
        </Badge>
      </div>

      {/* Info Card */}
      <Card className="mb-4">
        <CardContent className="p-3 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Type:</span>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                ISSUE_TYPE_COLORS[issue.issueType] || ISSUE_TYPE_COLORS.OTHER
              }`}
            >
              {issue.issueType.replace(/_/g, " ")}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Priority:</span>
            <Badge variant={PRIORITY_VARIANT[issue.priority] || "default"}>
              {issue.priority}
            </Badge>
          </div>
          <div>
            <span className="text-xs text-slate-500">
              {issue.issueSource === "CLIENT" ? "Client:" : "Brand:"}
            </span>
            {issue.issueSource === "CLIENT" ? (
              <div>
                <p className="text-sm text-slate-900">{issue.clientName || "Unknown"}</p>
                {issue.clientPhone && <p className="text-xs text-slate-500">{issue.clientPhone}</p>}
              </div>
            ) : (
              <p className="text-sm text-slate-900">{issue.vendor?.name} ({issue.vendor?.code})</p>
            )}
          </div>
          {issue.bill && (
            <div>
              <span className="text-xs text-slate-500">Bill:</span>
              <Link
                href={`/bills/${issue.bill.id}`}
                className="text-sm text-blue-600 hover:underline ml-1"
              >
                {issue.bill.billNo}
              </Link>
            </div>
          )}
          <div>
            <span className="text-xs text-slate-500">Created by:</span>
            <p className="text-sm text-slate-700">{issue.createdBy.name}</p>
          </div>
          <div>
            <span className="text-xs text-slate-500">Created:</span>
            <p className="text-sm text-slate-700">
              {new Date(issue.createdAt).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Photos */}
      {issue.photoUrls && issue.photoUrls.length > 0 && (
        <Card className="mb-4">
          <CardContent className="p-3">
            <p className="text-xs text-slate-500 mb-2">Photos</p>
            <div className="flex gap-2 overflow-x-auto">
              {issue.photoUrls.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                  <img
                    src={url}
                    alt={`Issue photo ${i + 1}`}
                    className="w-24 h-24 object-cover rounded-lg border border-slate-200"
                  />
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Description */}
      <Card className="mb-4">
        <CardContent className="p-3">
          <p className="text-xs text-slate-500 mb-1">Description</p>
          <p className="text-sm text-slate-800 whitespace-pre-wrap">
            {issue.description}
          </p>
        </CardContent>
      </Card>

      {/* Suggested Resolution */}
      {issue.suggestedResolution && (
        <Card className="mb-4 border-amber-200 bg-amber-50/50">
          <CardContent className="p-3">
            <p className="text-xs text-amber-600 font-medium mb-1">Suggested Resolution</p>
            <p className="text-sm text-slate-800 whitespace-pre-wrap">
              {issue.suggestedResolution}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Resolution section */}
      {(issue.status === "RESOLVED" || issue.status === "CLOSED") &&
        issue.resolution && (
          <Card className="mb-4 border-green-200 bg-green-50/50">
            <CardContent className="p-3">
              <p className="text-xs text-green-600 font-medium mb-1">
                Resolution
              </p>
              <p className="text-sm text-slate-800 whitespace-pre-wrap">
                {issue.resolution}
              </p>
              {issue.resolvedAt && (
                <p className="text-[10px] text-slate-400 mt-2">
                  Resolved on:{" "}
                  {new Date(issue.resolvedAt).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              )}
            </CardContent>
          </Card>
        )}

      {/* Resolution textarea (when transitioning to RESOLVED) */}
      {showResolution && (
        <Card className="mb-4">
          <CardContent className="p-3 space-y-2">
            <p className="text-sm font-medium text-slate-700">
              Resolution Details
            </p>
            <textarea
              placeholder="Describe how the issue was resolved..."
              value={resolutionText}
              onChange={(e) => setResolutionText(e.target.value)}
              rows={3}
              className="flex w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => updateStatus("RESOLVED", resolutionText)}
                disabled={updating || !resolutionText.trim()}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {updating ? "Saving..." : "Confirm Resolved"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setShowResolution(false);
                  setResolutionText("");
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status transition buttons */}
      {issue.status !== "CLOSED" && !showResolution && (
        <div className="space-y-2 mb-4">
          {issue.status === "OPEN" && (
            <Button
              size="sm"
              onClick={() => updateStatus("IN_PROGRESS")}
              disabled={updating}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {updating ? "Updating..." : "In Progress"}
            </Button>
          )}
          {issue.status === "IN_PROGRESS" && (
            <Button
              size="sm"
              onClick={() => setShowResolution(true)}
              disabled={updating}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              Mark Resolved
            </Button>
          )}
          {issue.status === "RESOLVED" && (
            <Button
              size="sm"
              onClick={() => updateStatus("CLOSED")}
              disabled={updating}
              className="w-full"
            >
              {updating ? "Updating..." : "Close Issue"}
            </Button>
          )}
          {issue.status !== "OPEN" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => updateStatus("OPEN")}
              disabled={updating}
              className="w-full"
            >
              {updating ? "Updating..." : "Reopen"}
            </Button>
          )}
        </div>
      )}
      {/* WhatsApp Share */}
      <Button
        size="sm"
        onClick={handleWhatsAppShare}
        className="w-full bg-green-600 hover:bg-green-700 mb-4"
      >
        <Share2 className="w-4 h-4 mr-1.5" />
        Share on WhatsApp
      </Button>
    </div>
  );
}
