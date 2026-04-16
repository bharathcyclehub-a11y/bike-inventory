"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Search, Plus, Wrench, Clock, Phone, MessageCircle,
  Loader2, ChevronRight, User,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/lib/utils";

interface ServiceJob {
  id: string;
  jobNo: string;
  complaint: string;
  status: string;
  priority: string;
  estimatedCost: number;
  actualCost: number;
  createdAt: string;
  customer: { id: string; name: string; phone: string };
  bike: { brand: string; model: string } | null;
  assignedTo: { id: string; name: string } | null;
}

interface DashboardStats {
  totalOpen: number;
  todayCreated: number;
  completedToday: number;
  revenueToday: number;
  byMechanic: { name: string; count: number }[];
}

const STATUS_VARIANT: Record<string, "default" | "info" | "warning" | "success" | "danger"> = {
  CREATED: "default",
  DIAGNOSED: "info",
  QUOTED: "warning",
  APPROVED: "info",
  IN_PROGRESS: "warning",
  COMPLETED: "success",
  INVOICED: "success",
  DELIVERED: "success",
  ON_HOLD: "danger",
  CANCELLED: "danger",
};

const PRIORITY_VARIANT: Record<string, "default" | "info" | "warning" | "danger"> = {
  LOW: "default",
  NORMAL: "info",
  HIGH: "warning",
  URGENT: "danger",
};

type TabKey = "ALL" | "ACTIVE" | "CREATED" | "IN_PROGRESS" | "COMPLETED" | "ON_HOLD";

const TABS: { key: TabKey; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "ACTIVE", label: "Active" },
  { key: "CREATED", label: "New" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "COMPLETED", label: "Done" },
  { key: "ON_HOLD", label: "On Hold" },
];

const TAB_TO_STATUS: Record<TabKey, string> = {
  ALL: "",
  ACTIVE: "CREATED,DIAGNOSED,QUOTED,APPROVED,IN_PROGRESS",
  CREATED: "CREATED",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED,INVOICED,DELIVERED",
  ON_HOLD: "ON_HOLD",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days < 30 ? `${days}d ago` : `${Math.floor(days / 30)}mo ago`;
}

export default function ServiceJobsPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role || "";
  const userId = (session?.user as { userId?: string })?.userId || "";
  const canAccess = ["ADMIN", "SUPERVISOR", "MECHANIC", "ACCOUNTS_MANAGER"].includes(role);
  const isMechanic = role === "MECHANIC";

  const [jobs, setJobs] = useState<ServiceJob[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>(isMechanic ? "ACTIVE" : "ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const debouncedSearch = useDebounce(search);

  const fetchJobs = useCallback(
    (pageNum: number, append = false) => {
      if (!append) setLoading(true);
      const params = new URLSearchParams({ limit: "20", page: String(pageNum) });

      const statusFilter = TAB_TO_STATUS[tab];
      if (statusFilter) params.set("status", statusFilter);
      if (debouncedSearch.length >= 2) params.set("search", debouncedSearch);
      if (isMechanic) params.set("assignedToId", userId);

      fetch(`/api/service/jobs?${params}`)
        .then((r) => r.json())
        .then((res) => {
          if (res.success) {
            if (append) setJobs((prev) => [...prev, ...res.data]);
            else setJobs(res.data);
            setHasMore(res.data.length === 20);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    },
    [tab, debouncedSearch, isMechanic, userId]
  );

  const fetchStats = useCallback(() => {
    fetch("/api/service/dashboard")
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setStats(res.data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setPage(1);
    fetchJobs(1);
    fetchStats();
  }, [fetchJobs, fetchStats]);

  if (!canAccess) {
    return (
      <div className="text-center py-12">
        <Wrench className="h-8 w-8 text-slate-300 mx-auto mb-2" />
        <p className="text-sm text-slate-400">You do not have access to service jobs.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-bold text-slate-900">
          {isMechanic ? "My Jobs" : "Service Jobs"}
        </h1>
        {!isMechanic && (
          <Link
            href="/service/new"
            className="flex items-center gap-1.5 bg-slate-900 text-white px-3 py-2 rounded-lg text-xs font-medium"
          >
            <Plus className="h-3.5 w-3.5" /> New Job
          </Link>
        )}
      </div>

      {/* Stats Row */}
      {stats && !isMechanic && (
        <div className="grid grid-cols-4 gap-1.5 mb-3">
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-2 text-center">
              <p className="text-lg font-bold text-blue-700">{stats.totalOpen}</p>
              <p className="text-[9px] text-blue-600">Open</p>
            </CardContent>
          </Card>
          <Card className="bg-amber-50 border-amber-200">
            <CardContent className="p-2 text-center">
              <p className="text-lg font-bold text-amber-700">{stats.todayCreated}</p>
              <p className="text-[9px] text-amber-600">Today</p>
            </CardContent>
          </Card>
          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-2 text-center">
              <p className="text-lg font-bold text-green-700">{stats.completedToday}</p>
              <p className="text-[9px] text-green-600">Done</p>
            </CardContent>
          </Card>
          <Card className="bg-purple-50 border-purple-200">
            <CardContent className="p-2 text-center">
              <p className="text-lg font-bold text-purple-700">
                {stats.revenueToday > 0 ? `₹${stats.revenueToday.toLocaleString("en-IN")}` : "₹0"}
              </p>
              <p className="text-[9px] text-purple-600">Revenue</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Mechanic Load (admin only) */}
      {stats && !isMechanic && stats.byMechanic.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide mb-2 pb-1">
          {stats.byMechanic.map((m) => (
            <div
              key={m.name}
              className="shrink-0 flex items-center gap-1 bg-slate-100 rounded-full px-2.5 py-1"
            >
              <User className="h-3 w-3 text-slate-500" />
              <span className="text-[10px] font-medium text-slate-700">{m.name}</span>
              <span className="text-[10px] font-bold text-slate-900">{m.count}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tab Filters */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide mb-2 pb-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`shrink-0 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
              tab === t.key
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search job #, customer, bike..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Job Cards */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-12">
          <Wrench className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-400">No service jobs found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {jobs.map((job) => {
            const phone = job.customer.phone?.replace(/\D/g, "") || "";
            return (
              <Link key={job.id} href={`/service/${job.id}`}>
                <Card className="hover:border-slate-300 transition-colors mb-2">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex-1 min-w-0 mr-2">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <p className="text-sm font-bold text-slate-900">{job.jobNo}</p>
                          <Badge
                            variant={PRIORITY_VARIANT[job.priority] || "default"}
                            className="text-[10px] px-1.5 py-0"
                          >
                            {job.priority}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-700 font-medium">{job.customer.name}</p>
                        {job.bike && (
                          <p className="text-[11px] text-slate-500">
                            {job.bike.brand} {job.bike.model}
                          </p>
                        )}
                        <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                          {job.complaint}
                        </p>
                      </div>
                      <div className="text-right shrink-0 space-y-1">
                        <Badge
                          variant={STATUS_VARIANT[job.status] || "default"}
                          className="text-[10px]"
                        >
                          {job.status.replace(/_/g, " ")}
                        </Badge>
                        {job.actualCost > 0 && (
                          <p className="text-[10px] text-slate-500">
                            ₹{job.actualCost.toLocaleString("en-IN")}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-1.5">
                      <div className="flex items-center gap-2">
                        {job.assignedTo && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-500">
                            <User className="h-2.5 w-2.5" />
                            {job.assignedTo.name}
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                          <Clock className="h-2.5 w-2.5" />
                          {timeAgo(job.createdAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {phone && (
                          <>
                            <button
                              onClick={(e) => { e.preventDefault(); window.location.href = `tel:${phone}`; }}
                              className="text-slate-400 hover:text-slate-600"
                            >
                              <Phone className="h-3.5 w-3.5" />
                            </button>
                            <a
                              href={`https://wa.me/91${phone}?text=${encodeURIComponent(`Hi ${job.customer.name}, regarding your service job ${job.jobNo}...`)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-green-500 hover:text-green-600"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                            </a>
                          </>
                        )}
                        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}

          {hasMore && (
            <button
              onClick={() => {
                const next = page + 1;
                setPage(next);
                fetchJobs(next, true);
              }}
              className="w-full py-2.5 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
            >
              Load More
            </button>
          )}
        </div>
      )}
    </div>
  );
}
