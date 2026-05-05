// Operations Hub constants — ported from BCH KB app

export type Priority = "TODAY" | "TOMORROW" | "THREE_DAYS" | "WEEK" | "MONTH";
export type TaskStatusType = "PENDING" | "IN_PROGRESS" | "DONE" | "BLOCKED";
export type TimeSlotType = "MORNING" | "AFTERNOON" | "EVENING";
export type UpdateCategory = "Sales" | "Staff" | "Ops" | "Issue" | "Win" | "Other";

export const PRIORITY_CONFIG: Record<Priority, { label: string; shortLabel: string; color: string; bg: string; border: string; dot: string; icon: string }> = {
  TODAY:      { label: "Today",     shortLabel: "Today",  color: "text-red-700",    bg: "bg-red-50",    border: "border-red-200",    dot: "bg-red-500",    icon: "🔴" },
  TOMORROW:   { label: "Tomorrow",  shortLabel: "Tmrw",   color: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200", dot: "bg-orange-500", icon: "🟠" },
  THREE_DAYS: { label: "3 Days",    shortLabel: "3 Days", color: "text-yellow-700", bg: "bg-yellow-50", border: "border-yellow-200", dot: "bg-yellow-500", icon: "🟡" },
  WEEK:       { label: "This Week", shortLabel: "Week",   color: "text-blue-700",   bg: "bg-blue-50",   border: "border-blue-200",   dot: "bg-blue-500",   icon: "🔵" },
  MONTH:      { label: "This Month",shortLabel: "Month",  color: "text-gray-600",   bg: "bg-gray-50",   border: "border-gray-200",   dot: "bg-gray-400",   icon: "⚪" },
};

export const STATUS_CONFIG: Record<TaskStatusType, { label: string; border: string; bg: string; text: string }> = {
  PENDING:     { label: "Pending",     border: "border-gray-300",   bg: "bg-gray-100",  text: "text-gray-600" },
  IN_PROGRESS: { label: "In Progress", border: "border-blue-400",   bg: "bg-blue-100",  text: "text-blue-700" },
  DONE:        { label: "Done",        border: "border-green-400",  bg: "bg-green-100", text: "text-green-700" },
  BLOCKED:     { label: "Blocked",     border: "border-red-400",    bg: "bg-red-100",   text: "text-red-700" },
};

export const TIME_SLOTS: { key: TimeSlotType; label: string; icon: string; range: string }[] = [
  { key: "MORNING",   label: "Morning",   icon: "🌅", range: "9 AM – 12 PM" },
  { key: "AFTERNOON", label: "Afternoon", icon: "☀️", range: "12 PM – 5 PM" },
  { key: "EVENING",   label: "Evening",   icon: "🌙", range: "5 PM – 9 PM" },
];

export const DAYS = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];

export const CATEGORY_COLORS: Record<UpdateCategory, { bg: string; text: string }> = {
  Sales: { bg: "bg-green-100", text: "text-green-700" },
  Staff: { bg: "bg-blue-100",  text: "text-blue-700" },
  Ops:   { bg: "bg-purple-100",text: "text-purple-700" },
  Issue: { bg: "bg-red-100",   text: "text-red-700" },
  Win:   { bg: "bg-amber-100", text: "text-amber-700" },
  Other: { bg: "bg-gray-100",  text: "text-gray-600" },
};

export const UPDATE_CATEGORIES: UpdateCategory[] = ["Sales", "Staff", "Ops", "Issue", "Win", "Other"];

export const SOP_CATEGORIES = ["All", "Sales", "Service", "Ops", "Finance", "Billing", "BDC", "Content"];

export const FREQUENCY_LABELS: Record<string, string> = {
  SOP_DAILY: "Daily",
  SOP_WEEKLY: "Weekly",
  SOP_MONTHLY: "Monthly",
};

// ── Helpers ──────────────────────────────────────

export function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

export function todayDayKey(): string {
  return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][new Date().getDay()];
}

export function dueDateFromPriority(priority: Priority): Date {
  const now = new Date();
  switch (priority) {
    case "TODAY": return now;
    case "TOMORROW": return new Date(now.getTime() + 86400000);
    case "THREE_DAYS": return new Date(now.getTime() + 3 * 86400000);
    case "WEEK": return new Date(now.getTime() + 7 * 86400000);
    case "MONTH": return new Date(now.getTime() + 30 * 86400000);
  }
}

export function formatDueExpectation(priority: Priority): string {
  const cfg = PRIORITY_CONFIG[priority];
  return cfg ? cfg.label : priority;
}

export function buildTaskDigestWhatsApp(tasks: { taskNo: string; title: string; priority: Priority; timeSlot?: string; recurrenceType?: string; notes?: string; assignees?: string[] }[]): string {
  const grouped: Record<string, typeof tasks> = {};
  for (const t of tasks) {
    const key = t.priority;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(t);
  }

  const lines: string[] = ["📋 *BCH Task Digest*", `📅 ${new Date().toLocaleDateString("en-IN")}`, ""];
  const order: Priority[] = ["TODAY", "TOMORROW", "THREE_DAYS", "WEEK", "MONTH"];

  for (const p of order) {
    const items = grouped[p];
    if (!items?.length) continue;
    lines.push(`${PRIORITY_CONFIG[p].icon} *${PRIORITY_CONFIG[p].label}*`);
    for (const t of items) {
      let line = `  • [${t.taskNo}] ${t.title}`;
      if (t.timeSlot) line += ` (${t.timeSlot.toLowerCase()})`;
      if (t.recurrenceType) line += " 🔄";
      if (t.assignees?.length) line += ` → ${t.assignees.join(", ")}`;
      lines.push(line);
    }
    lines.push("");
  }

  return encodeURIComponent(lines.join("\n"));
}

export function buildSOPChecklistWhatsApp(sops: { title: string; description?: string | null; category: string; checked: boolean }[], personName: string): string {
  const lines = [`📋 *SOP Checklist — ${personName}*`, `📅 ${new Date().toLocaleDateString("en-IN")}`, ""];
  const done = sops.filter(s => s.checked);
  const pending = sops.filter(s => !s.checked);

  if (done.length) {
    lines.push(`✅ *Done (${done.length})*`);
    for (const s of done) {
      lines.push(`  • ${s.title}`);
      if (s.description) lines.push(`    _${s.description}_`);
    }
    lines.push("");
  }
  if (pending.length) {
    lines.push(`⬜ *Pending (${pending.length})*`);
    for (const s of pending) {
      lines.push(`  • ${s.title}`);
      if (s.description) lines.push(`    _${s.description}_`);
    }
  }

  return encodeURIComponent(lines.join("\n"));
}

export function buildViolationReportWhatsApp(violations: { staffName: string; sopTitle: string; notes?: string; timestamp: string }[], personName: string): string {
  const lines = [`⚠️ *SOP Violations — ${personName}*`, `📅 Week of ${new Date().toLocaleDateString("en-IN")}`, ""];
  for (const v of violations) {
    lines.push(`• ${v.sopTitle} — ${new Date(v.timestamp).toLocaleDateString("en-IN")}`);
    if (v.notes) lines.push(`  _${v.notes}_`);
  }
  if (!violations.length) lines.push("No violations this week ✅");
  return encodeURIComponent(lines.join("\n"));
}
