"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Search, AlertCircle, Plus, Trash2, SlidersHorizontal, X, Share2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/lib/utils";
import { DateFilter, type DateRangeKey } from "@/components/date-filter";

interface IssueItem {
  id: string;
  issueNo: string;
  issueSource: string;
  issueType: string;
  description: string;
  status: string;
  priority: string;
  createdAt: string;
  vendor: { name: string } | null;
  clientName: string | null;
  openCount: number;
  inProgressCount: number;
  resolvedCount: number;
}

const STATUS_FILTERS = ["ALL", "OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];
const PRIORITY_FILTERS = ["ALL", "LOW", "MEDIUM", "HIGH", "URGENT"];

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

export default function VendorIssuesPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role || "";
  const isAdmin = role === "ADMIN";

  const urlParams = useSearchParams();
  const vendorIdParam = urlParams.get("vendorId") || "";

  const [issues, setIssues] = useState<IssueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const [dateFilter, setDateFilter] = useState<DateRangeKey>("all");
  const [dateFrom, setDateFrom] = useState<string | undefined>();
  const [dateTo, setDateTo] = useState<string | undefined>();
  const [showFilters, setShowFilters] = useState(false);
  const [brandFilter, setBrandFilter] = useState("ALL");

  const activeFilterCount = [
    sourceFilter !== "ALL",
    statusFilter !== "ALL",
    priorityFilter !== "ALL",
    dateFilter !== "all",
    brandFilter !== "ALL",
  ].filter(Boolean).length;

  // Unique brand names from fetched issues
  const brandNames = Array.from(
    new Set(issues.filter(i => i.vendor?.name).map(i => i.vendor!.name))
  ).sort();

  // Client-side brand filtering
  const displayIssues = brandFilter === "ALL"
    ? issues
    : issues.filter(i => i.vendor?.name === brandFilter);

  const openCount = issues[0]?.openCount ?? 0;
  const inProgressCount = issues[0]?.inProgressCount ?? 0;
  const resolvedCount = issues[0]?.resolvedCount ?? 0;

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "50" });
    if (vendorIdParam) params.set("vendorId", vendorIdParam);
    if (sourceFilter !== "ALL") params.set("issueSource", sourceFilter);
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    if (priorityFilter !== "ALL") params.set("priority", priorityFilter);
    if (debouncedSearch.length >= 2) params.set("search", debouncedSearch);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);

    fetch(`/api/vendor-issues?${params}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setIssues(res.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [vendorIdParam, sourceFilter, statusFilter, priorityFilter, debouncedSearch, dateFrom, dateTo]);

  // WhatsApp share — filtered issues with overdue days
  const shareIssuesWhatsApp = () => {
    const toShare = displayIssues.filter(i => i.status !== "CLOSED");
    if (!toShare.length) return;
    const today = new Date();
    const lines: string[] = [];
    const heading = brandFilter !== "ALL" ? `⚠️ *${brandFilter} — Open Issues*` : "⚠️ *Ops Issues Summary*";
    lines.push(heading);
    lines.push(`📅 ${today.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}`);
    lines.push("");
    toShare.forEach((issue, i) => {
      const created = new Date(issue.createdAt);
      const diffDays = Math.floor((today.getTime() - created.getTime()) / 86400000);
      const overdue = diffDays > 0 ? ` (${diffDays}d overdue)` : "";
      const source = issue.issueSource === "CLIENT" ? `Client: ${issue.clientName || "Unknown"}` : `Brand: ${issue.vendor?.name || "Unknown"}`;
      lines.push(`${i + 1}. *[${issue.issueNo}]* ${issue.issueType.replace(/_/g, " ")}`);
      lines.push(`   ${source}${overdue}`);
      lines.push(`   ${issue.description.slice(0, 80)}${issue.description.length > 80 ? "..." : ""}`);
      lines.push(`   Status: ${issue.status.replace(/_/g, " ")} | Priority: ${issue.priority}`);
      lines.push("");
    });
    lines.push(`📊 *Total: ${toShare.length} open issues*`);
    window.open(`https://wa.me/?text=${encodeURIComponent(lines.join("\n"))}`, "_blank");
  };

  const handleDelete = async (e: React.MouseEvent, issueId: string, issueNo: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete issue ${issueNo}? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/vendor-issues/${issueId}`, { method: "DELETE" }).then(r => r.json());
      if (res.success) {
        setIssues((prev) => prev.filter((i) => i.id !== issueId));
      } else {
        alert(res.error || "Failed to delete");
      }
    } catch {
      alert("Network error");
    }
  };

  return (
    <div className="pb-24">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-bold text-slate-900">Ops Issues</h1>
        <button
          onClick={shareIssuesWhatsApp}
          className="w-9 h-9 rounded-full bg-green-500 flex items-center justify-center active:scale-95 transition-transform shadow"
          title="Share issues on WhatsApp"
        >
          <Share2 className="w-4 h-4 text-white" />
        </button>
      </div>

      {/* Summary row */}
      {!loading && issues.length > 0 && (
        <div className="flex gap-2 mb-3">
          <Badge variant="warning" className="text-xs">
            Open: {openCount}
          </Badge>
          <Badge variant="info" className="text-xs">
            In Progress: {inProgressCount}
          </Badge>
          <Badge variant="success" className="text-xs">
            Resolved: {resolvedCount}
          </Badge>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search issue no or vendor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Filter button */}
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeFilterCount > 0
              ? "bg-blue-600 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
        </button>
        {activeFilterCount > 0 && (
          <button
            onClick={() => {
              setSourceFilter("ALL");
              setStatusFilter("ALL");
              setPriorityFilter("ALL");
              setBrandFilter("ALL");
              setDateFilter("all");
              setDateFrom(undefined);
              setDateTo(undefined);
            }}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>

      {/* Collapsible filter panel */}
      {showFilters && (
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 mb-3 space-y-3">
          {/* Source */}
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Source</p>
            <div className="flex gap-2">
              {["ALL", "VENDOR", "CLIENT"].map((s) => (
                <button
                  key={s}
                  onClick={() => setSourceFilter(s)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    sourceFilter === s
                      ? s === "VENDOR" ? "bg-orange-600 text-white" : s === "CLIENT" ? "bg-teal-600 text-white" : "bg-slate-900 text-white"
                      : "bg-white text-slate-600 border border-slate-200"
                  }`}
                >
                  {s === "ALL" ? "All" : s === "VENDOR" ? "Brand" : "Client"}
                </button>
              ))}
            </div>
          </div>

          {/* Status */}
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Status</p>
            <div className="flex gap-2 flex-wrap">
              {STATUS_FILTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    statusFilter === s
                      ? "bg-slate-900 text-white"
                      : "bg-white text-slate-600 border border-slate-200"
                  }`}
                >
                  {s === "ALL" ? "All" : s.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Priority</p>
            <div className="flex gap-2 flex-wrap">
              {PRIORITY_FILTERS.map((p) => (
                <button
                  key={p}
                  onClick={() => setPriorityFilter(p)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    priorityFilter === p
                      ? "bg-blue-600 text-white"
                      : "bg-white text-slate-600 border border-slate-200"
                  }`}
                >
                  {p === "ALL" ? "All" : p}
                </button>
              ))}
            </div>
          </div>

          {/* Date */}
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Date</p>
            <DateFilter
              value={dateFilter}
              onChange={(key, from, to) => { setDateFilter(key); setDateFrom(from); setDateTo(to); }}
            />
          </div>

          {/* Brand */}
          {brandNames.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Brand</p>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setBrandFilter("ALL")}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    brandFilter === "ALL" ? "bg-slate-900 text-white" : "bg-white text-slate-600 border border-slate-200"
                  }`}
                >
                  All
                </button>
                {brandNames.map((b) => (
                  <button
                    key={b}
                    onClick={() => setBrandFilter(b)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      brandFilter === b ? "bg-orange-600 text-white" : "bg-white text-slate-600 border border-slate-200"
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="p-3 border border-slate-100 rounded-lg animate-pulse"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 bg-slate-200 rounded w-3/4" />
                  <div className="h-3 bg-slate-200 rounded w-1/2" />
                  <div className="h-3 bg-slate-200 rounded w-full" />
                </div>
                <div className="text-right space-y-1.5">
                  <div className="h-5 w-14 bg-slate-200 rounded-full ml-auto" />
                  <div className="h-5 w-14 bg-slate-200 rounded-full ml-auto" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {displayIssues.map((issue) => (
            <Link key={issue.id} href={`/vendor-issues/${issue.id}`}>
              <Card className="hover:border-slate-300 transition-colors mb-2">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0 mr-3">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-bold text-slate-900">
                          {issue.issueNo}
                        </p>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            ISSUE_TYPE_COLORS[issue.issueType] ||
                            ISSUE_TYPE_COLORS.OTHER
                          }`}
                        >
                          {issue.issueType.replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mb-1">
                        {issue.issueSource === "CLIENT" ? (
                          <><span className="text-teal-600 font-medium">Client:</span> {issue.clientName || "Unknown"}</>
                        ) : (
                          <><span className="text-orange-600 font-medium">Brand:</span> {issue.vendor?.name || "Unknown"}</>
                        )}
                      </p>
                      <p className="text-xs text-slate-600 line-clamp-2">
                        {issue.description}
                      </p>
                    </div>
                    <div className="text-right shrink-0 space-y-1">
                      <Badge variant={PRIORITY_VARIANT[issue.priority] || "default"} className="text-[10px]">
                        {issue.priority}
                      </Badge>
                      <br />
                      <Badge variant={STATUS_VARIANT[issue.status] || "default"} className="text-[10px]">
                        {issue.status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <p className="text-[10px] text-slate-400">
                      {new Date(issue.createdAt).toLocaleDateString("en-IN")}
                      {issue.status !== "CLOSED" && issue.status !== "RESOLVED" && (() => {
                        const days = Math.floor((Date.now() - new Date(issue.createdAt).getTime()) / 86400000);
                        return days > 0 ? <span className="text-red-500 font-medium ml-1">({days}d overdue)</span> : null;
                      })()}
                    </p>
                    {isAdmin && (
                      <button
                        onClick={(e) => handleDelete(e, issue.id, issue.issueNo)}
                        className="p-1.5 rounded-full hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}

          {displayIssues.length === 0 && (
            <div className="text-center py-12">
              <AlertCircle className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No issues found</p>
            </div>
          )}
        </div>
      )}

      {/* Floating action button */}
      <Link
        href="/vendor-issues/new"
        className="fixed above-nav right-6 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-lg transition-colors z-50"
      >
        <Plus className="h-5 w-5" />
      </Link>
    </div>
  );
}
