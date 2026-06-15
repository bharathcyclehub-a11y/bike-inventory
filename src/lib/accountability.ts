import { prisma } from "@/lib/db";

/**
 * Daily Accountability scorecard — the single "is the system being followed?"
 * number, built from existing operational data. Measures TIMELINESS and
 * BACKLOG (work logged but sitting overdue), which is the part an app can
 * self-measure. The physical "did it get entered at all" match is the human
 * Checker's job — the app can't see what was never logged.
 *
 * SLA thresholds mirror /api/health/summary:
 *   Inwards (Nithin) & Deliveries (Ranjitha): late after 24h
 *   Purchase Orders (Abhi): late after 48h
 */

export interface PersonScore {
  name: string;
  process: string;
  open: number;        // open items owned by this person
  late: number;        // open items past their SLA threshold
  onTimePct: number;   // open > 0 ? round((open - late) / open * 100) : 100
}

export interface AccountabilityScorecard {
  dateLabel: string;       // e.g. "10 Jun 2026" (IST)
  compliancePct: number;   // team-wide on-time %
  totalOpen: number;
  totalLate: number;
  people: PersonScore[];
  expensesToday: number;   // accounts activity (not a backlog metric)
}

function pct(open: number, late: number): number {
  return open > 0 ? Math.round(((open - late) / open) * 100) : 100;
}

export async function buildAccountabilityScorecard(): Promise<AccountabilityScorecard> {
  const now = new Date();
  const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const h48 = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const [nithin, ranjitha, abhi, expensesToday] = await Promise.all([
    prisma.$queryRaw<[{ open: number; late: number }]>`
      SELECT COUNT(*)::int AS open,
             COUNT(*) FILTER (WHERE "createdAt" < ${h24})::int AS late
      FROM "InboundShipment" WHERE status IN ('IN_TRANSIT', 'PARTIALLY_DELIVERED')`,
    prisma.$queryRaw<[{ open: number; late: number }]>`
      SELECT COUNT(*)::int AS open,
             COUNT(*) FILTER (WHERE "invoiceDate" < ${h24})::int AS late
      FROM "Delivery" WHERE status IN ('PENDING', 'VERIFIED', 'SCHEDULED')`,
    prisma.$queryRaw<[{ open: number; late: number }]>`
      SELECT COUNT(*)::int AS open,
             COUNT(*) FILTER (WHERE "orderDate" < ${h48})::int AS late
      FROM "PurchaseOrder" WHERE status IN ('SENT_TO_VENDOR', 'PARTIALLY_RECEIVED')`,
    prisma.expense.count({ where: { date: { gte: todayStart } } }),
  ]);

  const people: PersonScore[] = [
    { name: "Nithin", process: "Inwards", open: nithin[0].open, late: nithin[0].late, onTimePct: pct(nithin[0].open, nithin[0].late) },
    { name: "Ranjitha", process: "Deliveries", open: ranjitha[0].open, late: ranjitha[0].late, onTimePct: pct(ranjitha[0].open, ranjitha[0].late) },
    { name: "Abhi Gowda", process: "Purchase Orders", open: abhi[0].open, late: abhi[0].late, onTimePct: pct(abhi[0].open, abhi[0].late) },
  ];

  const totalOpen = people.reduce((s, p) => s + p.open, 0);
  const totalLate = people.reduce((s, p) => s + p.late, 0);

  const dateLabel = now.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric",
  });

  return {
    dateLabel,
    compliancePct: pct(totalOpen, totalLate),
    totalOpen,
    totalLate,
    people,
    expensesToday,
  };
}

/** WhatsApp-formatted daily push. */
export function formatScorecardMessage(s: AccountabilityScorecard): string {
  const flag = (p: number) => (p >= 90 ? "✅" : p >= 70 ? "⚠️" : "🔴");

  const lines = [
    `*BCH Daily Accountability — ${s.dateLabel}*`,
    `Compliance: ${s.compliancePct}% ${flag(s.compliancePct)}`,
    "",
  ];

  for (const p of s.people) {
    const mark = p.late > 0 ? "⚠️" : "✅";
    lines.push(`${p.name} (${p.process}): ${p.open} open · ${p.late} late ${mark}`);
  }
  lines.push(`Sravan (Accounts): ${s.expensesToday} expense${s.expensesToday === 1 ? "" : "s"} logged today`);

  const latePeople = s.people.filter((p) => p.late > 0);
  lines.push("");
  if (latePeople.length === 0) {
    lines.push("All clear — no overdue items.");
  } else {
    lines.push(`${latePeople.length} ${latePeople.length === 1 ? "person has" : "people have"} late items — follow up: ${latePeople.map((p) => p.name).join(", ")}.`);
  }
  lines.push("", "Open app: https://bike-inventory.vercel.app");
  return lines.join("\n");
}
