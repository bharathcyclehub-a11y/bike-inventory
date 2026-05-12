export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";
import type { Role, SOPFrequency } from "@prisma/client";

// ── Role shorthand ─────────────────────────────────────────
// Each SOP is mapped to one or more roles. When seeded, SOPRoleAssignment rows are created.
// Workers on CUSTOM role see SOPs via individual assignment (admin assigns manually).

type Freq = "SOP_DAILY" | "SOP_WEEKLY" | "SOP_MONTHLY";

interface SOPSeed {
  title: string;
  description: string;
  category: string;
  frequency: Freq;
  roles: Role[];
}

// ── 110 Existing BCH SOPs + 28 New Manager SOPs ────────────

const ALL_SOPS: SOPSeed[] = [
  // ═══════════════════════════════════════════════════════════
  // BDC — 25 SOPs (CUSTOM role — BDC staff)
  // ═══════════════════════════════════════════════════════════
  { title: "Phone Ownership — Zero Missed Calls", description: "Own the store phone 10 AM-9 PM. Never on silent. Answer within 3 rings. Miss a call = call back within 15 minutes.", category: "BDC", frequency: "SOP_DAILY", roles: ["CUSTOM"] },
  { title: "Inbound Call Handling — 5-Step", description: "Greet → Identify need → Push store visit → Capture details → Log in TeleCRM immediately.", category: "BDC", frequency: "SOP_DAILY", roles: ["CUSTOM"] },
  { title: "Lead Follow-Up Discipline", description: "TODAY COMING: call 5 PM if no show. TOMORROW: call 11 AM. STORE VISIT (didn't buy): call 2 days later. No response: 3 attempts over 1 week, then cold.", category: "BDC", frequency: "SOP_DAILY", roles: ["CUSTOM"] },
  { title: "TeleCRM Data Logging Standards", description: "Log every call: date, question type, frequency count, resolution, follow-up status. Log every lead: name, phone, product, budget, status, follow-up date.", category: "BDC", frequency: "SOP_DAILY", roles: ["CUSTOM"] },
  { title: "Missed Call Protocol", description: "Call back within 15 minutes. If unavailable, hand phone to backup person.", category: "BDC", frequency: "SOP_DAILY", roles: ["CUSTOM"] },
  { title: "Daily BDC Reporting", description: "EOD report: total calls, top 3 question types, TODAY COMING leads, confirmed conversions, missed calls count.", category: "BDC", frequency: "SOP_DAILY", roles: ["CUSTOM"] },
  { title: "EMotorad Call Handling (Product Classes)", description: "Class C (27K-40K): X1, X1 Neo, X2, X3. Class B (40K-55K): T-Rex Air. Class A (55K-1.2L+): T-Rex Plus, Doodle, Kalki. Always mention Desire.", category: "BDC", frequency: "SOP_DAILY", roles: ["CUSTOM"] },
  { title: "Family Approval Follow-Up (Recovery)", description: "60% lost deals = 'need family approval.' Call 1 (24hrs), Call 2 (3 days), Call 3 (7 days), then cold.", category: "BDC", frequency: "SOP_DAILY", roles: ["CUSTOM", "SUPERVISOR"] },
  { title: "Call Infrastructure — Phone Numbers & Routing", description: "5 TeleCRM SIMs across 3 mobiles. Log which number caller used for content ROI tracking.", category: "BDC", frequency: "SOP_DAILY", roles: ["CUSTOM"] },
  { title: "Lead Pipeline Management", description: "Stages: FRESH → FRL → PRE-REQUISITES → VISIT SCHEDULED → VISIT DONE → PURCHASED → FOLLOW UP. Never skip.", category: "BDC", frequency: "SOP_DAILY", roles: ["CUSTOM"] },
  { title: "Lead Scoring Framework", description: "VERY HOT (1.0): every 2 days. HOT (0.8): every 2 days, max 5. WARM (0.6): every 4 days, max 3. COLD (0.5): 1 WhatsApp then stop.", category: "BDC", frequency: "SOP_DAILY", roles: ["CUSTOM"] },
  { title: "Minimum Info to Share on Every Call", description: "Location, hours, starting prices, current offers, warranty. Send WhatsApp location after call.", category: "BDC", frequency: "SOP_DAILY", roles: ["CUSTOM"] },
  { title: "EMotorad Script — Awareness-Level Pitching", description: "Match pitch to awareness level: Unaware → Problem Aware → Product Aware → Solution Aware → Most Aware.", category: "BDC", frequency: "SOP_DAILY", roles: ["CUSTOM"] },
  { title: "Contact Naming Convention (TeleCRM)", description: "Format: [TYPE] [LAST NAME] [PRODUCT]. ENQ/SL/SR/OB/KD prefixes.", category: "BDC", frequency: "SOP_DAILY", roles: ["CUSTOM"] },
  { title: "BDC Daily Metrics Tracking", description: "Report by 8:30 PM: calls, answered, abandoned, leads, FRLs, visits, purchases, conversion rate (target 23%).", category: "BDC", frequency: "SOP_DAILY", roles: ["CUSTOM"] },
  { title: "IVR System Overview (CallerDesk)", description: "30K-40K calls/month. IVR filters 65-80%. Every call reaching agent is already qualified.", category: "BDC", frequency: "SOP_DAILY", roles: ["CUSTOM"] },
  { title: "BDC Team Structure & Roles", description: "Team Lead handles premium e-cycle, walk-in, family approval recovery. Operator handles primary inbound, TeleCRM, follow-up.", category: "BDC", frequency: "SOP_DAILY", roles: ["CUSTOM", "SUPERVISOR"] },
  { title: "3-Minute Call Script", description: "5s greet → 30s confirm interest → 60s 3 questions (budget, who, use case) → 30s push visit → 30s log. Don't spend 10 min explaining models.", category: "BDC", frequency: "SOP_DAILY", roles: ["CUSTOM"] },
  { title: "Follow-Up Schedule", description: "10 AM: return missed calls. 11 AM: TOMORROW leads. 2 PM: WhatsApp videos. 5 PM: TODAY COMING no-shows. 8:30 PM: update all.", category: "BDC", frequency: "SOP_DAILY", roles: ["CUSTOM", "SUPERVISOR"] },
  { title: "After-Sale Follow-Up", description: "1 week → 1 month → 3 months → 6 months touch-points.", category: "BDC", frequency: "SOP_MONTHLY", roles: ["CUSTOM"] },
  { title: "Post-Sale Follow-Up Schedule", description: "4 mandatory: 1 week check-in, 1 month service, 3 months referral, 6 months service reminder.", category: "BDC", frequency: "SOP_WEEKLY", roles: ["CUSTOM", "SUPERVISOR"] },
  { title: "Call Qualification — 3-Question Framework", description: "Budget? Who for? Use case? Qualify first, recommend second.", category: "BDC", frequency: "SOP_DAILY", roles: ["CUSTOM", "SUPERVISOR"] },
  { title: "Store Visit Push Technique", description: "Every call includes visit push within 5 minutes. Get specific day, not 'sometime.'", category: "BDC", frequency: "SOP_DAILY", roles: ["CUSTOM", "SUPERVISOR"] },
  { title: "Daily BDC Report to Owner — 9:15 PM", description: "5 numbers: total calls, answered vs missed, tomorrow visits, confirmed conversions, pending follow-ups.", category: "BDC", frequency: "SOP_DAILY", roles: ["SUPERVISOR"] },
  { title: "BDC Hand-Off Protocol (Break/Lunch)", description: "Before break: hand phone to backup with context. Phone never unattended 10AM-9PM.", category: "BDC", frequency: "SOP_DAILY", roles: ["CUSTOM"] },

  // ═══════════════════════════════════════════════════════════
  // Sales — 20 SOPs (OUTWARDS_EXECUTIVE + SALES_MANAGER)
  // ═══════════════════════════════════════════════════════════
  { title: "Value Communication — 'Say the Rupee Number'", description: "Say 'Rs.4,000 worth of free accessories' not 'free accessories.' Rupee number creates perceived value.", category: "Sales", frequency: "SOP_DAILY", roles: ["OUTWARDS_EXECUTIVE", "SALES_MANAGER"] },
  { title: "EMI Rejection Save Process (999 Offer Fallback)", description: "5 fallbacks: next model at 999/month, credit card EMI, higher EMI, partial payment, entry-level 999.", category: "Sales", frequency: "SOP_DAILY", roles: ["OUTWARDS_EXECUTIVE", "SALES_MANAGER"] },
  { title: "The 6-Step Closing Process", description: "Greet → Show (touch/sit) → Value stack → Test ride → Commitment ('Pack it up?') → Paperwork. Never skip.", category: "Sales", frequency: "SOP_DAILY", roles: ["OUTWARDS_EXECUTIVE", "SALES_MANAGER"] },
  { title: "Pricing Rules", description: "Budget Indian: MRP+10%. White Label: DOUBLE cost. Premium International: MRP+5%. Below floor = Owner only.", category: "Sales", frequency: "SOP_DAILY", roles: ["OUTWARDS_EXECUTIVE", "SALES_MANAGER"] },
  { title: "Pre-Booking Process", description: "Get name+phone, collect advance, log with ETA, call when arrives, proactive ETA updates.", category: "Sales", frequency: "SOP_DAILY", roles: ["OUTWARDS_EXECUTIVE", "SALES_MANAGER"] },
  { title: "Exchange / Second-Hand Cycle Handling", description: "Grade (L1/L2/L3), get approval on buy price, log both sides in Zoho.", category: "Sales", frequency: "SOP_DAILY", roles: ["OUTWARDS_EXECUTIVE", "SALES_MANAGER"] },
  { title: "Client Engagement Standards", description: "30-second greet. Never 2 min unattended. No phone/yawning/gossiping in front of customers.", category: "Sales", frequency: "SOP_DAILY", roles: ["OUTWARDS_EXECUTIVE", "SALES_MANAGER", "STORE_MANAGER"] },
  { title: "EMotorad Desire Push", description: "200-unit target. Every e-cycle inquiry must include Desire mention.", category: "Sales", frequency: "SOP_DAILY", roles: ["OUTWARDS_EXECUTIVE", "SALES_MANAGER"] },
  { title: "2-Person Authentication (Sales Escalation / TO)", description: "Customer hesitating: bring in second person (fresh face re-engages).", category: "Sales", frequency: "SOP_DAILY", roles: ["OUTWARDS_EXECUTIVE", "SALES_MANAGER", "CUSTOM"] },
  { title: "Lost Deal Logging", description: "Every non-buyer logged before EOD: name, phone, what wanted, why didn't buy.", category: "Sales", frequency: "SOP_DAILY", roles: ["OUTWARDS_EXECUTIVE", "SALES_MANAGER"] },
  { title: "In-Store Purchase Flow", description: "Model → Size/color → Stock check → Bill in Zoho → Accessories → Assemble → QC → Pay → Deliver.", category: "Sales", frequency: "SOP_DAILY", roles: ["OUTWARDS_EXECUTIVE", "SALES_MANAGER"] },
  { title: "Product Knowledge — Complete Guide", description: "Sizing, top sellers, e-cycle dust factor, accessories value, warranty details.", category: "Sales", frequency: "SOP_WEEKLY", roles: ["OUTWARDS_EXECUTIVE", "SALES_MANAGER", "CUSTOM"] },
  { title: "Sales Voice Note — 10 Min by 9:15 PM", description: "12 sections: sales, interactions (min 3), lost deals, delivery, doorstep, floor/delivery split, reviews, follow-ups, observations, problems, wins, tomorrow.", category: "Sales", frequency: "SOP_DAILY", roles: ["OUTWARDS_EXECUTIVE"] },
  { title: "Dispute Handling", description: "Listen → Acknowledge → Don't argue → Fix fast → Follow up next day → Document.", category: "Sales", frequency: "SOP_DAILY", roles: ["OUTWARDS_EXECUTIVE", "SALES_MANAGER", "SUPERVISOR", "CUSTOM"] },
  { title: "Dispute Escalation Matrix", description: "Price >2K, service quality repeat, delivery damage, battery warranty, EMI anger, wrong product, refund → all to Owner.", category: "Sales", frequency: "SOP_DAILY", roles: ["OUTWARDS_EXECUTIVE", "SALES_MANAGER", "SUPERVISOR", "SERVICE_MANAGER", "CUSTOM"] },
  { title: "Bicycle Size Guide", description: "14T=<3yr, 16T=<6yr, 20T=>6yr, 24T=teens, 26T=adults, 27.5T=MTB, 29T=performance, 700C=road/hybrid.", category: "Sales", frequency: "SOP_DAILY", roles: ["OUTWARDS_EXECUTIVE", "SALES_MANAGER"] },
  { title: "E-Cycle Dust Factor Pitch", description: "E-cycles used 300% more than normal. 'Your kid will actually ride this one.'", category: "Sales", frequency: "SOP_DAILY", roles: ["OUTWARDS_EXECUTIVE", "SALES_MANAGER"] },
  { title: "Brand Portfolio Positioning", description: "Premium International (Trek etc) → serious. White Label → budget quality. Budget Indian → kids/entry. E-cycles → commuters.", category: "Sales", frequency: "SOP_DAILY", roles: ["OUTWARDS_EXECUTIVE", "SALES_MANAGER", "CUSTOM"] },
  { title: "Price Dispute Resolution", description: "Listen, show value (Rs.7K+ included), under 2K resolve on spot, over 2K escalate to Owner.", category: "Sales", frequency: "SOP_DAILY", roles: ["OUTWARDS_EXECUTIVE", "SALES_MANAGER"] },
  { title: "Refund Request Protocol", description: "No refund without Owner. Offer exchange/repair/store credit first.", category: "Sales", frequency: "SOP_DAILY", roles: ["OUTWARDS_EXECUTIVE", "SALES_MANAGER", "SUPERVISOR", "CUSTOM"] },

  // ═══════════════════════════════════════════════════════════
  // Service — 18 SOPs (SERVICE_MANAGER + CUSTOM for mechanics)
  // ═══════════════════════════════════════════════════════════
  { title: "Service Intake — Log Every Bike In", description: "Name+phone, bike details, complaint in customer's words, intake tag, assign mechanic.", category: "Service", frequency: "SOP_DAILY", roles: ["SERVICE_MANAGER", "CUSTOM"] },
  { title: "Service Diagnosis Checklist", description: "Brakes, gears, tires, chain, headset, wheels. E-cycles add: battery, motor, display, wiring.", category: "Service", frequency: "SOP_DAILY", roles: ["SERVICE_MANAGER", "CUSTOM"] },
  { title: "Service Status Communication", description: "Call before starting (quote), call when ready, call if delay. 'Your [bike] is ready at BCH.'", category: "Service", frequency: "SOP_DAILY", roles: ["SERVICE_MANAGER", "CUSTOM"] },
  { title: "E-Cycle Common Issues FAQ", description: "Battery, motor, display, pedal assist, range — diagnostic steps for each.", category: "Service", frequency: "SOP_DAILY", roles: ["SERVICE_MANAGER", "CUSTOM"] },
  { title: "When You Are Selling (Dual Role)", description: "On sales floor: use mechanical expertise as closing tool. Step in for technical questions.", category: "Service", frequency: "SOP_DAILY", roles: ["SERVICE_MANAGER", "CUSTOM"] },
  { title: "Parts Request Process", description: "Check inventory first, written request if unavailable, never buy outside without auth, log every part.", category: "Service", frequency: "SOP_DAILY", roles: ["SERVICE_MANAGER", "CUSTOM"] },
  { title: "Quality Standards — No Return Within 7 Days", description: "Test-ride before ready. Brakes stop in 2 bike lengths. Back within 7 days = zero charge redo.", category: "Service", frequency: "SOP_DAILY", roles: ["SERVICE_MANAGER", "CUSTOM"] },
  { title: "Workspace and Tools", description: "EOD: tools cleaned/returned, bench clear, floor swept. Weekly consumables inventory.", category: "Service", frequency: "SOP_DAILY", roles: ["SERVICE_MANAGER", "CUSTOM"] },
  { title: "Service Completion Verification", description: "Test-rides every service bike before marked ready. No exceptions. Zero bikes leave without sign-off.", category: "Service", frequency: "SOP_DAILY", roles: ["SERVICE_MANAGER", "SUPERVISOR"] },
  { title: "Service Types & Pricing", description: "Regular (Rs.500, 45min), Complete Makeover (Rs.2,459, 4hrs), Repair (Rs.200+), Free Service (AMC).", category: "Service", frequency: "SOP_DAILY", roles: ["SERVICE_MANAGER"] },
  { title: "Service Revenue Target", description: "Monthly Rs.5,00,000. 85% efficiency. Below target by Wednesday: flag with recovery plan.", category: "Service", frequency: "SOP_DAILY", roles: ["SERVICE_MANAGER"] },
  { title: "Service Process Standards", description: "Checklist, recommend package, customer profile, WhatsApp at each status, honor TAT, satisfaction callback.", category: "Service", frequency: "SOP_DAILY", roles: ["SERVICE_MANAGER"] },
  { title: "E-Cycle Service Notes", description: "Battery capacity test. Motor/controller: only senior mechanics. Check waterproofing, warranty status.", category: "Service", frequency: "SOP_DAILY", roles: ["SERVICE_MANAGER", "CUSTOM"] },
  { title: "Service TAT Targets", description: "Quick fix <2hrs, standard <4hrs, major <24hrs, e-cycle <6hrs. Call before TAT breach.", category: "Service", frequency: "SOP_DAILY", roles: ["SERVICE_MANAGER", "CUSTOM"] },
  { title: "WhatsApp Service Status Updates", description: "3 stages: Received, Diagnosis+estimate, Ready. Never 3+ hours without status.", category: "Service", frequency: "SOP_DAILY", roles: ["SERVICE_MANAGER", "CUSTOM"] },
  { title: "Post-Service Satisfaction Callback", description: "Call within 24hrs of pickup. Issue: same-day fix. Satisfied: Google review ask.", category: "Service", frequency: "SOP_DAILY", roles: ["SUPERVISOR", "CUSTOM"] },
  { title: "E-Cycle Warranty Rules Communication", description: "Lifetime frame, 5yr battery guarantee, 2yr replacement, 3yr repair, 1yr free AMC. Void conditions.", category: "Service", frequency: "SOP_DAILY", roles: ["SERVICE_MANAGER", "CUSTOM"] },
  { title: "Battery/Range Complaint Process", description: "Capacity test, tire pressure, riding conditions check. Below spec: warranty claim to Owner.", category: "Service", frequency: "SOP_DAILY", roles: ["SERVICE_MANAGER", "CUSTOM"] },

  // ═══════════════════════════════════════════════════════════
  // Ops — 18 SOPs (SUPERVISOR as Ops Manager + INWARDS_EXECUTIVE)
  // ═══════════════════════════════════════════════════════════
  { title: "Inventory Counting Process", description: "Zone rotation Mon-Fri. Two-person count. Discrepancy same day.", category: "Ops", frequency: "SOP_DAILY", roles: ["SUPERVISOR", "INWARDS_EXECUTIVE"] },
  { title: "Warehouse Inventory Management", description: "Barcode tag every bike in/out. Excel same day. New stock: unbox→barcode→log→zone within 24hrs.", category: "Ops", frequency: "SOP_DAILY", roles: ["SUPERVISOR", "INWARDS_EXECUTIVE"] },
  { title: "Delivery & Reverse Pickup Coordination", description: "Pre-delivery QC, call 30min before, photo before leaving, customer walkthrough, Google review ask.", category: "Ops", frequency: "SOP_DAILY", roles: ["SUPERVISOR", "OUTWARDS_EXECUTIVE", "INWARDS_EXECUTIVE"] },
  { title: "Task Management — Daily Tracker Review", description: "Review tracker before 10 AM. Flag overdue. Assign with deadlines. Weekly Monday review.", category: "Ops", frequency: "SOP_DAILY", roles: ["SUPERVISOR"] },
  { title: "Exchange Cycle Tracking", description: "Log every exchange: name, grade, buy price, approved by. Both buy and sell in Zoho.", category: "Ops", frequency: "SOP_DAILY", roles: ["SUPERVISOR", "CUSTOM", "INWARDS_EXECUTIVE"] },
  { title: "Reorder Awareness", description: "Flag below minimum stock. EMotorad 5/SKU, Hero kids 10, Accessories 50 each.", category: "Ops", frequency: "SOP_WEEKLY", roles: ["SUPERVISOR"] },
  { title: "Store Opening & Closing", description: "Opening: lights, sweep, dust bikes, tags, billing ready, phone to BDC. Closing: logs, register, bikes secured, WhatsApp to Owner.", category: "Ops", frequency: "SOP_DAILY", roles: ["SUPERVISOR", "STORE_MANAGER", "OUTWARDS_EXECUTIVE"] },
  { title: "Cleaning & Hygiene Standards", description: "Daily: floor, dust bikes, billing counter, washrooms. Tuesday = deep clean.", category: "Ops", frequency: "SOP_DAILY", roles: ["SUPERVISOR", "STORE_MANAGER"] },
  { title: "Bike Display & Placement", description: "Zone 1: Hybrid/MTB/Premium outward, size-ordered. Zone 2: Performance with space. Zone 3: E-cycles, Desire front and center.", category: "Ops", frequency: "SOP_DAILY", roles: ["SUPERVISOR", "STORE_MANAGER"] },
  { title: "Brand Reputation Standards", description: "Builds: presentable staff, 30s greet, music, signage. Kills: yawning, gossiping, dusty bikes, clutter.", category: "Ops", frequency: "SOP_DAILY", roles: ["SUPERVISOR", "STORE_MANAGER"] },
  { title: "Delivery Process — Outside Bangalore", description: "Photo all angles, customer photos BEFORE signing LR, tracking+assembly video, do's & don'ts.", category: "Ops", frequency: "SOP_DAILY", roles: ["OUTWARDS_EXECUTIVE"] },
  { title: "Ops Manager Voice Note — 15 Min by 9:15 PM", description: "14 sections covering all store operations. Minimum 15 minutes.", category: "Ops", frequency: "SOP_DAILY", roles: ["SUPERVISOR"] },
  { title: "Daily Voice Note — General Rules", description: "9-9:30 PM, English only (AI transcription), WhatsApp, 3-5 min, honest/direct.", category: "Ops", frequency: "SOP_DAILY", roles: ["SUPERVISOR", "ACCOUNTS_MANAGER"] },
  { title: "Store Manager Voice Note — 9-Section Format", description: "Revenue, leads, wins, losses, learnings, staff issues, inventory flags, tomorrow's top 3, questions for Owner.", category: "Ops", frequency: "SOP_DAILY", roles: ["STORE_MANAGER"] },
  { title: "Bangalore Delivery Process", description: "Free delivery. Day before: schedule. Morning: reconfirm. 30min before: call. At delivery: walkthrough, photo, review ask.", category: "Ops", frequency: "SOP_DAILY", roles: ["OUTWARDS_EXECUTIVE", "SUPERVISOR"] },
  { title: "Hourly Floor Observation", description: "Every hour 10AM-9PM: who's on floor, who's with customer, who's idle, display issues.", category: "Ops", frequency: "SOP_DAILY", roles: ["SUPERVISOR", "STORE_MANAGER"] },
  { title: "Weekly Deep Clean — Tuesday Protocol", description: "Start 8:30 AM: windows, floor scrub, back area, damages, washrooms, tools. Photograph, send to Owner.", category: "Ops", frequency: "SOP_WEEKLY", roles: ["SUPERVISOR", "STORE_MANAGER"] },
  { title: "Infrastructure & Equipment Check", description: "Before opening: lights, AC, billing, Wi-Fi, music, CCTV, signage. Weekly: fire ext, first aid, parking.", category: "Ops", frequency: "SOP_DAILY", roles: ["SUPERVISOR", "STORE_MANAGER", "OUTWARDS_EXECUTIVE"] },

  // ═══════════════════════════════════════════════════════════
  // Finance — 16 SOPs (ACCOUNTS_MANAGER)
  // ═══════════════════════════════════════════════════════════
  { title: "Zoho Billing Standards", description: "Every invoice: customer, phone, product details, prices, salesperson, payment method. No 0% margin. >10% discount = Owner.", category: "Finance", frequency: "SOP_DAILY", roles: ["ACCOUNTS_MANAGER"] },
  { title: "Exchange Purchase Logging", description: "Log as PURCHASE in Zoho (vendor=customer, condition, price, approval). Selling: log as SALE with reference.", category: "Finance", frequency: "SOP_DAILY", roles: ["ACCOUNTS_MANAGER"] },
  { title: "Zoho Purchase Billing Process", description: "Create in Zoho, exact bill number, verify HSN+serial, match quantities, submit for approval within 2hrs.", category: "Finance", frequency: "SOP_DAILY", roles: ["ACCOUNTS_MANAGER"] },
  { title: "Price Book Maintenance", description: "New stock added within 24hrs. Price changes update Zoho AND floor same day. Print laminated copies (selling only). NEVER share cost with floor.", category: "Finance", frequency: "SOP_WEEKLY", roles: ["ACCOUNTS_MANAGER"] },
  { title: "Daily Zoho Report — Send by 9:30 PM", description: "Revenue, invoices, by-salesperson, avg ticket, top 3 products, EMI count, exchanges, cash recon.", category: "Finance", frequency: "SOP_DAILY", roles: ["ACCOUNTS_MANAGER"] },
  { title: "EMI Tracking — Application to Credit", description: "Track every application: customer, product, amount, partner, status, rejection reason. Monthly report.", category: "Finance", frequency: "SOP_DAILY", roles: ["ACCOUNTS_MANAGER"] },
  { title: "Inventory Records in Zoho", description: "New stock within 24hrs, sales auto-deducted, exchanges added, damages recorded. Weekly reconciliation.", category: "Finance", frequency: "SOP_DAILY", roles: ["ACCOUNTS_MANAGER"] },
  { title: "Festival / Off-Day Coverage", description: "Before off: ensure backup can generate invoices. Brief special prices/pending EMI. On return: review and correct.", category: "Finance", frequency: "SOP_MONTHLY", roles: ["ACCOUNTS_MANAGER"] },
  { title: "Zoho Access Control — Information Segregation", description: "Full access: Finance Head + Owner only. Billing support: billing view only. Sales/Mechanics: NO Zoho. Cost stickers removed.", category: "Finance", frequency: "SOP_DAILY", roles: ["ACCOUNTS_MANAGER"] },
  { title: "Finance Voice Note — 10 Min by 9:15 PM", description: "12 sections: revenue, invoice audit, purchase bills, EMI, exchange, cash recon, Google reviews, price book, Zoho integrity, red flags, wins, tomorrow.", category: "Finance", frequency: "SOP_DAILY", roles: ["ACCOUNTS_MANAGER"] },
  { title: "Payment Method Reconciliation", description: "EOD: Cash vs Zoho, UPI vs bank, Card vs machine, EMI vs partner. Any discrepancy: flag immediately.", category: "Finance", frequency: "SOP_DAILY", roles: ["ACCOUNTS_MANAGER"] },
  { title: "Petty Cash & Large Transaction Rules", description: "Receipts for every spend. No advances without Owner. No personal loans. >Rs.10K = Zoho receipt.", category: "Finance", frequency: "SOP_DAILY", roles: ["ACCOUNTS_MANAGER"] },
  { title: "Google Review Verification", description: "Daily: cross-check Google vs sales records. Every sale should have review. Track weekly.", category: "Finance", frequency: "SOP_DAILY", roles: ["ACCOUNTS_MANAGER"] },
  { title: "Weekly Inventory Reconciliation", description: "Every Friday: Zoho vs physical count, category by category. Investigate before adjusting.", category: "Finance", frequency: "SOP_WEEKLY", roles: ["ACCOUNTS_MANAGER", "SUPERVISOR"] },
  { title: "Bajaj EMI Credit Verification", description: "Track that amount credited within 5 business days. Not received: escalate with details.", category: "Finance", frequency: "SOP_DAILY", roles: ["ACCOUNTS_MANAGER"] },
  { title: "Purchase Bill Approval Workflow", description: "Enter DRAFT → Owner reviews within 2hrs → CONFIRMED. No bill stays DRAFT beyond same day.", category: "Finance", frequency: "SOP_DAILY", roles: ["ACCOUNTS_MANAGER"] },

  // ═══════════════════════════════════════════════════════════
  // Content — 9 SOPs (CUSTOM role — content team)
  // ═══════════════════════════════════════════════════════════
  { title: "Shoot Readiness Checklist", description: "7 checks before any shoot: script, talent, products, location, equipment, B-roll list, Owner approval.", category: "Content", frequency: "SOP_DAILY", roles: ["CUSTOM"] },
  { title: "Edit QC Checklist", description: "12-point check. Pass: 10/12 minimum. Hook in 6s, branding, CTA, correct phone, clear audio/video.", category: "Content", frequency: "SOP_DAILY", roles: ["CUSTOM"] },
  { title: "Post QC Checklist", description: "8 checks before publishing: profile, caption keywords, phone, hashtags, optimal time, location, cross-post, calendar.", category: "Content", frequency: "SOP_DAILY", roles: ["CUSTOM"] },
  { title: "Weekly Ride Planning", description: "Mon plan → Tue content → Wed announce → Thu confirm → Fri promo → Sat ride → Sun highlights.", category: "Content", frequency: "SOP_WEEKLY", roles: ["CUSTOM"] },
  { title: "Event Types & Frequency", description: "Weekly ride, monthly kids ride, monthly workshop, model launches, festive rides. Document same day.", category: "Content", frequency: "SOP_MONTHLY", roles: ["CUSTOM"] },
  { title: "AI Script Generation Workflow", description: "Input BCH data to AI → draft → review for BCH voice → approval → shoot. No script = no shoot.", category: "Content", frequency: "SOP_DAILY", roles: ["CUSTOM"] },
  { title: "Content Calendar Management — 8 Profiles", description: "Phased rollout: 2→4→8 profiles over 30 days. Track script/shoot/edit/post status daily.", category: "Content", frequency: "SOP_DAILY", roles: ["CUSTOM"] },
  { title: "10 Proven BCH Content Formulas", description: "Kannada first, Rs.999, model showcase, test ride reaction, before/after, delivery moment, e-cycle vs petrol, kids, Desire, store tour.", category: "Content", frequency: "SOP_DAILY", roles: ["CUSTOM"] },
  { title: "Content KPI Tracking", description: "Script compliance 100%, edit QC first-pass 80%, posting on-time 95%. Incentive tiers: Rs.2K/3K/5K.", category: "Content", frequency: "SOP_WEEKLY", roles: ["CUSTOM"] },

  // ═══════════════════════════════════════════════════════════
  // Billing — 4 SOPs (ACCOUNTS_MANAGER)
  // ═══════════════════════════════════════════════════════════
  { title: "Register Session Management", description: "Close before ANY break. Count cash. Never let another person bill under your session. Discrepancy: report immediately.", category: "Billing", frequency: "SOP_DAILY", roles: ["ACCOUNTS_MANAGER", "CUSTOM"] },
  { title: "Daily Cash Reconciliation", description: "EOD: count all cash, compare to Zoho. Investigate discrepancy. Record: date, counted by, amounts, match Y/N.", category: "Billing", frequency: "SOP_DAILY", roles: ["ACCOUNTS_MANAGER", "CUSTOM"] },
  { title: "Cash Handling Rules", description: "Authorized only: billing staff, Finance Head, Owner. No advances without approval. No personal loans. Petty cash separate.", category: "Billing", frequency: "SOP_DAILY", roles: ["ACCOUNTS_MANAGER", "CUSTOM"] },
  { title: "Billing Session Management (Strict)", description: "Close before EVERY break. Count and note. Only your invoices in your session. Left open = written warning.", category: "Billing", frequency: "SOP_DAILY", roles: ["CUSTOM"] },

  // ═══════════════════════════════════════════════════════════
  // NEW — Store Manager SOPs (10)
  // ═══════════════════════════════════════════════════════════
  { title: "Morning Store Readiness Sign-Off", description: "Walk the store before opening: displays clean, price tags visible, lights/AC on, POS ready, washrooms stocked. Sign off in app.", category: "Ops", frequency: "SOP_DAILY", roles: ["STORE_MANAGER"] },
  { title: "Hourly Floor Walk & Staff Check", description: "Every hour: who's on floor, who's with customer, who's idle? Display issues? Cleanliness? Log observations.", category: "Ops", frequency: "SOP_DAILY", roles: ["STORE_MANAGER"] },
  { title: "Customer Escalation Handling (< Rs.5K)", description: "Handle customer complaints and price disputes under Rs.5K without escalating to Owner. Document resolution.", category: "Sales", frequency: "SOP_DAILY", roles: ["STORE_MANAGER"] },
  { title: "Sales Team Daily Huddle (10 AM)", description: "5-min morning briefing: yesterday's numbers, today's targets, featured products, current offers, any issues.", category: "Sales", frequency: "SOP_DAILY", roles: ["STORE_MANAGER", "SALES_MANAGER"] },
  { title: "EOD Revenue vs Target Check", description: "End of day: compare actual revenue to target. Flag if below 80%. Note reasons for shortfall.", category: "Finance", frequency: "SOP_DAILY", roles: ["STORE_MANAGER"] },
  { title: "Weekly Team Performance Review", description: "Every Monday: review each team member's metrics (sales, compliance, attendance). Identify coaching needs.", category: "Ops", frequency: "SOP_WEEKLY", roles: ["STORE_MANAGER"] },
  { title: "Staff Scheduling & Breaks Management", description: "Ensure floor coverage at all times. Stagger breaks. No more than 2 people on break simultaneously.", category: "Ops", frequency: "SOP_DAILY", roles: ["STORE_MANAGER"] },
  { title: "Lost Deal Review & Coaching", description: "Review lost deals daily. Identify patterns. Coach sales team on common failure points.", category: "Sales", frequency: "SOP_DAILY", roles: ["STORE_MANAGER", "SALES_MANAGER"] },
  { title: "Walk-In Conversion Tracking", description: "Track walk-ins vs purchases hourly. Target 23% conversion. Flag if below 15% by 3 PM.", category: "Sales", frequency: "SOP_DAILY", roles: ["STORE_MANAGER", "SALES_MANAGER"] },
  { title: "Customer Complaint Resolution Log", description: "Every complaint gets: timestamp, issue, resolution, follow-up date. Weekly trend report to Owner.", category: "Sales", frequency: "SOP_DAILY", roles: ["STORE_MANAGER"] },

  // ═══════════════════════════════════════════════════════════
  // NEW — Sales Manager SOPs (8)
  // ═══════════════════════════════════════════════════════════
  { title: "Sales Morning Briefing: Targets & Focus", description: "Before 10:15 AM: share daily target, highlight focus products, communicate current offers to all sales staff.", category: "Sales", frequency: "SOP_DAILY", roles: ["SALES_MANAGER"] },
  { title: "Hourly Conversion Check", description: "Track walk-ins vs sales every hour. If conversion below 15% by 2 PM, intervene with coaching.", category: "Sales", frequency: "SOP_DAILY", roles: ["SALES_MANAGER"] },
  { title: "Every Lost Deal Gets a 'Why'", description: "Within 1 hour of lost deal: log reason (price, stock, comparison, EMI rejected, didn't like). Weekly pattern analysis.", category: "Sales", frequency: "SOP_DAILY", roles: ["SALES_MANAGER"] },
  { title: "Price Exception Log", description: "Every discount given below standard: log customer, product, discount amount, reason. Weekly report to Owner.", category: "Sales", frequency: "SOP_DAILY", roles: ["SALES_MANAGER"] },
  { title: "EMI Application Tracking", description: "Track all EMI applications: approved, rejected, pending. Follow up on pending within 24hrs.", category: "Sales", frequency: "SOP_DAILY", roles: ["SALES_MANAGER"] },
  { title: "Test Ride Completion Rate", description: "Track: how many inquiries got test rides? Target: 80%+ of serious inquiries. Below 60%: coaching session.", category: "Sales", frequency: "SOP_DAILY", roles: ["SALES_MANAGER"] },
  { title: "Accessories Attach Rate", description: "Track accessories sold per bicycle. Target: Rs.2000+ avg per bike. Below target: bundle training.", category: "Sales", frequency: "SOP_DAILY", roles: ["SALES_MANAGER"] },
  { title: "Sales Manager Voice Note — 9:15 PM", description: "Revenue, conversion, top performer, worst performer, lost deals summary, tomorrow's plan, issues for Owner.", category: "Sales", frequency: "SOP_DAILY", roles: ["SALES_MANAGER"] },

  // ═══════════════════════════════════════════════════════════
  // NEW — Service Manager SOPs (10)
  // ═══════════════════════════════════════════════════════════
  { title: "Morning Job Queue Review & Assignment", description: "Before 10 AM: review pending jobs, assign to mechanics based on skill and workload. No job unassigned.", category: "Service", frequency: "SOP_DAILY", roles: ["SERVICE_MANAGER"] },
  { title: "TAT Breach Prevention", description: "Check all active jobs at 2 PM. Any job at risk of TAT breach: call customer proactively with updated ETA.", category: "Service", frequency: "SOP_DAILY", roles: ["SERVICE_MANAGER"] },
  { title: "Daily Service Revenue vs Target", description: "Track service revenue daily. Monthly target Rs.5L. Below 60% by mid-month: flag recovery plan.", category: "Service", frequency: "SOP_DAILY", roles: ["SERVICE_MANAGER"] },
  { title: "Parts Request Approval (< Rs.1K)", description: "Approve parts requests under Rs.1K. Above Rs.1K: escalate to Owner. Log all parts used per job.", category: "Service", frequency: "SOP_DAILY", roles: ["SERVICE_MANAGER"] },
  { title: "Service Bay Cleanliness Audit (EOD)", description: "Walk the service bay at closing: tools stored, bench clear, floor swept, waste disposed. Photo log.", category: "Service", frequency: "SOP_DAILY", roles: ["SERVICE_MANAGER"] },
  { title: "Mechanic Skill Matrix Update", description: "Monthly: assess each mechanic's skills (regular, e-cycle, premium). Plan training for gaps.", category: "Service", frequency: "SOP_MONTHLY", roles: ["SERVICE_MANAGER"] },
  { title: "Warranty Claim Processing", description: "Document issue thoroughly, check warranty eligibility, submit claim with photos/video, track status weekly.", category: "Service", frequency: "SOP_DAILY", roles: ["SERVICE_MANAGER"] },
  { title: "Service Manager Voice Note — 9:15 PM", description: "Jobs completed, revenue, TAT breaches, parts issues, mechanic performance, customer complaints, tomorrow's queue.", category: "Service", frequency: "SOP_DAILY", roles: ["SERVICE_MANAGER"] },
  { title: "Weekly Service Quality Review", description: "Review: 7-day returns (target: 0), customer complaints, satisfaction scores. Action plan for issues.", category: "Service", frequency: "SOP_WEEKLY", roles: ["SERVICE_MANAGER"] },
  { title: "Service Scheduling & Capacity Planning", description: "Track daily capacity utilization. Overbooked: communicate longer TAT. Underbooked: promote service offers.", category: "Service", frequency: "SOP_DAILY", roles: ["SERVICE_MANAGER"] },

  // ═══════════════════════════════════════════════════════════
  // CEO SOPs (12)
  // ═══════════════════════════════════════════════════════════
  { title: "Morning Dashboard Review", description: "Check SOP compliance dashboard, yesterday's violations, pending deliveries, stock alerts. 5-min scan before 10 AM.", category: "Ops", frequency: "SOP_DAILY", roles: ["CEO"] },
  { title: "Review Daily Sales Summary", description: "Check yesterday's total sales, invoice count, payment modes, and compare with target. Flag if below 70% of daily goal.", category: "Sales", frequency: "SOP_DAILY", roles: ["CEO"] },
  { title: "Approve Pending Bills > Rs.25K", description: "Review and approve all vendor bills above Rs.25K. Check bill amount matches PO, verify delivery received.", category: "Finance", frequency: "SOP_DAILY", roles: ["CEO"] },
  { title: "Check Violation Report", description: "Review auto-generated SOP violations from previous day. Discuss repeat offenders with respective managers.", category: "Ops", frequency: "SOP_DAILY", roles: ["CEO"] },
  { title: "Afternoon Floor Walk", description: "Walk the showroom and service area. Check: staff at stations, customer interactions quality, display neatness, signage.", category: "Ops", frequency: "SOP_DAILY", roles: ["CEO"] },
  { title: "Review Cash Position & Bank Balance", description: "Check today's cash in hand, pending vendor payments due this week, bank balance. Flag any cash crunch.", category: "Finance", frequency: "SOP_DAILY", roles: ["CEO"] },
  { title: "Manager Voice Notes Review", description: "Listen to evening voice notes from Sales Manager, Service Manager, Ops Manager. Note action items.", category: "Ops", frequency: "SOP_DAILY", roles: ["CEO"] },
  { title: "Weekly P&L Review", description: "Review weekly revenue, COGS, expenses, and gross margin. Compare with monthly targets. Flag deviations > 10%.", category: "Finance", frequency: "SOP_WEEKLY", roles: ["CEO"] },
  { title: "Weekly Team Performance Review", description: "Review SOP adherence per person, violation trends, streaks. Identify top performer and laggard. Plan 1:1 if needed.", category: "Ops", frequency: "SOP_WEEKLY", roles: ["CEO"] },
  { title: "Weekly Vendor Payment Planning", description: "Review bills due next 7 days. Prioritize CD-eligible payments. Approve payment batch for the week.", category: "Finance", frequency: "SOP_WEEKLY", roles: ["CEO"] },
  { title: "Monthly SOP Effectiveness Review", description: "Analyze: which SOPs have low adherence across all staff. Retire/rewrite ineffective SOPs. Add new SOPs based on floor observations.", category: "Ops", frequency: "SOP_MONTHLY", roles: ["CEO"] },
  { title: "Monthly Business Review Deck", description: "Prepare or review: revenue vs target, margins, stock value, vendor balances, team metrics, customer growth. Share with stakeholders.", category: "Finance", frequency: "SOP_MONTHLY", roles: ["CEO"] },
];

export async function POST() {
  try {
    await requireAuth(["ADMIN"]);

    const admin = await prisma.user.findFirst({
      where: { role: { in: ["CEO", "ADMIN"] }, isActive: true },
      select: { id: true },
    });

    if (!admin) return errorResponse("No active admin/CEO user found", 400);

    let created = 0;
    let skipped = 0;

    for (const sop of ALL_SOPS) {
      // Skip if already exists (by title)
      const existing = await prisma.sOP.findFirst({
        where: { title: sop.title },
      });

      if (existing) {
        // Still ensure role assignments exist
        for (const role of sop.roles) {
          await prisma.sOPRoleAssignment.upsert({
            where: { sopId_role: { sopId: existing.id, role } },
            update: {},
            create: { sopId: existing.id, role },
          });
        }
        skipped++;
        continue;
      }

      const newSop = await prisma.sOP.create({
        data: {
          title: sop.title,
          description: sop.description,
          category: sop.category,
          frequency: sop.frequency as SOPFrequency,
          createdById: admin.id,
          roleAssignments: {
            create: sop.roles.map((role) => ({ role })),
          },
        },
      });

      created++;
    }

    return successResponse({
      created,
      skipped,
      total: ALL_SOPS.length,
      message: `Seeded ${created} new SOPs, updated role assignments for ${skipped} existing SOPs.`,
    }, 201);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to seed SOPs", 400);
  }
}
