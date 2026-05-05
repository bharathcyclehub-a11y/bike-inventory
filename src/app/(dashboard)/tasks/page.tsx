"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSession } from "next-auth/react";
import {
  Plus, X, ChevronDown, ChevronRight, Trash2, Share2,
  Sun, Clock, AlertCircle, CheckCircle2, Circle, Loader2,
  WifiOff, Camera, Search, Users,
} from "lucide-react";
import {
  PRIORITY_CONFIG, STATUS_CONFIG, TIME_SLOTS, DAYS,
  buildTaskDigestWhatsApp, todayStr,
  type Priority, type TaskStatusType, type TimeSlotType,
} from "@/lib/ops-constants";
import {
  cacheTasksLocally, getCachedTasks, syncPendingActions, queueOfflineAction,
} from "@/lib/offline-cache";
import { useDebounce } from "@/lib/utils";

/* ─── Types ─────────────────────────────────────────── */

interface StaffMember {
  id: string;
  name: string;
  role: string;
}

interface TaskAssignee {
  id: string;
  name: string;
}

interface Task {
  id: string;
  taskNo: string;
  title: string;
  notes?: string;
  status: TaskStatusType;
  priority: Priority;
  timeSlot?: TimeSlotType;
  dueDate?: string;
  sortOrder: number;
  isMyDay: boolean;
  recurrenceType?: string;
  recurrenceDays?: string[];
  photoUrls?: string[];
  assignees?: TaskAssignee[];
  assigneeIds?: string[];
  createdAt: string;
  updatedAt: string;
}

/* ─── Status cycle ──────────────────────────────────── */

const STATUS_CYCLE: TaskStatusType[] = ["PENDING", "IN_PROGRESS", "DONE"];

function nextStatus(current: TaskStatusType): TaskStatusType {
  const idx = STATUS_CYCLE.indexOf(current);
  return STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
}

/* ─── Time-slot sort key ────────────────────────────── */

const SLOT_ORDER: Record<string, number> = { MORNING: 0, AFTERNOON: 1, EVENING: 2 };

/* ─── Priority grouping order for Pending ───────────── */

const PRIORITY_ORDER: Priority[] = ["TODAY", "TOMORROW", "THREE_DAYS", "WEEK", "MONTH"];

/* ─── Helpers ───────────────────────────────────────── */

function isOverdue(task: Task): boolean {
  if (task.status === "DONE" || !task.dueDate) return false;
  return task.dueDate < todayStr();
}

function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return (SLOT_ORDER[a.timeSlot || ""] ?? 9) - (SLOT_ORDER[b.timeSlot || ""] ?? 9);
  });
}

/* ─── Skeleton ──────────────────────────────────────── */

function TaskSkeleton() {
  return (
    <div className="space-y-3 px-4 pt-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="bg-white rounded-xl border px-3 py-3 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-full bg-gray-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-3/4" />
              <div className="h-3 bg-gray-100 rounded w-1/3" />
            </div>
            <div className="w-7 h-7 rounded-full bg-gray-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Status icon ───────────────────────────────────── */

function StatusDot({ status, onTap }: { status: TaskStatusType; onTap: () => void }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onTap(); }}
      className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${cfg.border} ${cfg.bg} active:scale-90 transition-transform`}
      aria-label={`Status: ${cfg.label}. Tap to change.`}
    >
      {status === "DONE" && <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />}
      {status === "IN_PROGRESS" && <div className="w-2 h-2 rounded-full bg-blue-500" />}
      {status === "BLOCKED" && <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
    </button>
  );
}

/* ════════════════════════════════════════════════════ */
/*  MAIN PAGE COMPONENT                                */
/* ════════════════════════════════════════════════════ */

export default function TasksPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role ?? "";
  const userId = (session?.user as { userId?: string })?.userId ?? "";
  const isAdmin = role === "ADMIN" || role === "SUPERVISOR";

  /* ── State ─────────────────────────────────────────── */

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState<TaskStatusType | "ALL">("ALL");
  const [groupMode, setGroupMode] = useState<"priority" | "person">("priority");
  const [personFilter, setPersonFilter] = useState<string>(""); // staff member name filter
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // Staff members
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [showPeople, setShowPeople] = useState(false);
  const [newPersonName, setNewPersonName] = useState("");
  const [addingPerson, setAddingPerson] = useState(false);

  // Sheets
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [detailTask, setDetailTask] = useState<Task | null>(null);

  // Quick-add form
  const [newTitle, setNewTitle] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newPriority, setNewPriority] = useState<Priority>("TODAY");
  const [newTimeSlot, setNewTimeSlot] = useState<TimeSlotType | "">("");
  const [newAssignees, setNewAssignees] = useState<string[]>([]);
  const [newRecurring, setNewRecurring] = useState(false);
  const [newRecDays, setNewRecDays] = useState<string[]>([]);
  const [newPhotoUrls, setNewPhotoUrls] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [seeding, setSeeding] = useState(false);

  // Detail form
  const [editTitle, setEditTitle] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editStatus, setEditStatus] = useState<TaskStatusType>("PENDING");
  const [editPriority, setEditPriority] = useState<Priority>("TODAY");
  const [editTimeSlot, setEditTimeSlot] = useState<TimeSlotType | "">("");
  const [editRecurring, setEditRecurring] = useState(false);
  const [editRecDays, setEditRecDays] = useState<string[]>([]);
  const [editMyDay, setEditMyDay] = useState(false);
  const [editAssignees, setEditAssignees] = useState<string[]>([]);
  const [detailSaving, setDetailSaving] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  /* ── Fetch ─────────────────────────────────────────── */

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks");
      if (!res.ok) throw new Error("fetch failed");
      const json = await res.json();
      const data: Task[] = json.data ?? json;
      setTasks(data);
      setOffline(false);
      cacheTasksLocally(data);
    } catch {
      setOffline(true);
      const cached = getCachedTasks() as Task[] | null;
      if (cached) setTasks(cached);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStaff = useCallback(async () => {
    try {
      const res = await fetch("/api/users?limit=50");
      if (!res.ok) return;
      const json = await res.json();
      const data = json.data ?? json;
      setStaff(data.map((u: { id: string; name: string; role: string }) => ({ id: u.id, name: u.name, role: u.role })));
    } catch {}
  }, []);

  useEffect(() => {
    syncPendingActions().then(fetchTasks);
    fetchStaff();
  }, [fetchTasks, fetchStaff]);

  // Refetch staff when user returns to page (picks up newly added team members)
  useEffect(() => {
    const onFocus = () => fetchStaff();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchStaff]);

  /* ── Filtered + grouped ────────────────────────────── */

  const filtered = useMemo(() => {
    let list = tasks;
    if (statusFilter !== "ALL") {
      list = list.filter((t) => t.status === statusFilter);
    }
    if (personFilter) {
      list = list.filter((t) => {
        if (!t.assignees || t.assignees.length === 0) return personFilter === "__unassigned__";
        return t.assignees.some((a) => a.name === personFilter);
      });
    }
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.taskNo.toLowerCase().includes(q)
      );
    }
    return list;
  }, [tasks, statusFilter, personFilter, debouncedSearch]);

  interface GroupedSection {
    key: string;
    label: string;
    icon: React.ReactNode;
    color: string;
    tasks: Task[];
  }

  const sections = useMemo<GroupedSection[]>(() => {
    const inProgress = filtered.filter((t) => t.status === "IN_PROGRESS");
    const blocked = filtered.filter((t) => t.status === "BLOCKED");
    const pending = filtered.filter((t) => t.status === "PENDING");
    const done = filtered.filter((t) => t.status === "DONE");

    const groups: GroupedSection[] = [];

    if (inProgress.length > 0) {
      groups.push({
        key: "in_progress",
        label: "In Progress",
        icon: <Clock className="w-4 h-4 text-blue-600" />,
        color: "text-blue-700",
        tasks: sortTasks(inProgress),
      });
    }

    if (blocked.length > 0) {
      groups.push({
        key: "blocked",
        label: "Blocked",
        icon: <AlertCircle className="w-4 h-4 text-red-600" />,
        color: "text-red-700",
        tasks: sortTasks(blocked),
      });
    }

    // Pending subdivided by priority
    for (const p of PRIORITY_ORDER) {
      const byPriority = pending.filter((t) => t.priority === p);
      if (byPriority.length > 0) {
        const cfg = PRIORITY_CONFIG[p];
        groups.push({
          key: `pending_${p}`,
          label: cfg.label,
          icon: <span className="text-sm">{cfg.icon}</span>,
          color: cfg.color,
          tasks: sortTasks(byPriority),
        });
      }
    }

    if (done.length > 0) {
      groups.push({
        key: "done",
        label: "Done",
        icon: <CheckCircle2 className="w-4 h-4 text-green-600" />,
        color: "text-green-700",
        tasks: sortTasks(done),
      });
    }

    return groups;
  }, [filtered]);

  /* ── Person-grouped sections ─────────────────────────── */

  const personSections = useMemo<GroupedSection[]>(() => {
    if (groupMode !== "person") return [];
    const byPerson: Record<string, Task[]> = {};
    for (const t of filtered) {
      if (t.assignees && t.assignees.length > 0) {
        for (const a of t.assignees) {
          if (!byPerson[a.name]) byPerson[a.name] = [];
          byPerson[a.name].push(t);
        }
      } else {
        if (!byPerson["Syed"]) byPerson["Syed"] = [];
        byPerson["Syed"].push(t);
      }
    }
    return Object.entries(byPerson)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, tasks]) => ({
        key: `person_${name}`,
        label: `${name} (${tasks.filter(t => t.status !== "DONE").length} active)`,
        icon: <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold flex items-center justify-center">{name[0]}</span>,
        color: "text-gray-800",
        tasks: sortTasks(tasks),
      }));
  }, [filtered, groupMode]);

  /* ── Priority breakdown for header ─────────────────── */

  const priorityBreakdown = useMemo(() => {
    const counts: Record<Priority, number> = { TODAY: 0, TOMORROW: 0, THREE_DAYS: 0, WEEK: 0, MONTH: 0 };
    for (const t of filtered.filter((t) => t.status !== "DONE")) {
      if (counts[t.priority] !== undefined) counts[t.priority]++;
    }
    return counts;
  }, [filtered]);

  const openCount = filtered.filter((t) => t.status !== "DONE").length;
  const doneCount = filtered.filter((t) => t.status === "DONE").length;

  /* ── Unique person names for person chips ────────────── */
  const personNames = useMemo(() => {
    const names = new Set<string>();
    for (const t of tasks) {
      if (t.assignees && t.assignees.length > 0) {
        for (const a of t.assignees) names.add(a.name);
      }
    }
    return Array.from(names).sort();
  }, [tasks]);

  /* ── Selected person display name ───────────────────── */
  const selectedPersonName = personFilter || (isAdmin ? (personNames[0] || "All") : (session?.user as { name?: string })?.name || "You");

  /* ── Toggle collapse ──────────────────────────────── */

  function toggleCollapse(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  /* ── Status toggle ─────────────────────────────────── */

  async function cycleStatus(task: Task) {
    const ns = nextStatus(task.status);
    // Optimistic update
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: ns } : t)));

    if (offline || !navigator.onLine) {
      queueOfflineAction({ type: "task_status", payload: { id: task.id, status: ns } });
      return;
    }

    try {
      await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: ns }),
      });
    } catch {
      queueOfflineAction({ type: "task_status", payload: { id: task.id, status: ns } });
    }
  }

  /* ── My Day toggle ─────────────────────────────────── */

  async function toggleMyDay(task: Task) {
    const val = !task.isMyDay;
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, isMyDay: val } : t)));
    try {
      await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isMyDay: val }),
      });
    } catch { /* offline — will sync later */ }
  }

  /* ── WhatsApp digest ───────────────────────────────── */

  function sendDigest() {
    const active = tasks.filter((t) => t.status !== "DONE");
    const digest = buildTaskDigestWhatsApp(
      active.map((t) => ({
        taskNo: t.taskNo,
        title: t.title,
        priority: t.priority,
        timeSlot: t.timeSlot,
        recurrenceType: t.recurrenceType,
        notes: t.notes,
        assignees: t.assignees?.map((a) => a.name),
      }))
    );
    window.open(`https://wa.me/?text=${digest}`, "_blank");
  }

  /* ── Photo upload for tasks ── */
  async function uploadPhotoFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.success && data.data?.url) {
        setNewPhotoUrls((prev) => [...prev, data.data.url]);
      }
    } catch { /* silent */ }
    setUploadingPhoto(false);
  }

  function handlePaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) uploadPhotoFile(file);
      }
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      await uploadPhotoFile(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleNativeShare(task: Task) {
    const text = `📋 *${task.taskNo}: ${task.title}*\n${task.notes ? task.notes + "\n" : ""}Priority: ${task.priority}${task.assignees?.length ? "\nAssigned: " + task.assignees.map(a => a.name).join(", ") : ""}`;

    // If task has photos, try native share with files
    if (task.photoUrls && task.photoUrls.length > 0 && navigator.share) {
      try {
        const files: File[] = [];
        for (const url of task.photoUrls) {
          const res = await fetch(url);
          const blob = await res.blob();
          const ext = url.split(".").pop() || "jpg";
          files.push(new File([blob], `task-${task.taskNo}.${ext}`, { type: blob.type }));
        }
        if (navigator.canShare && navigator.canShare({ files })) {
          await navigator.share({ text, files });
          return;
        }
      } catch { /* fallback below */ }
    }

    // Fallback: text-only with image links
    let msg = text;
    if (task.photoUrls && task.photoUrls.length > 0) {
      msg += "\n\n📸 Photos:\n" + task.photoUrls.join("\n");
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  }

  /* ── Quick-add submit ──────────────────────────────── */

  async function handleQuickAdd() {
    if (!newTitle.trim() || submitting) return;
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        title: newTitle.trim(),
        notes: newNotes.trim() || undefined,
        priority: newPriority,
        timeSlot: newPriority === "TODAY" && newTimeSlot ? newTimeSlot : undefined,
        assigneeIds: newAssignees.length > 0 ? newAssignees : (userId ? [userId] : []),
        photoUrls: newPhotoUrls.length > 0 ? newPhotoUrls : undefined,
      };
      if (newRecurring && newRecDays.length > 0) {
        body.recurrenceType = "WEEKLY";
        body.recurrenceDays = newRecDays;
      }
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("create failed");
      // Reset form
      setNewTitle("");
      setNewNotes("");
      setNewPriority("TODAY");
      setNewTimeSlot("");
      setNewAssignees([]);
      setNewRecurring(false);
      setNewRecDays([]);
      setNewPhotoUrls([]);
      setShowQuickAdd(false);
      fetchTasks();
    } catch {
      // silent fail — user can retry
    } finally {
      setSubmitting(false);
    }
  }

  /* ── Open detail sheet ─────────────────────────────── */

  function openDetail(task: Task) {
    setDetailTask(task);
    setEditTitle(task.title);
    setEditNotes(task.notes ?? "");
    setEditStatus(task.status);
    setEditPriority(task.priority);
    setEditTimeSlot(task.timeSlot ?? "");
    setEditRecurring(!!task.recurrenceType);
    setEditRecDays(task.recurrenceDays ?? []);
    setEditMyDay(task.isMyDay);
    setEditAssignees(task.assignees?.map((a) => a.id) ?? []);
  }

  /* ── Detail save ───────────────────────────────────── */

  async function saveDetail() {
    if (!detailTask || detailSaving) return;
    setDetailSaving(true);
    try {
      const body: Record<string, unknown> = {
        title: editTitle.trim(),
        notes: editNotes.trim() || undefined,
        status: editStatus,
        priority: editPriority,
        timeSlot: editPriority === "TODAY" && editTimeSlot ? editTimeSlot : undefined,
        isMyDay: editMyDay,
        assigneeIds: editAssignees,
      };
      if (editRecurring && editRecDays.length > 0) {
        body.recurrenceType = "WEEKLY";
        body.recurrenceDays = editRecDays;
      } else {
        body.recurrenceType = null;
        body.recurrenceDays = [];
      }
      const res = await fetch(`/api/tasks/${detailTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("update failed");
      setDetailTask(null);
      fetchTasks();
    } catch { /* silent */ } finally {
      setDetailSaving(false);
    }
  }

  /* ── Delete task ───────────────────────────────────── */

  async function deleteTask(id: string) {
    if (!confirm("Delete this task?")) return;
    try {
      await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      setDetailTask(null);
      fetchTasks();
    } catch { /* silent */ }
  }

  /* ── Share single task via WhatsApp ────────────────── */

  function shareTask(task: Task) {
    const text = encodeURIComponent(
      `[${task.taskNo}] ${task.title}\nPriority: ${PRIORITY_CONFIG[task.priority].label}\nStatus: ${STATUS_CONFIG[task.status].label}${task.notes ? `\nNotes: ${task.notes}` : ""}`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  }

  /* ═══════════════════════════════════════════════════ */
  /*  RENDER                                             */
  /* ═══════════════════════════════════════════════════ */

  const STATUS_TABS: { key: TaskStatusType | "ALL"; label: string }[] = [
    { key: "ALL", label: "All" },
    { key: "PENDING", label: "Pending" },
    { key: "IN_PROGRESS", label: "In Progress" },
    { key: "BLOCKED", label: "Blocked" },
    { key: "DONE", label: "Done" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* ── Offline banner ─────────────────────────────── */}
      {offline && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2 text-amber-800 text-xs">
          <WifiOff className="w-3.5 h-3.5" />
          <span>You are offline. Showing cached tasks. Changes will sync when reconnected.</span>
        </div>
      )}

      {/* ── Header ─────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100 px-4 pt-3 pb-2">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="font-bold text-gray-900 text-base">{selectedPersonName}</h1>
            <p className="text-[11px] text-gray-400">{openCount} open · {doneCount} done</p>
            {/* Priority breakdown pills */}
            {openCount > 0 && (
              <div className="flex gap-1.5 mt-1 text-[10px] flex-wrap">
                {PRIORITY_ORDER.map((p) => {
                  const count = priorityBreakdown[p];
                  if (count === 0) return null;
                  const cfg = PRIORITY_CONFIG[p];
                  return (
                    <span key={p} className={`px-1.5 py-0.5 rounded font-medium ${cfg.bg} ${cfg.color}`}>
                      {count} {cfg.shortLabel}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={sendDigest}
              className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white text-sm active:scale-95 transition-transform"
              aria-label="Send WhatsApp digest"
            >
              <span className="text-sm">📱</span>
            </button>
          </div>
        </div>

        {/* ── Search ─────────────────────────────────────── */}
        <div className="relative mb-1.5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or ID..."
            className="w-full pl-9 pr-8 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-xs placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          {search && (
            <button type="button" onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm leading-none">×</button>
          )}
        </div>

        {/* ── Person filter chips ────────────────────────── */}
        {isAdmin && (
          <div className="flex gap-1 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
            {personNames.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPersonFilter(personFilter === p ? "" : p)}
                className={`shrink-0 text-[11px] px-2.5 py-1 rounded-full font-medium transition-colors ${
                  personFilter === p ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── WhatsApp reminder banner ──────────────────── */}
      {isAdmin && personFilter && (
        <div className="mx-4 mt-2 rounded-xl px-3 py-2.5 flex items-center gap-2 bg-blue-50 border border-blue-200">
          <span className="text-lg">📱</span>
          <div className="flex-1">
            <p className="text-xs font-semibold text-blue-700">Send {personFilter}&apos;s tasks via WhatsApp</p>
            <p className="text-[10px] text-gray-500">{openCount} open tasks</p>
          </div>
          <button
            type="button"
            onClick={sendDigest}
            className="text-xs px-3 py-1.5 rounded-lg font-medium bg-green-500 text-white active:scale-95 transition-transform"
          >
            Send
          </button>
        </div>
      )}

      {/* ── Task list ──────────────────────────────────── */}
      <div ref={scrollRef} className="px-4">
        {loading ? (
          <TaskSkeleton />
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 px-6">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Circle className="w-8 h-8 text-gray-300" />
            </div>
            <p className="text-gray-500 text-sm font-medium">No tasks yet</p>
            <p className="text-gray-400 text-xs mt-1 mb-4">Tap + to create your first task</p>
            {isAdmin && tasks.length === 0 && (
              <button
                type="button"
                disabled={seeding}
                onClick={async () => {
                  setSeeding(true);
                  try {
                    const res = await fetch("/api/tasks/seed", { method: "POST" });
                    const json = await res.json();
                    if (json.success) {
                      fetchTasks();
                    } else {
                      alert(json.error || "Seed failed");
                    }
                  } catch { alert("Network error"); }
                  setSeeding(false);
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl shadow active:scale-95 transition-transform disabled:opacity-50"
              >
                {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <span className="text-base">😊</span>}
                {seeding ? "Loading Tasks..." : "Load BCH Tasks"}
              </button>
            )}
          </div>
        ) : (
          sections.map((section) => {
            const isCollapsed = collapsed.has(section.key);
            return (
              <div key={section.key} className="mb-3">
                {/* Section header */}
                <button
                  type="button"
                  onClick={() => toggleCollapse(section.key)}
                  className="flex items-center gap-2 w-full py-2 active:opacity-70"
                >
                  {isCollapsed ? (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                  {section.icon}
                  <span className={`text-xs font-semibold ${section.color}`}>
                    {section.label}
                  </span>
                  <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-medium">
                    {section.tasks.length}
                  </span>
                </button>

                {/* Task cards */}
                {!isCollapsed &&
                  section.tasks.map((task) => {
                    const overdue = isOverdue(task);
                    const isDone = task.status === "DONE";
                    return (
                      <div
                        key={task.id}
                        onClick={() => openDetail(task)}
                        className={`bg-white rounded-xl border px-3 py-2.5 mb-2 active:bg-gray-50 transition-colors cursor-pointer ${
                          isDone ? "opacity-40 border-gray-100" : ""
                        } ${overdue ? "border-red-200 bg-red-50/30" : ""}`}
                      >
                        <div className="flex items-start gap-2.5">
                          {/* Status dot */}
                          <div className="pt-0.5">
                            <StatusDot status={task.status} onTap={() => cycleStatus(task)} />
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium text-slate-800 leading-tight ${isDone ? "line-through" : ""}`}>
                              {task.title}
                            </p>
                            <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                              {task.taskNo}
                            </p>

                            {/* Info row */}
                            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                              {/* Assignee pills */}
                              {task.assignees?.map((a) => (
                                <span
                                  key={a.id}
                                  className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full font-medium"
                                >
                                  {a.name}
                                </span>
                              ))}
                              {/* Time slot icon */}
                              {task.timeSlot && (
                                <span className="text-xs">
                                  {TIME_SLOTS.find((s) => s.key === task.timeSlot)?.icon}
                                </span>
                              )}
                              {/* Recurrence */}
                              {task.recurrenceType && (
                                <span className="text-xs" title="Recurring">🔄</span>
                              )}
                              {/* Photo count */}
                              {task.photoUrls && task.photoUrls.length > 0 && (
                                <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                                  <Camera className="w-3 h-3" />
                                  {task.photoUrls.length}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* My Day toggle */}
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); toggleMyDay(task); }}
                            className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 active:scale-90 transition-transform ${
                              task.isMyDay ? "bg-yellow-100" : "bg-gray-50"
                            }`}
                            aria-label={task.isMyDay ? "Remove from My Day" : "Add to My Day"}
                          >
                            {task.isMyDay ? (
                              <Sun className="w-4 h-4 text-yellow-600" />
                            ) : (
                              <Sun className="w-4 h-4 text-gray-300" />
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            );
          })
        )}
      </div>

      {/* ── FAB (Admin/Supervisor only) ────────────────── */}
      {isAdmin && !showQuickAdd && !detailTask && (
        <button
          type="button"
          onClick={() => setShowQuickAdd(true)}
          className="fixed above-nav right-4 w-14 h-14 bg-blue-600 rounded-full shadow-lg z-50 flex items-center justify-center active:scale-95 transition-transform"
          aria-label="Add task"
        >
          <Plus className="w-6 h-6 text-white" />
        </button>
      )}

      {/* ── Quick-add bottom sheet ─────────────────────── */}
      {showQuickAdd && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/30 z-50"
            onClick={() => setShowQuickAdd(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-50 max-h-[85vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom">
            <div className="px-4 pt-3 pb-24">
              {/* Handle bar */}
              <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />

              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-900">New Task</h2>
                <button
                  type="button"
                  onClick={() => setShowQuickAdd(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>

              {/* Title */}
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Task title *"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-200"
                autoFocus
              />

              {/* Notes — supports paste */}
              <textarea
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                onPaste={handlePaste}
                placeholder="Notes (optional) — paste screenshots here"
                rows={2}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm mb-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-200"
              />

              {/* Photos */}
              <div className="mb-4">
                {newPhotoUrls.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto mb-2">
                    {newPhotoUrls.map((url, i) => (
                      <div key={i} className="relative w-16 h-16 flex-shrink-0">
                        <img src={url} alt="" className="w-16 h-16 object-cover rounded-lg border" />
                        <button type="button" onClick={() => setNewPhotoUrls(prev => prev.filter((_, idx) => idx !== i))}
                          className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" multiple capture="environment" onChange={handleFileSelect} className="hidden" />
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingPhoto}
                  className="flex items-center gap-1.5 text-xs text-blue-600 font-medium disabled:opacity-50">
                  <Camera className="w-3.5 h-3.5" />
                  {uploadingPhoto ? "Uploading..." : "Add Photo / Screenshot"}
                </button>
              </div>

              {/* Priority */}
              <label className="text-xs font-medium text-gray-500 mb-2 block">Priority</label>
              <div className="flex gap-2 mb-4">
                {PRIORITY_ORDER.map((p) => {
                  const cfg = PRIORITY_CONFIG[p];
                  const selected = newPriority === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setNewPriority(p)}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${cfg.bg} ${cfg.color} ${
                        selected ? "ring-2 ring-offset-1 ring-blue-500" : ""
                      }`}
                    >
                      {cfg.icon} {cfg.label}
                    </button>
                  );
                })}
              </div>

              {/* Time slot (required when TODAY) */}
              {newPriority === "TODAY" && (
                <>
                  <label className="text-xs font-medium text-gray-500 mb-2 block">
                    Time Slot <span className="text-red-400">*</span>
                  </label>
                  <div className="flex gap-2 mb-4">
                    {TIME_SLOTS.map((slot) => {
                      const selected = newTimeSlot === slot.key;
                      return (
                        <button
                          key={slot.key}
                          type="button"
                          onClick={() => setNewTimeSlot(slot.key)}
                          className={`flex-1 py-2.5 rounded-lg text-xs font-medium transition-all bg-gray-50 ${
                            selected ? "ring-2 ring-offset-1 ring-blue-500 bg-blue-50 text-blue-700" : "text-gray-600"
                          }`}
                        >
                          <span className="text-base block mb-0.5">{slot.icon}</span>
                          {slot.label}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Assign to */}
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-gray-500">Assign To</label>
                <button type="button" onClick={() => setShowPeople(true)}
                  className="text-[11px] text-blue-600 font-medium flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" /> Manage People
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {staff.map((s) => {
                  const active = newAssignees.includes(s.id);
                  return (
                    <button key={s.id} type="button"
                      onClick={() => setNewAssignees((prev) => active ? prev.filter((x) => x !== s.id) : [...prev, s.id])}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        active ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"
                      }`}>
                      {s.name}
                    </button>
                  );
                })}
                {staff.length === 0 && (
                  <p className="text-xs text-gray-400">No team members yet. Tap &quot;Manage People&quot; to add.</p>
                )}
              </div>

              {/* Recurring */}
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-gray-500">Recurring</label>
                <button
                  type="button"
                  onClick={() => setNewRecurring(!newRecurring)}
                  className={`w-10 h-6 rounded-full transition-colors relative ${
                    newRecurring ? "bg-blue-600" : "bg-gray-200"
                  }`}
                >
                  <div
                    className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${
                      newRecurring ? "left-5" : "left-1"
                    }`}
                  />
                </button>
              </div>
              {newRecurring && (
                <div className="flex gap-1.5 mb-4">
                  {DAYS.map((d) => {
                    const active = newRecDays.includes(d.key);
                    return (
                      <button
                        key={d.key}
                        type="button"
                        onClick={() =>
                          setNewRecDays((prev) =>
                            active ? prev.filter((x) => x !== d.key) : [...prev, d.key]
                          )
                        }
                        className={`w-10 h-10 rounded-full text-xs font-medium transition-all ${
                          active ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Submit */}
              <button
                type="button"
                onClick={handleQuickAdd}
                disabled={!newTitle.trim() || submitting}
                className="w-full py-3 rounded-xl bg-blue-600 text-white font-medium text-sm disabled:opacity-40 active:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {submitting ? "Creating..." : "Create Task"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Detail bottom sheet ────────────────────────── */}
      {detailTask && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/30 z-50"
            onClick={() => setDetailTask(null)}
          />
          <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-50 max-h-[92vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom">
            <div className="px-4 pt-3 pb-24">
              {/* Handle bar */}
              <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />

              {/* Editable title */}
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full text-lg font-semibold text-slate-900 bg-transparent border-b border-transparent focus:border-blue-300 focus:outline-none pb-1 mb-1"
              />
              <p className="text-[10px] text-gray-400 font-mono mb-4">{detailTask.taskNo}</p>

              {/* Quick actions row */}
              <div className="flex items-center gap-3 mb-5">
                {/* My Day */}
                <button
                  type="button"
                  onClick={() => setEditMyDay(!editMyDay)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium ${
                    editMyDay ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  <Sun className="w-4 h-4" />
                  My Day
                </button>
                {/* Share */}
                <button
                  type="button"
                  onClick={() => shareTask(detailTask)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-100 text-gray-600 text-xs font-medium"
                >
                  <Share2 className="w-4 h-4" />
                  Share
                </button>
                {/* Delete (admin only) */}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => deleteTask(detailTask.id)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-50 text-red-600 text-xs font-medium ml-auto"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                )}
              </div>

              {/* Status selector */}
              <label className="text-xs font-medium text-gray-500 mb-2 block">Status</label>
              <div className="flex gap-2 mb-4">
                {(Object.keys(STATUS_CONFIG) as TaskStatusType[]).map((s) => {
                  const cfg = STATUS_CONFIG[s];
                  const selected = editStatus === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setEditStatus(s)}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${cfg.bg} ${cfg.text} ${
                        selected ? "ring-2 ring-offset-1 ring-blue-500" : ""
                      }`}
                    >
                      {cfg.label}
                    </button>
                  );
                })}
              </div>

              {/* Priority selector */}
              <label className="text-xs font-medium text-gray-500 mb-2 block">Priority</label>
              <div className="flex gap-2 mb-4">
                {PRIORITY_ORDER.map((p) => {
                  const cfg = PRIORITY_CONFIG[p];
                  const selected = editPriority === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setEditPriority(p)}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${cfg.bg} ${cfg.color} ${
                        selected ? "ring-2 ring-offset-1 ring-blue-500" : ""
                      }`}
                    >
                      {cfg.icon}
                    </button>
                  );
                })}
              </div>

              {/* Time slot selector */}
              <label className="text-xs font-medium text-gray-500 mb-2 block">Time Slot</label>
              <div className="flex gap-2 mb-4">
                {TIME_SLOTS.map((slot) => {
                  const selected = editTimeSlot === slot.key;
                  return (
                    <button
                      key={slot.key}
                      type="button"
                      onClick={() => setEditTimeSlot(selected ? "" : slot.key)}
                      className={`flex-1 py-2.5 rounded-lg text-xs font-medium transition-all bg-gray-50 ${
                        selected ? "ring-2 ring-offset-1 ring-blue-500 bg-blue-50 text-blue-700" : "text-gray-600"
                      }`}
                    >
                      <span className="text-base block mb-0.5">{slot.icon}</span>
                      {slot.label}
                    </button>
                  );
                })}
              </div>

              {/* Due date */}
              {detailTask.dueDate && (
                <div className="mb-4">
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Due Date</label>
                  <p className="text-sm text-gray-700">
                    {new Date(detailTask.dueDate).toLocaleDateString("en-IN", {
                      weekday: "short", day: "numeric", month: "short", year: "numeric",
                    })}
                  </p>
                </div>
              )}

              {/* Assign to */}
              <label className="text-xs font-medium text-gray-500 mb-2 block">Assign To</label>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {staff.map((s) => {
                  const active = editAssignees.includes(s.id);
                  return (
                    <button key={s.id} type="button"
                      onClick={() => setEditAssignees((prev) => active ? prev.filter((x) => x !== s.id) : [...prev, s.id])}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        active ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"
                      }`}>
                      {s.name}
                    </button>
                  );
                })}
              </div>

              {/* Recurring */}
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-gray-500">Recurring</label>
                <button
                  type="button"
                  onClick={() => setEditRecurring(!editRecurring)}
                  className={`w-10 h-6 rounded-full transition-colors relative ${
                    editRecurring ? "bg-blue-600" : "bg-gray-200"
                  }`}
                >
                  <div
                    className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${
                      editRecurring ? "left-5" : "left-1"
                    }`}
                  />
                </button>
              </div>
              {editRecurring && (
                <div className="flex gap-1.5 mb-4">
                  {DAYS.map((d) => {
                    const active = editRecDays.includes(d.key);
                    return (
                      <button
                        key={d.key}
                        type="button"
                        onClick={() =>
                          setEditRecDays((prev) =>
                            active ? prev.filter((x) => x !== d.key) : [...prev, d.key]
                          )
                        }
                        className={`w-10 h-10 rounded-full text-xs font-medium transition-all ${
                          active ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Notes */}
              <label className="text-xs font-medium text-gray-500 mb-2 block">Notes</label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Add notes..."
                rows={3}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm mb-4 resize-none focus:outline-none focus:ring-2 focus:ring-blue-200"
              />

              {/* Photo grid */}
              {detailTask.photoUrls && detailTask.photoUrls.length > 0 && (
                <div className="mb-4">
                  <label className="text-xs font-medium text-gray-500 mb-2 block">Photos</label>
                  <div className="grid grid-cols-3 gap-2">
                    {detailTask.photoUrls.map((url, i) => (
                      <div key={i} className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={`Task photo ${i + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Share on WhatsApp */}
              <button
                type="button"
                onClick={() => handleNativeShare(detailTask)}
                className="w-full py-2.5 rounded-xl bg-green-600 text-white font-medium text-sm active:bg-green-700 transition-colors flex items-center justify-center gap-2 mb-2"
              >
                <Share2 className="w-4 h-4" />
                Share on WhatsApp
              </button>

              {/* Save button */}
              <button
                type="button"
                onClick={saveDetail}
                disabled={detailSaving}
                className="w-full py-3 rounded-xl bg-blue-600 text-white font-medium text-sm disabled:opacity-40 active:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                {detailSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                {detailSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Manage People bottom sheet ────────────────── */}
      {showPeople && (
        <>
          <div className="fixed inset-0 bg-black/30 z-[60]" onClick={() => setShowPeople(false)} />
          <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-[60] max-h-[80vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom">
            <div className="px-5 pt-3 pb-6 flex flex-col flex-1 min-h-0">
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-gray-900">Manage People</h2>
                <button type="button" onClick={() => setShowPeople(false)} className="text-gray-400 text-2xl leading-none">&times;</button>
              </div>

              {/* Add new person */}
              <div className="flex gap-2 mb-4">
                <input
                  value={newPersonName}
                  onChange={(e) => setNewPersonName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addPerson()}
                  placeholder="Add person name..."
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={addPerson}
                  disabled={!newPersonName.trim() || addingPerson}
                  className="bg-blue-600 text-white text-sm font-semibold px-4 rounded-xl disabled:opacity-40"
                >
                  {addingPerson ? "..." : "Add"}
                </button>
              </div>

              {/* Staff list */}
              <div className="flex-1 overflow-y-auto space-y-2">
                {staff.map((s) => (
                  <div key={s.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                    <div>
                      <span className="text-sm font-medium text-gray-800">{s.name}</span>
                      <span className="text-[10px] text-gray-400 ml-2">{s.role}</span>
                    </div>
                  </div>
                ))}
                {staff.length === 0 && (
                  <p className="text-center text-sm text-gray-400 py-8">No team members yet</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );

  async function addPerson() {
    const name = newPersonName.trim();
    if (!name || addingPerson) return;
    setAddingPerson(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, role: "CUSTOM", accessCode: Math.random().toString(36).slice(2, 8) }),
      });
      if (res.ok) {
        setNewPersonName("");
        fetchStaff();
      }
    } catch {}
    setAddingPerson(false);
  }
}
