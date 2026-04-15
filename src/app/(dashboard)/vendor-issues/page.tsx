"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Search, AlertCircle, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/lib/utils";

interface IssueItem {
  id: string;
  issueNo: string;
  issueType: string;
  description: string;
  status: string;
  priority: string;
  createdAt: string;
  vendor: { name: string };
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
  const urlParams = useSearchParams();
  const vendorIdParam = urlParams.get("vendorId") || "";

  const [issues, setIssues] = useState<IssueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);

  const openCount = issues[0]?.openCount ?? 0;
  const inProgressCount = issues[0]?.inProgressCount ?? 0;
  const resolvedCount = issues[0]?.resolvedCount ?? 0;

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "50" });
    if (vendorIdParam) params.set("vendorId", vendorIdParam);
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    if (priorityFilter !== "ALL") params.set("priority", priorityFilter);
    if (debouncedSearch.length >= 2) params.set("search", debouncedSearch);

    fetch(`/api/vendor-issues?${params}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setIssues(res.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [vendorIdParam, statusFilter, priorityFilter, debouncedSearch]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-bold text-slate-900">Vendor Issues</h1>
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

      {/* Status filter chips */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-2 pb-1">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              statusFilter === s
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {s === "ALL" ? "All" : s.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {/* Priority filter chips */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-4 pb-1">
        {PRIORITY_FILTERS.map((p) => (
          <button
            key={p}
            onClick={() => setPriorityFilter(p)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              priorityFilter === p
                ? "bg-blue-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {p === "ALL" ? "All Priority" : p}
          </button>
        ))}
      </div>

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
          {issues.map((issue) => (
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
                        {issue.vendor.name}
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
                  <p className="text-[10px] text-slate-400 mt-1.5">
                    {new Date(issue.createdAt).toLocaleDateString("en-IN")}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}

          {issues.length === 0 && (
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
        className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-lg transition-colors z-50"
      >
        <Plus className="h-5 w-5" />
      </Link>
    </div>
  );
}
