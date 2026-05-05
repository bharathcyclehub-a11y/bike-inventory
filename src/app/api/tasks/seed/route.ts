export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

// All 87 tasks from BCH KB app — mapped to bike-inventory schema
const SEED_TASKS: { title: string; priority: "TODAY" | "WEEK" | "MONTH"; category: string }[] = [
  // ── IBRAHIM DECISIONS (This Week) ─────────────────────
  { title: "IVR redesign — record new messages, set correct routing. ONE AFTERNOON.", priority: "WEEK", category: "Ops" },
  { title: "Mujju 1-on-1 — \"You refused the Belief stock task on Mar 11. That cannot repeat.\"", priority: "WEEK", category: "Staff" },
  { title: "Abhi Gowda warehouse theft conversation — Rs.70K bike. Private. Direct.", priority: "WEEK", category: "Staff" },
  { title: "2XG GST — file TODAY. Call CA. Get acknowledgement number.", priority: "WEEK", category: "Ops" },
  { title: "SM re-hire — approve Srinu's shortlist. Shivraj left Day 1.", priority: "WEEK", category: "Staff" },
  { title: "Keshav replacement — approve new Content Ops hire", priority: "WEEK", category: "Staff" },
  { title: "Cameraman — lock one permanently. 10 shots/day needs dedicated shooter.", priority: "WEEK", category: "Ops" },
  { title: "Abhi Editor replacement — Basava and Rahul briefing. Daily tasks assigned.", priority: "WEEK", category: "Staff" },
  { title: "90-day recovery plan — pick ONE move and START it this week", priority: "WEEK", category: "Ops" },
  { title: "New employee agreement — 6 clauses. Every new hire signs before Day 1.", priority: "WEEK", category: "Staff" },
  { title: "Keshav settlement — days worked pay. Confirm amount. Pay. Close.", priority: "WEEK", category: "Staff" },

  // ── 2XG SPRINT (This Week) ────────────────────────────
  { title: "Concall at PR — finalize script: cast names, roles, specifications. Before 4PM.", priority: "WEEK", category: "Ops" },
  { title: "Aoki: Send Parna group message re proforma invoice + 3 approved Brute concepts", priority: "WEEK", category: "Sales" },
  { title: "Close Amar — script writer. Finalize onboarding today.", priority: "WEEK", category: "Staff" },
  { title: "TI brand name — confirm with Rathi. Can't shoot Apr 2 without this.", priority: "WEEK", category: "Ops" },
  { title: "Cast talent for TI Apr 2 shoot. Need: adult male, parent + kid (6-8), 4-6 cyclists.", priority: "WEEK", category: "Ops" },
  { title: "Review TI Batch 2 (10 concepts) — pick 5-6 for Apr 2. Maeve first → Montra Hypno Plus.", priority: "WEEK", category: "Ops" },
  { title: "Push Prashant for payment. Share document with leads flow + what's been delivered.", priority: "WEEK", category: "Sales" },
  { title: "Give laptop to Pandey with new account. Give visiting card to Alok.", priority: "WEEK", category: "Ops" },
  { title: "Call 15 businesses from 628 list. ONE category. Log every call. Before 5PM.", priority: "WEEK", category: "Sales" },
  { title: "Aoki strategy decision — continue or go black. NO more number promises to Aoki.", priority: "WEEK", category: "Sales" },
  { title: "Pull 2XG site down — not ready to be live.", priority: "WEEK", category: "Ops" },
  { title: "TI Cycles invoice — send same hour GST arrives.", priority: "WEEK", category: "Sales" },

  // ── SALES FLOOR (This Week) ───────────────────────────
  { title: "EMI failure — assign owner. 30% failure = Rs.18L/month leak. Who tracks bounce callbacks?", priority: "WEEK", category: "Sales" },
  { title: "Fix escalation SOP for lost deals — what happens when customer walks without buying?", priority: "WEEK", category: "Sales" },
  { title: "Basava + Rahul briefing — daily tasks, profiles they own, who they report to", priority: "WEEK", category: "Staff" },
  { title: "78 shots ready — create edit queue. Basava: profiles 1-4, Rahul: profiles 5-9.", priority: "WEEK", category: "Ops" },
  { title: "Lock dedicated cameraman — name the person, daily schedule, which profiles", priority: "WEEK", category: "Staff" },
  { title: "10 shots/day plan — shoot schedule for next 7 days", priority: "WEEK", category: "Ops" },

  // ── CONTENT (This Week) ────────────────────────────────
  { title: "NEXT-BLR: Fill CJ-1 to CJ-8 video metrics", priority: "WEEK", category: "Ops" },
  { title: "Approve 5 DTC overviews (Battery Swap, Rs.164/Day, Parents Wrong, Guess Karo, Store Tour)", priority: "WEEK", category: "Ops" },
  { title: "NEXT-BLR: This week's content calendar — shoot plan for 7 days", priority: "WEEK", category: "Ops" },
  { title: "Edit and publish 10 pieces TODAY from the 78-shot ready pool", priority: "WEEK", category: "Ops" },

  // ── SALES (This Month) ─────────────────────────────────
  { title: "WhatsApp follow-up — any lead not converted in 48 hours gets a message [Suma]", priority: "MONTH", category: "Sales" },
  { title: "Overdue invoices — Rs.5.60L outstanding. RAJENDHRA REDDY Rs.60K top priority. [Suma]", priority: "MONTH", category: "Sales" },
  { title: "Brand inventory — make visible on floor. Hidden stock = zero sales. [Iqbal]", priority: "MONTH", category: "Ops" },
  { title: "Floor layout fix — salespeople with backs to door = walkout problem", priority: "MONTH", category: "Ops" },
  { title: "Pricing authority — define which deals Sunil can approve without Ibrahim", priority: "MONTH", category: "Sales" },
  { title: "Google review capture — part of post-sale process. One message, one QR code. [Srinu]", priority: "MONTH", category: "Sales" },
  { title: "Post-sale follow-up system — day 3 and day 7 messages to all buyers [Suma]", priority: "MONTH", category: "Sales" },
  { title: "Online price check — Amazon/Flipkart audit. Know where BCH wins and loses. [Nithin]", priority: "MONTH", category: "Sales" },

  // ── PEOPLE (This Month) ────────────────────────────────
  { title: "Nithin 1-on-1 — walk through new role card. Rs.15L target. Revenue slab explained.", priority: "MONTH", category: "Staff" },
  { title: "Shravan — weekend offs conversation. Clear expectation set.", priority: "MONTH", category: "Staff" },
  { title: "Appi — recognition fix. Flight risk is real. 5-minute conversation.", priority: "MONTH", category: "Staff" },
  { title: "1-on-1s with all staff — 15-20 min each, walk through role doc [Srinu]", priority: "MONTH", category: "Staff" },
  { title: "CCTV install — warehouse. Get quote. Install this week. [Shravan]", priority: "MONTH", category: "Ops" },
  { title: "PDI gate — no cycle goes to sales floor below 100% fitting. Mohan or Shravan owns it.", priority: "MONTH", category: "Ops" },
  { title: "6-point PDI checklist — wheel, brakes, gears, outer wire, crank bolt, tyre air. [Shravan]", priority: "MONTH", category: "Ops" },
  { title: "Service TAT — track 24hr completion rate. Report to Ibrahim weekly. [Shravan]", priority: "MONTH", category: "Ops" },

  // ── 2XG (This Month) ───────────────────────────────────
  { title: "Sort wifi — 30 mtr cable + router. Pandey can't work without it.", priority: "MONTH", category: "Ops" },
  { title: "Get Srinu's videographer contacts (2 names + numbers) for TI shoot Apr 2", priority: "MONTH", category: "Staff" },
  { title: "Founding team — name 3 people to recruit: Ops Excellence, App Dev, +1 more", priority: "MONTH", category: "Staff" },
  { title: "CRM setup — Notion. Business Name, Owner, Contact, Revenue Est., Status [Arsalan]", priority: "MONTH", category: "Ops" },
  { title: "Pitch deck — 8 slides. BCH proof → problem → 2XG solution → pricing → CTA [Arsalan]", priority: "MONTH", category: "Sales" },
  { title: "2XG landing page fix — lead with prospect pain, offer in first screen [Arsalan+Pandey]", priority: "MONTH", category: "Ops" },
  { title: "Excel to PPT for Prashant — convert leads flow to presentation format [Arsalan]", priority: "MONTH", category: "Ops" },
  { title: "Arsalan EOD summary every night by 10PM: assigned, done, pending, blocked", priority: "MONTH", category: "Staff" },

  // ── CONTENT (This Month) ───────────────────────────────
  { title: "NEXT-BLR: 5 DTC overviews pending approval — get approved this week", priority: "MONTH", category: "Ops" },
  { title: "Approve/reject scripts before shoot. Don't shoot without approved script.", priority: "MONTH", category: "Ops" },
  { title: "2 client appointments — book by Mar 20. Warm network. \"20 min free audit.\"", priority: "MONTH", category: "Sales" },

  // ── SOMEDAY / LOW PRIORITY ────────────────────────────
  { title: "CRM data completeness — currently 37%. Fix data entry habit. [Srinu]", priority: "MONTH", category: "Ops" },
  { title: "Second BDC agent — Anushka alone = single point of failure", priority: "MONTH", category: "Staff" },
  { title: "Content-to-revenue attribution — which content is driving walk-ins?", priority: "MONTH", category: "Sales" },
  { title: "Content Ops Manager hire — full-time replacement for Keshav", priority: "MONTH", category: "Staff" },
  { title: "Content repurposing SOP — 1 shoot → 37-40 pieces documented", priority: "MONTH", category: "Ops" },
  { title: "Zoomies — define the no-kibble store model", priority: "MONTH", category: "Ops" },
  { title: "7 in-person audits done (Ibrahim walks into businesses) [2XG]", priority: "MONTH", category: "Sales" },
  { title: "2-3 free pilots running simultaneously [Arsalan]", priority: "MONTH", category: "Sales" },
  { title: "Close 2-3 pilots to retainers — 3-month minimum. Rs.1.5L/month.", priority: "MONTH", category: "Sales" },
  { title: "Service App — finish by Day 20. Adds Rs.10K/month per client. [Arsalan]", priority: "MONTH", category: "Ops" },
  { title: "Team motivation session — group, not individual", priority: "MONTH", category: "Staff" },
  { title: "Warehouse CCTV — install date confirmed [Shravan]", priority: "MONTH", category: "Ops" },
  { title: "Giridhar (on leave) — confirm return date or replace [Srinu]", priority: "MONTH", category: "Staff" },
];

function dueDateFromPriority(priority: string): Date {
  const now = new Date();
  switch (priority) {
    case "TODAY": return now;
    case "WEEK": return new Date(now.getTime() + 7 * 86400000);
    case "MONTH": return new Date(now.getTime() + 30 * 86400000);
    default: return new Date(now.getTime() + 30 * 86400000);
  }
}

export async function POST() {
  try {
    const user = await requireAuth(["ADMIN"]);

    // Check if tasks already seeded
    const existingCount = await prisma.task.count();
    if (existingCount > 10) {
      return errorResponse(`Already have ${existingCount} tasks. Delete existing tasks first if you want to re-seed.`, 409);
    }

    // Get or create the task counter
    const counter = await prisma.taskCounter.upsert({
      where: { id: "singleton" },
      update: {},
      create: { id: "singleton", current: 0 },
    });

    let taskNum = counter.current;
    let created = 0;

    for (const t of SEED_TASKS) {
      taskNum++;
      const taskNo = `BCH-${String(taskNum).padStart(3, "0")}`;

      await prisma.task.create({
        data: {
          taskNo,
          title: t.title,
          priority: t.priority as never,
          status: "PENDING" as never,
          dueDate: dueDateFromPriority(t.priority),
          notes: `Category: ${t.category}`,
          createdById: user.id,
        },
      });
      created++;
    }

    // Update counter to final number
    await prisma.taskCounter.update({
      where: { id: "singleton" },
      data: { current: taskNum },
    });

    return successResponse({ seeded: created, lastTaskNo: `BCH-${String(taskNum).padStart(3, "0")}` }, 201);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to seed tasks", 500);
  }
}
