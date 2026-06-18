"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Search, AlertCircle, Plus, Trash2, Share2, Building2, Users, CalendarCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/lib/utils";
import { type DateRangeKey } from "@/components/date-filter";
import { FilterSheet } from "@/components/filter-sheet";

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

function overdueDays(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
}

export default function VendorIssuesPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role || "";
  const isAdmin = role === "ADMIN" || role === "CEO";

  const urlParams = useSearchParams();
  const vendorIdParam = urlParams.get("vendorId") || "";

  const [issues, setIssues] = useState<IssueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceTab, setSourceTab] = useState<"ALL" | "VENDOR" | "CLIENT">("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const [dateFilter, setDateFilter] = useState<DateRangeKey>("all");
  const [dateFrom, setDateFrom] = useState<string | undefined>();
  const [dateTo, setDateTo] = useState<string | undefined>();
  const [brandFilter, setBrandFilter] = useState("ALL");
  const [actionError, setActionError] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "100" });
    if (vendorIdParam) params.set("vendorId", vendorIdParam);
    // Don't filter by source in API — we'll group client-side for both-sections view
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    if (priorityFilter !== "ALL") params.set("priority", priorityFilter);
    if (debouncedSearch.length >= 2) params.set("search", debouncedSearch);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);

    fetch(`/api/vendor-issues?${params}`)
      .then((r) => r.json())
      .then((res) => { if (res.success) setIssues(res.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [vendorIdParam, statusFilter, priorityFilter, debouncedSearch, dateFrom, dateTo]);

  // Split issues by source
  const brandIssues = issues.filter(i => i.issueSource === "VENDOR");
  const clientIssues = issues.filter(i => i.issueSource === "CLIENT");

  // Brand names for filter
  const brandNames = Array.from(
    new Set(brandIssues.filter(i => i.vendor?.name).map(i => i.vendor!.name))
  ).sort();

  // Apply brand filter
  const filteredBrandIssues = brandFilter === "ALL"
    ? brandIssues
    : brandIssues.filter(i => i.vendor?.name === brandFilter);

  const openCount = issues[0]?.openCount ?? 0;
  const inProgressCount = issues[0]?.inProgressCount ?? 0;
  const resolvedCount = issues[0]?.resolvedCount ?? 0;

  // WhatsApp share with overdue days
  const shareIssuesWhatsApp = (shareBrand: boolean = true, shareClient: boolean = true) => {
    const toShare: IssueItem[] = [];
    if (shareBrand) toShare.push(...filteredBrandIssues.filter(i => i.status !== "CLOSED"));
    if (shareClient) toShare.push(...clientIssues.filter(i => i.status !== "CLOSED"));
    if (!toShare.length) return;

    const today = new Date();
    const lines: string[] = [];
    const heading = brandFilter !== "ALL"
      ? `⚠️ *${brandFilter} — Open Issues*`
      : shareBrand && shareClient ? "⚠️ *Ops Issues Summary*"
      : shareBrand ? "⚠️ *Brand Issues Summary*"
      : "⚠️ *Client Issues Summary*";
    lines.push(heading);
    lines.push(`📅 ${today.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}`);
    lines.push("");

    // Group: brand first, then client
    const brandItems = toShare.filter(i => i.issueSource === "VENDOR");
    const clientItems = toShare.filter(i => i.issueSource === "CLIENT");

    if (brandItems.length > 0) {
      lines.push(`🏭 *Brand Issues (${brandItems.length})*`);
      brandItems.forEach((issue, i) => {
        const days = overdueDays(issue.createdAt);
        const overdueStr = days > 0 ? ` ⏰ ${days}d overdue` : "";
        lines.push(`${i + 1}. *[${issue.issueNo}]* ${issue.issueType.replace(/_/g, " ")}`);
        lines.push(`   Brand: ${issue.vendor?.name || "Unknown"}${overdueStr}`);
        lines.push(`   ${issue.description.slice(0, 80)}${issue.description.length > 80 ? "..." : ""}`);
        lines.push(`   Status: ${issue.status.replace(/_/g, " ")} | Priority: ${issue.priority}`);
        lines.push("");
      });
    }

    if (clientItems.length > 0) {
      lines.push(`👤 *Client Issues (${clientItems.length})*`);
      clientItems.forEach((issue, i) => {
        const days = overdueDays(issue.createdAt);
        const overdueStr = days > 0 ? ` ⏰ ${days}d overdue` : "";
        lines.push(`${i + 1}. *[${issue.issueNo}]* ${issue.issueType.replace(/_/g, " ")}`);
        lines.push(`   Client: ${issue.clientName || "Unknown"}${overdueStr}`);
        lines.push(`   ${issue.description.slice(0, 80)}${issue.description.length > 80 ? "..." : ""}`);
        lines.push(`   Status: ${issue.status.replace(/_/g, " ")} | Priority: ${issue.priority}`);
        lines.push("");
      });
    }

    lines.push(`📊 *Total: ${toShare.length} open issues*`);
    lines.push("\n_Sent from Bike Inventory App_");
    window.open(`https://wa.me/?text=${encodeURIComponent(lines.join("\n"))}`, "_blank");
  };

  // Daily progress report — what came in today, what was processed, current backlog.
  const handleDailyReport = async () => {
    if (reportLoading) return;
    setReportLoading(true);
    setActionError(null);
    try {
      const res = await fetch("/api/vendor-issues/daily-report");
      const json = await res.json();
      if (!json.success) { setActionError(json.error || "Failed to build report"); return; }
      const r = json.data as {
        date: string;
        createdTodayCount: number; resolvedTodayCount: number;
        openTotal: number; inProgressTotal: number;
        createdToday: Array<{ issueNo: string; issueType: string; priority: string; status: string; vendor: { name: string } | null; clientName: string | null }>;
        resolvedToday: Array<{ issueNo: string; issueType: string; vendor: { name: string } | null; clientName: string | null }>;
      };
      const who = (val: { vendor: { name: string } | null; clientName: string | null }) => val.vendor?.name || val.clientName || "—";
      const dateStr = new Date(r.date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

      const lines: string[] = [];
      lines.push("📊 *Ops Issues — Daily Report*");
      lines.push(`📅 ${dateStr}`);
      lines.push("");
      lines.push(`🆕 New today: ${r.createdTodayCount}`);
      lines.push(`✅ Resolved today: ${r.resolvedTodayCount}`);
      lines.push(`🔧 In progress: ${r.inProgressTotal}`);
      lines.push(`📂 Open backlog: ${r.openTotal}`);

      if (r.createdToday.length) {
        lines.push("");
        lines.push(`🆕 *New today (${r.createdTodayCount})*`);
        r.createdToday.slice(0, 15).forEach((i, n) => {
          lines.push(`${n + 1}. [${i.issueNo}] ${i.issueType.replace(/_/g, " ")} — ${who(i)} — ${i.priority}`);
        });
        if (r.createdToday.length > 15) lines.push(`…and ${r.createdToday.length - 15} more`);
      }
      if (r.resolvedToday.length) {
        lines.push("");
        lines.push(`✅ *Resolved today (${r.resolvedTodayCount})*`);
        r.resolvedToday.slice(0, 15).forEach((i, n) => {
          lines.push(`${n + 1}. [${i.issueNo}] ${i.issueType.replace(/_/g, " ")} — ${who(i)}`);
        });
        if (r.resolvedToday.length > 15) lines.push(`…and ${r.resolvedToday.length - 15} more`);
      }
      lines.push("\n_Sent from Bike Inventory App_");
      window.open(`https://wa.me/?text=${encodeURIComponent(lines.join("\n"))}`, "_blank");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to build report");
    } finally {
      setReportLoading(false);
    }
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
        setActionError(res.error || "Failed to delete");
      }
    } catch { setActionError("Network error"); }
  };

  const renderIssueCard = (issue: IssueItem) => (
    <Link key={issue.id} href={`/vendor-issues/${issue.id}`}>
      <Card className="hover:border-slate-300 transition-colors mb-2">
        <CardContent className="p-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0 mr-3">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-sm font-bold text-slate-900">{issue.issueNo}</p>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${ISSUE_TYPE_COLORS[issue.issueType] || ISSUE_TYPE_COLORS.OTHER}`}>
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
              <p className="text-xs text-slate-600 line-clamp-2">{issue.description}</p>
            </div>
            <div className="text-right shrink-0 space-y-1">
              <Badge variant={PRIORITY_VARIANT[issue.priority] || "default"} className="text-[10px]">{issue.priority}</Badge>
              <br />
              <Badge variant={STATUS_VARIANT[issue.status] || "default"} className="text-[10px]">{issue.status.replace(/_/g, " ")}</Badge>
            </div>
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <p className="text-[10px] text-slate-400">
              {new Date(issue.createdAt).toLocaleDateString("en-IN")}
              {issue.status !== "CLOSED" && issue.status !== "RESOLVED" && (() => {
                const days = overdueDays(issue.createdAt);
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
  );

  return (
    <div className="pb-24">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-bold text-slate-900">Ops Issues</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDailyReport}
            disabled={reportLoading}
            className="flex items-center gap-1.5 h-9 px-3 rounded-full bg-slate-900 text-white text-xs font-medium active:scale-95 transition-transform shadow disabled:opacity-50"
            title="Share today's progress report on WhatsApp"
          >
            <CalendarCheck className="w-4 h-4" /> {reportLoading ? "..." : "Daily Report"}
          </button>
          <button
            onClick={() => shareIssuesWhatsApp(sourceTab !== "CLIENT", sourceTab !== "VENDOR")}
            className="w-9 h-9 rounded-full bg-green-500 flex items-center justify-center active:scale-95 transition-transform shadow"
            title="Share issues on WhatsApp"
          >
            <Share2 className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

      {actionError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 mb-3 text-xs text-red-700 flex items-center justify-between">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="text-red-400 hover:text-red-600 ml-2 text-sm leading-none">&times;</button>
        </div>
      )}

      {/* Source Tabs — top-level, always visible */}
      <div className="flex gap-2 mb-3">
        {([
          { key: "ALL" as const, label: "All", icon: AlertCircle, count: issues.length },
          { key: "VENDOR" as const, label: "Brand", icon: Building2, count: brandIssues.length },
          { key: "CLIENT" as const, label: "Client", icon: Users, count: clientIssues.length },
        ]).map((tab) => {
          const active = sourceTab === tab.key;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setSourceTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                active
                  ? tab.key === "VENDOR" ? "bg-orange-600 text-white" : tab.key === "CLIENT" ? "bg-teal-600 text-white" : "bg-slate-900 text-white"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label} ({tab.count})
            </button>
          );
        })}
      </div>

      {/* Summary */}
      {!loading && issues.length > 0 && (
        <div className="flex gap-2 mb-3">
          <Badge variant="warning" className="text-xs">Open: {openCount}</Badge>
          <Badge variant="info" className="text-xs">In Progress: {inProgressCount}</Badge>
          <Badge variant="success" className="text-xs">Resolved: {resolvedCount}</Badge>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input placeholder="Search issue no, vendor, or client..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* Filters */}
      <FilterSheet
        className="mb-3"
        dateValue={dateFilter}
        onDateChange={(key, from, to) => { setDateFilter(key); setDateFrom(from); setDateTo(to); }}
        groups={[
          {
            label: "Status",
            value: statusFilter,
            defaultValue: "ALL",
            options: STATUS_FILTERS.map((s) => ({ key: s, label: s === "ALL" ? "All" : s.replace(/_/g, " ") })),
            onChange: (key) => setStatusFilter(key),
          },
          {
            label: "Priority",
            value: priorityFilter,
            defaultValue: "ALL",
            options: PRIORITY_FILTERS.map((p) => ({ key: p, label: p === "ALL" ? "All" : p })),
            onChange: (key) => setPriorityFilter(key),
          },
          ...(brandNames.length > 0 && (sourceTab === "ALL" || sourceTab === "VENDOR")
            ? [{
                label: "Brand",
                value: brandFilter,
                defaultValue: "ALL",
                options: [{ key: "ALL", label: "All" }, ...brandNames.map((b) => ({ key: b, label: b }))],
                onChange: (key: string) => setBrandFilter(key),
              }]
            : []),
        ]}
      />

      {/* Content */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-3 border border-slate-100 rounded-lg animate-pulse">
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-1.5"><div className="h-4 bg-slate-200 rounded w-3/4" /><div className="h-3 bg-slate-200 rounded w-1/2" /></div>
                <div className="h-5 w-14 bg-slate-200 rounded-full ml-auto" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* ALL tab: show both sections */}
          {sourceTab === "ALL" && (
            <div className="space-y-4">
              {/* Brand Issues Section */}
              {filteredBrandIssues.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="w-4 h-4 text-orange-600" />
                    <p className="text-xs font-bold text-orange-700 uppercase tracking-wider">Brand Issues ({filteredBrandIssues.length})</p>
                    <button
                      onClick={() => shareIssuesWhatsApp(true, false)}
                      className="ml-auto p-1 rounded-full hover:bg-green-50 text-green-500"
                      title="Share brand issues"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="space-y-0">{filteredBrandIssues.map(renderIssueCard)}</div>
                </div>
              )}

              {/* Client Issues Section */}
              {clientIssues.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-4 h-4 text-teal-600" />
                    <p className="text-xs font-bold text-teal-700 uppercase tracking-wider">Client Issues ({clientIssues.length})</p>
                    <button
                      onClick={() => shareIssuesWhatsApp(false, true)}
                      className="ml-auto p-1 rounded-full hover:bg-green-50 text-green-500"
                      title="Share client issues"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="space-y-0">{clientIssues.map(renderIssueCard)}</div>
                </div>
              )}

              {filteredBrandIssues.length === 0 && clientIssues.length === 0 && (
                <div className="text-center py-12">
                  <AlertCircle className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">No issues found</p>
                </div>
              )}
            </div>
          )}

          {/* VENDOR tab: only brand issues */}
          {sourceTab === "VENDOR" && (
            <div className="space-y-0">
              {filteredBrandIssues.length > 0 ? filteredBrandIssues.map(renderIssueCard) : (
                <div className="text-center py-12">
                  <Building2 className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">No brand issues found</p>
                </div>
              )}
            </div>
          )}

          {/* CLIENT tab: only client issues */}
          {sourceTab === "CLIENT" && (
            <div className="space-y-0">
              {clientIssues.length > 0 ? clientIssues.map(renderIssueCard) : (
                <div className="text-center py-12">
                  <Users className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">No client issues found</p>
                </div>
              )}
            </div>
          )}
        </>
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
