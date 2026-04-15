"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Search, Plus, Wrench, AlertTriangle, Clock, Phone,
  MessageCircle, Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/lib/utils";

interface ServiceTicket {
  id: string;
  ticketNo: string;
  customerName: string;
  customerPhone: string;
  productName: string;
  issueBrief: string;
  department: string;
  status: string;
  priority: string;
  emTicketStatus: string | null;
  createdAt: string;
}

interface Stats {
  open: number;
  escalated: number;
  emPending: number;
  resolvedToday: number;
}

const PRIORITY_VARIANT: Record<string, "default" | "info" | "warning" | "danger"> = {
  LOW: "default",
  NORMAL: "info",
  HIGH: "warning",
  URGENT: "danger",
};

const STATUS_VARIANT: Record<string, "default" | "info" | "warning" | "success" | "danger"> = {
  TICKET_ISSUED: "info",
  ESCALATED: "danger",
  RESOLUTION_DELAYED: "warning",
  RESOLVED: "success",
};

const DEPARTMENT_COLORS: Record<string, string> = {
  "Bangalore Delivery": "bg-blue-100 text-blue-700",
  "OB Delivery": "bg-indigo-100 text-indigo-700",
  "In store service": "bg-green-100 text-green-700",
  "EM Service": "bg-purple-100 text-purple-700",
  "General Issues": "bg-slate-100 text-slate-700",
};

const DEPARTMENTS = [
  "All Departments",
  "Bangalore Delivery",
  "OB Delivery",
  "In store service",
  "EM Service",
  "General Issues",
];

type TabKey = "ALL" | "OPEN" | "ESCALATED" | "EM_PENDING" | "RESOLVED" | "DELAYED";

const TABS: { key: TabKey; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "OPEN", label: "Open" },
  { key: "ESCALATED", label: "Escalated" },
  { key: "EM_PENDING", label: "EM Pending" },
  { key: "RESOLVED", label: "Resolved" },
  { key: "DELAYED", label: "Delayed" },
];

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export default function ServiceTicketsPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role || "";
  const canAccess = ["ADMIN", "ACCOUNTS_MANAGER", "OUTWARDS_CLERK"].includes(role);

  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("ALL");
  const [department, setDepartment] = useState("All Departments");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const debouncedSearch = useDebounce(search);

  const fetchTickets = useCallback(
    (pageNum: number, append = false) => {
      if (!append) setLoading(true);
      const params = new URLSearchParams({ limit: "20", page: String(pageNum) });

      if (tab === "OPEN") params.set("status", "TICKET_ISSUED");
      else if (tab === "ESCALATED") params.set("status", "ESCALATED");
      else if (tab === "EM_PENDING") params.set("emPending", "true");
      else if (tab === "RESOLVED") params.set("status", "RESOLVED");
      else if (tab === "DELAYED") params.set("status", "RESOLUTION_DELAYED");

      if (department !== "All Departments") params.set("department", department);
      if (debouncedSearch.length >= 2) params.set("search", debouncedSearch);

      fetch(`/api/service-tickets?${params}`)
        .then((r) => r.json())
        .then((res) => {
          if (res.success) {
            if (append) {
              setTickets((prev) => [...prev, ...res.data]);
            } else {
              setTickets(res.data);
            }
            setHasMore(res.data.length === 20);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    },
    [tab, department, debouncedSearch]
  );

  const fetchStats = useCallback(() => {
    fetch("/api/service-tickets/stats")
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setStats({
          open: res.data.totalOpen || 0,
          escalated: res.data.escalated || 0,
          emPending: res.data.pendingEM || 0,
          resolvedToday: res.data.resolvedToday || 0,
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setPage(1);
    fetchTickets(1);
    fetchStats();
  }, [fetchTickets, fetchStats]);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchTickets(next, true);
  };

  if (!canAccess) {
    return (
      <div className="text-center py-12">
        <Wrench className="h-8 w-8 text-slate-300 mx-auto mb-2" />
        <p className="text-sm text-slate-400">You do not have access to service tickets.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-bold text-slate-900">Service Tickets</h1>
        <Link
          href="/service/new"
          className="flex items-center gap-1.5 bg-slate-900 text-white px-3 py-2 rounded-lg text-xs font-medium"
        >
          <Plus className="h-3.5 w-3.5" /> New Ticket
        </Link>
      </div>

      {/* Stats Row */}
      {stats && (
        <div className="grid grid-cols-4 gap-1.5 mb-3">
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-2 text-center">
              <p className="text-lg font-bold text-blue-700">{stats.open}</p>
              <p className="text-[9px] text-blue-600">Open</p>
            </CardContent>
          </Card>
          <Card className="bg-red-50 border-red-200">
            <CardContent className="p-2 text-center">
              <p className="text-lg font-bold text-red-700">{stats.escalated}</p>
              <p className="text-[9px] text-red-600">Escalated</p>
            </CardContent>
          </Card>
          <Card className="bg-purple-50 border-purple-200">
            <CardContent className="p-2 text-center">
              <p className="text-lg font-bold text-purple-700">{stats.emPending}</p>
              <p className="text-[9px] text-purple-600">EM Pending</p>
            </CardContent>
          </Card>
          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-2 text-center">
              <p className="text-lg font-bold text-green-700">{stats.resolvedToday}</p>
              <p className="text-[9px] text-green-600">Resolved</p>
            </CardContent>
          </Card>
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
      <div className="relative mb-2">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search ticket, customer, product..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Department Filter */}
      <div className="mb-3">
        <select
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          className="flex h-9 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
        >
          {DEPARTMENTS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      {/* Ticket Cards */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-12">
          <Wrench className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-400">No service tickets found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tickets.map((t) => {
            const phone = t.customerPhone?.replace(/\D/g, "") || "";
            const waLink = `https://wa.me/91${phone}?text=${encodeURIComponent(
              `Hi ${t.customerName}, regarding your service ticket ${t.ticketNo}...`
            )}`;
            return (
              <Card key={t.id} className="hover:border-slate-300 transition-colors">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between mb-1">
                    <Link href={`/service/${t.id}`} className="flex-1 min-w-0 mr-2">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <p className="text-sm font-bold text-slate-900">{t.ticketNo}</p>
                        <Badge
                          variant={PRIORITY_VARIANT[t.priority] || "default"}
                          className="text-[10px] px-1.5 py-0"
                        >
                          {t.priority}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-700 font-medium">{t.customerName}</p>
                      <p className="text-xs text-slate-500">{t.productName}</p>
                      <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                        {t.issueBrief}
                      </p>
                    </Link>
                    <div className="text-right shrink-0 space-y-1">
                      <Badge
                        variant={STATUS_VARIANT[t.status] || "default"}
                        className="text-[10px]"
                      >
                        {t.status.replace(/_/g, " ")}
                      </Badge>
                      {t.emTicketStatus && (
                        <>
                          <br />
                          <Badge variant="info" className="text-[10px]">
                            EM: {t.emTicketStatus.replace(/_/g, " ")}
                          </Badge>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          DEPARTMENT_COLORS[t.department] || DEPARTMENT_COLORS["General Issues"]
                        }`}
                      >
                        {t.department}
                      </span>
                      <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5" />
                        {timeAgo(t.createdAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={`tel:${phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        <Phone className="h-3.5 w-3.5" />
                      </a>
                      <a
                        href={waLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-green-500 hover:text-green-600"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Load More */}
          {hasMore && (
            <button
              onClick={loadMore}
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
